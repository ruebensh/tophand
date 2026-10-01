import { Router } from 'express';
import { queryAll } from '../db/database.ts';
import { resolveLanding, regionIdToSlug } from '../services/seoService.ts';
import { searchListings } from '../services/listingService.ts';

const router = Router();

/**
 * Kanonik sayt bazasi.
 * 1. SITE_URL env (eng ishonchli — Render/Cloudflare host header muammolarini aylanib o'tadi)
 * 2. Request headers (fallback)
 */
function siteBase(req: any): string {
  // Env birinchi — aniq kanonik URL
  const envUrl = process.env.SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
  return `${proto}://${host}`.replace(/\/$/, '');
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string)
  );
}

// ─── Hudud landing sahifasi uchun ma'lumot (frontend fetch qiladi) ───────
router.get('/api/seo/landing', async (req, res) => {
  try {
    const regionSlug = String(req.query.region || '').trim();
    const categorySlug = String(req.query.category || '').trim() || undefined;
    if (!regionSlug) return res.status(400).json({ error: 'region kerak' });

    const data = await resolveLanding(regionSlug, categorySlug);
    if (!data) return res.status(404).json({ error: 'topilmadi' });

    const result = await searchListings({
      region_id: data.region.id,
      category_id: data.category?.id,
      page: 1,
      limit: 48,
    } as any);

    res.json({ ...data, listings: result.items, total: result.pagination.total });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── robots.txt ──────────────────────────────────────────────────────────
router.get('/robots.txt', (req, res) => {
  const base = siteBase(req);
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',
      'Disallow: /admin',
      'Disallow: /moderator',
      'Disallow: /chat',
      'Disallow: /saved',
      '',
      `Sitemap: ${base}/sitemap.xml`,
      '',
    ].join('\n')
  );
});

// ─── sitemap.xml (statik sahifalar + faol e'lonlar) ──────────────────────
router.get('/sitemap.xml', async (req, res) => {
  try {
    const base = siteBase(req);
    const now = new Date().toISOString();

    // Statik/yuqori ustuvorlikli sahifalar
    const staticUrls: { loc: string; priority: string; changefreq: string; lastmod?: string }[] = [
      { loc: `${base}/`, priority: '1.0', changefreq: 'hourly', lastmod: now },
      { loc: `${base}/categories`, priority: '0.8', changefreq: 'daily' },
    ];

    // Faol (ACTIVE) e'lonlar — Google indekslashi uchun
    const listings = await queryAll<{ id: string; updated_at: string | Date }>(
      `SELECT id, updated_at FROM listings WHERE status = 'ACTIVE' ORDER BY updated_at DESC LIMIT 50000`
    );

    const listingUrls = listings.map((l) => ({
      loc: `${base}/listing/${l.id}`,
      priority: '0.7',
      changefreq: 'daily',
      lastmod: l.updated_at ? new Date(l.updated_at).toISOString() : now,
    }));

    // Hudud landing sahifalari: faqat haqiqatan faol e'loni bor kombinatsiyalar
    const landingRows = await queryAll<{ region_id: string; slug: string; c: number | string }>(
      `SELECT l.region_id, c.slug, COUNT(*) AS c
       FROM listings l
       JOIN categories c ON l.category_id = c.id
       WHERE l.status = 'ACTIVE'
       GROUP BY l.region_id, c.slug
       ORDER BY c DESC
       LIMIT 3000`
    );
    const regionHubSeen = new Set<string>();
    const landingUrls: { loc: string; priority: string; changefreq: string; lastmod: string }[] = [];
    for (const row of landingRows) {
      const rslug = regionIdToSlug(row.region_id);
      if (!regionHubSeen.has(rslug)) {
        regionHubSeen.add(rslug);
        landingUrls.push({ loc: `${base}/hudud/${rslug}`, priority: '0.8', changefreq: 'daily', lastmod: now });
      }
      landingUrls.push({ loc: `${base}/hudud/${rslug}/${row.slug}`, priority: '0.7', changefreq: 'daily', lastmod: now });
    }

    const all = [...staticUrls, ...landingUrls, ...listingUrls];
    const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      all
        .map(
          (u) =>
            `  <url>\n` +
            `    <loc>${escapeXml(u.loc)}</loc>\n` +
            (u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : '') +
            `    <changefreq>${u.changefreq}</changefreq>\n` +
            `    <priority>${u.priority}</priority>\n` +
            `  </url>\n`
        )
        .join('') +
      `</urlset>\n`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(body);
  } catch (err: any) {
    res.status(500).set('Content-Type', 'text/plain').send('sitemap error');
  }
});

export default router;
