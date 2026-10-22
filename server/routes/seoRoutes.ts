import { serverError } from '../lib/error.ts';
import { Router } from 'express';
import { queryAll } from '../db/database.ts';
import { resolveLanding } from '../services/seoService.ts';
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
    serverError(res, err);
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
      // Admin panel yo'li ENDI robots'da yozilmaydi — u kodsimon YASHIRIN manzil
      // (/th-adm-...), robots esa ochiq fayl: yozib qo'ysak yo'lni botlarga
      // sovg'a qilgan bo'lamiz. Hech qayerda link qilinmagani uchun crawler
      // topa olmaydi ham.
      'Disallow: /moderator',
      'Disallow: /chat',
      'Disallow: /saved',
      '',
      `Sitemap: ${base}/sitemap.xml`,
      '',
    ].join('\n')
  );
});

// ─── sitemap.xml (statik + kategoriya landing + sifatli e'lonlar + rasmlar) ─

/** Bitta <url> yozuvi — ixtiyoriy <image:image> bilan (Google Image sitemap). */
interface SitemapEntry {
  loc: string;
  priority: string;
  changefreq: string;
  lastmod?: string;
  image?: { loc: string; title: string };
}

router.get('/sitemap.xml', async (req, res) => {
  try {
    const base = siteBase(req);

    // Statik/yuqori ustuvorlikli sahifalar — Google'da faqat bosh sahifa va
    // "biz haqimizda" ko'rsatilishi kerak. contact/terms/privacy noindex (sahifada),
    // shuning uchun sitemap'da ham emas. Kategoriyalar /hudud/:shahar/:kategoriya
    // landing'lari orqali indekslanadi (quydagi landingUrls).
    //
    // Faol (ACTIVE) SIFATLI e'lonlar — Google indekslashi uchun. Frontend
    // ListingDetailPage ham xuddi shu mezon (rasm + tavsif>=40) bilan indexlay,
    // qolganlarida noindex qo'yadi — shuning uchun sitemap ham shularni beradi.
    // Har bir e'lon uchun cover rasmi ham olinadi (Google Image sitemap).
    const listings = await queryAll<{
      id: string;
      title: string;
      updated_at: string | Date;
      image_url: string | null;
    }>(
      `SELECT l.id, l.title, l.updated_at,
         (SELECT url FROM listing_images li
           WHERE li.listing_id = l.id AND COALESCE(li.media_type,'image') = 'image'
           ORDER BY li.sort_order ASC LIMIT 1) AS image_url
       FROM listings l
       WHERE l.status = 'ACTIVE'
         AND length(btrim(l.description)) >= 40
         AND EXISTS (SELECT 1 FROM listing_images li WHERE li.listing_id = l.id)
       ORDER BY l.updated_at DESC LIMIT 50000`
    );

    // Haqiqiy "oxirgi yangilanish" — so'rov vaqti EMAS, kontentning oxirgi tahriri.
    // Google o'sib boruvchi soxta lastmod'ni e'tiborsiz qoldiradi.
    const newest = listings.reduce<string>(
      (acc, l) => {
        const iso = l.updated_at ? new Date(l.updated_at).toISOString() : '';
        return iso > acc ? iso : acc;
      },
      ''
    );

    // Nispiy (/uploads/..) yoki to'liq (R2) rasm URL'ni absolut kanonik URL'ga keltiradi.
    const absImage = (u: string): string =>
      /^https?:\/\//i.test(u) ? u : `${base}${u.startsWith('/') ? '' : '/'}${u}`;

    const listingUrls: SitemapEntry[] = listings.map((l) => ({
      loc: `${base}/listing/${l.id}`,
      priority: '0.7',
      changefreq: 'daily',
      lastmod: l.updated_at ? new Date(l.updated_at).toISOString() : (newest || undefined),
      image: l.image_url ? { loc: absImage(l.image_url), title: l.title } : undefined,
    }));

    // Katalog sahifalari: /?catalog=<id> — har bir faol katalog alohida indekslanadi.
    // Dinamik: admin panel'dan yangi katalog qo'shilsa, `catalogs` jadvalidan o'qilib
    // avtomatik sitemap'ga tushadi. lastmod = o'sha katalogdagi oxirgi e'lon vaqti.
    // E'LT: shaharlar (/hudud/*) endi umuman indekslanmaydi — sitemap'da yo'q.
    const catalogRows = await queryAll<{
      id: string; name_uz: string; lastmod: string | Date | null;
    }>(
      `SELECT cat.id, cat.name_uz, MAX(l.updated_at) AS lastmod
       FROM catalogs cat
       LEFT JOIN categories kc ON kc.catalog_id = cat.id
       LEFT JOIN listings l ON l.category_id = kc.id AND l.status = 'ACTIVE'
       WHERE cat.is_active = 1
       GROUP BY cat.id, cat.name_uz
       ORDER BY cat.sort_order ASC`
    );
    const catalogUrls: SitemapEntry[] = catalogRows.map((row) => ({
      loc: `${base}/?catalog=${encodeURIComponent(row.id)}`,
      priority: '0.8',
      changefreq: 'daily',
      lastmod: row.lastmod ? new Date(row.lastmod).toISOString() : (newest || undefined),
    }));

    const staticUrls: SitemapEntry[] = [
      { loc: `${base}/`, priority: '1.0', changefreq: 'daily', lastmod: newest || undefined },
      { loc: `${base}/about`, priority: '0.4', changefreq: 'monthly' },
    ];

    const all: SitemapEntry[] = [...staticUrls, ...catalogUrls, ...listingUrls];
    const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
      `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
      all
        .map(
          (u) =>
            `  <url>\n` +
            `    <loc>${escapeXml(u.loc)}</loc>\n` +
            (u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : '') +
            `    <changefreq>${u.changefreq}</changefreq>\n` +
            `    <priority>${u.priority}</priority>\n` +
            (u.image
              ? `    <image:image>\n` +
                `      <image:loc>${escapeXml(u.image.loc)}</image:loc>\n` +
                `      <image:title>${escapeXml(u.image.title)}</image:title>\n` +
                `    </image:image>\n`
              : '') +
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
