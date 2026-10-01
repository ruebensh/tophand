import { Router } from 'express';
import { queryAll } from '../db/database.ts';

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

    const all = [...staticUrls, ...listingUrls];
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
