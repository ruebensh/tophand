import { queryOne } from '../db/database.ts';

// ─── Kanonik sayt bazasi ────────────────────────────────────────────────
function siteBase(): string {
  return (process.env.SITE_URL || 'https://tophand.uz').replace(/\/$/, '');
}

// ─── Hudud slugi (deterministik): reg_toshkent_sh <-> toshkent-sh ─────────
export function regionIdToSlug(id: string): string {
  return id.replace(/^reg_/, '').replace(/_/g, '-');
}
export function regionSlugToId(slug: string): string {
  return 'reg_' + slug.replace(/-/g, '_');
}

export interface LandingData {
  region: { id: string; name_uz: string; slug: string };
  category?: { id: string; name_uz: string; slug: string };
  count: number;
}

/** Hudud (+kategoriya) sluglari bo'yicha landing ma'lumoti. Topilmasa null. */
export async function resolveLanding(
  regionSlug: string,
  categorySlug?: string
): Promise<LandingData | null> {
  const regionId = regionSlugToId(regionSlug);
  const region = await queryOne<{ id: string; name_uz: string }>(
    'SELECT id, name_uz FROM regions WHERE id = ?',
    [regionId]
  );
  if (!region) return null;

  let category: { id: string; name_uz: string; slug: string } | undefined;
  if (categorySlug) {
    category =
      (await queryOne<{ id: string; name_uz: string; slug: string }>(
        'SELECT id, name_uz, slug FROM categories WHERE slug = ?',
        [categorySlug]
      )) || undefined;
    if (!category) return null;
  }

  let countRow: { c: number | string } | null;
  if (category) {
    countRow = await queryOne<{ c: number | string }>(
      `SELECT COUNT(*) AS c FROM listings
       WHERE status = 'ACTIVE' AND region_id = ?
         AND (category_id = ? OR category_id IN (SELECT id FROM categories WHERE parent_id = ?))`,
      [region.id, category.id, category.id]
    );
  } else {
    countRow = await queryOne<{ c: number | string }>(
      `SELECT COUNT(*) AS c FROM listings WHERE status = 'ACTIVE' AND region_id = ?`,
      [region.id]
    );
  }

  return {
    region: { id: region.id, name_uz: region.name_uz, slug: regionSlug },
    category,
    count: Number(countRow?.c || 0),
  };
}

function escAttr(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(s: string): string {
  return (s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// SECURITY (H-08): JSON.stringify does NOT escape `<` `>` `&` or the JS line
// separators U+2028/U+2029. A listing title containing `</script>` would break
// out of the inline <script type="application/ld+json"> block → stored XSS.
// We keep it valid JSON but escape those code points so the value can never
// terminate the script context. JSON.parse reads the \u escapes back verbatim.
function safeJsonScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function formatUz(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

interface SeoMeta {
  title: string;
  description: string;
  canonical: string;
  ogType: string;
  image?: string;
  jsonLd?: any;
}

// ─── Listing uchun meta ──────────────────────────────────────────────────
async function buildListingMeta(id: string): Promise<SeoMeta | null> {
  const base = siteBase();
  const l = await queryOne<any>(
    `SELECT l.id, l.title, l.description, l.type, l.price_type, l.price_min, l.price_max, l.currency,
            c.name_uz AS category_name, r.name_uz AS region_name, d.name_uz AS district_name,
            (SELECT url FROM listing_images WHERE listing_id = l.id ORDER BY sort_order LIMIT 1) AS cover_image
     FROM listings l
     JOIN categories c ON l.category_id = c.id
     JOIN regions r ON l.region_id = r.id
     JOIN districts d ON l.district_id = d.id
     WHERE l.id = ? AND l.status = 'ACTIVE'`,
    [id]
  );
  if (!l) return null;

  const isJob = l.type === 'JOB_OPENING' || l.type === 'JOB_SEEKER';

  // Narx matni
  let priceText = '';
  if (l.price_type === 'FREE') priceText = 'Bepul';
  else if (l.price_type === 'NEGOTIABLE') priceText = 'Kelishuvchan';
  else if (l.price_min != null) {
    priceText = `${formatUz(Number(l.price_min))} ${l.currency || "so'm"}`;
    if (l.price_type === 'FROM') priceText += 'dan';
  }

  const plainDesc = stripHtml(l.description);
  const title = `${l.title} — ${l.district_name || l.region_name}, ${l.region_name} | TopHand`;
  const description = `${plainDesc.slice(0, 140)}${plainDesc.length > 140 ? '…' : ''} ${l.category_name} · ${priceText || 'TopHand bozorida'}.`;

  const image = l.cover_image
    ? (l.cover_image.startsWith('http') ? l.cover_image : `${base}${l.cover_image.startsWith('/') ? '' : '/'}${l.cover_image}`)
    : undefined;

  const jsonLd: any = isJob
    ? {
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: l.title,
        description: plainDesc || l.title,
        employmentType: 'OTHER',
        hiringOrganization: { '@type': 'Organization', name: 'TopHand' },
        jobLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: l.district_name || l.region_name,
            addressRegion: l.region_name,
            addressCountry: 'UZ',
          },
        },
        ...(l.price_min != null
          ? { baseSalary: { '@type': 'MonetaryAmount', currency: l.currency || 'UZS', value: Number(l.price_min) } }
          : {}),
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: l.title,
        description: plainDesc || l.title,
        serviceType: l.category_name,
        areaServed: [
          { '@type': 'AdministrativeArea', name: l.region_name },
          { '@type': 'AdministrativeArea', name: l.district_name },
        ].filter((x) => x.name),
        provider: { '@type': 'Organization', name: 'TopHand', url: base },
        ...(l.price_min != null
          ? {
              offers: {
                '@type': 'Offer',
                priceCurrency: l.currency || 'UZS',
                price: Number(l.price_min),
                availability: 'https://schema.org/InStock',
                url: `${base}/listing/${l.id}`,
              },
            }
          : {}),
      };

  return {
    title,
    description,
    canonical: `${base}/listing/${l.id}`,
    ogType: isJob ? 'article' : 'website',
    image,
    jsonLd,
  };
}

// ─── Axborot/huquqiy sahifalar meta (QA-05) ─────────────────────────────
// E'lon va hudud landing'dan tashqari, /about /terms /privacy /contact sahifalari
// ham client-side (LegalPage) render qilinadi. Ularga alohida meta/canonical
// bermasak, server statik index.html'ni (kanonik = bosh sahifa) yuboradi va
// Google har bir legal sahifani bosh sahifa deb indekslab qo'yadi (QA-05).
const LEGAL_PAGES: Record<string, { title: string; description: string }> = {
  '/about': {
    title: "Biz haqimizda — TopHand jamoasi va missiyasi | TopHand",
    description:
      "TopHand — O'zbekistondagi ko'p tarmoqli onlayn bozor. Missiyamiz: mahalliy xizmatlar, tovarlar va ish e'lonlarini bitta platformada yig'ib, odamlar va ustalar o'rtasidagi ishonchni oshirish.",
  },
  '/terms': {
    title: "Foydalanish shartlari | TopHand",
    description:
      "TopHand'dan foydalanish qoidalari: e'lon joylash tartibi, foydalanuvchi majburiyatlari, mas'uliyat va shartnoma shartlari.",
  },
  '/privacy': {
    title: "Maxfiylik siyosati | TopHand",
    description:
      "TopHand shaxsiy ma'lumotlarni yig'ish, ishlatish va himoya qilish siyosati. Foydalanuvchi huquqlari va ma'lumotlar xavfsizligi.",
  },
  '/contact': {
    title: "Aloqa — TopHand bilan bog'lanish | TopHand",
    description:
      "TopHand jamoasi bilan bog'laning: yordam, hamkorlik, shikoyat va savollar uchun aloqa kanallari.",
  },
};

function buildLegalMeta(pathKey: string): SeoMeta | null {
  const base = siteBase();
  const info = LEGAL_PAGES[pathKey];
  if (!info) return null;
  return {
    title: info.title,
    description: info.description,
    canonical: `${base}${pathKey}`,
    ogType: 'website',
  };
}

// ─── Hudud landing sahifasi meta ─────────────────────────────────────────
async function buildLandingMeta(
  regionSlug: string,
  categorySlug?: string
): Promise<SeoMeta | null> {
  const base = siteBase();
  const data = await resolveLanding(regionSlug, categorySlug);
  if (!data) return null;
  const { region, category, count } = data;

  const canonical = categorySlug
    ? `${base}/hudud/${regionSlug}/${categorySlug}`
    : `${base}/hudud/${regionSlug}`;

  const title = category
    ? `${category.name_uz} — ${region.name_uz}: ${count} ta e'lon | TopHand`
    : `${region.name_uz} — xizmatlar va ish e'lonlari | TopHand`;

  const description = category
    ? `${region.name_uz} bo'yicha ${category.name_uz} xizmatlari va e'lonlari (${count} ta). Narxlar, telefon raqamlari va mutaxassislarni TopHand'dan toping — bepul e'lon joylang.`
    : `${region.name_uz} bo'ylab mahalliy xizmatlar, mutaxassislar va ish e'lonlari. ${count} ta faol e'lon — TopHand platformasida.`;

  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'TopHand', url: base },
    about: {
      '@type': 'Place',
      name: region.name_uz,
      containedInPlace: { '@type': 'Country', name: "O'zbekiston" },
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: count,
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Bosh sahifa', item: base + '/' },
        { '@type': 'ListItem', position: 2, name: region.name_uz, item: `${base}/hudud/${regionSlug}` },
        ...(category
          ? [{ '@type': 'ListItem', position: 3, name: category.name_uz, item: canonical }]
          : []),
      ],
    },
  };

  return { title, description, canonical, ogType: 'website', jsonLd };
}

// ─── Yo'nalish bo'yicha meta (kesh bilan) ────────────────────────────────
type CacheEntry = { meta: SeoMeta | null; ts: number };
const cache = new Map<string, CacheEntry>();
const TTL = 5 * 60 * 1000;

export async function getSeoMeta(path: string): Promise<SeoMeta | null> {
  const clean = path.split('?')[0].split('#')[0];

  const listingMatch = clean.match(/^\/listing\/([^/]+)/);
  if (listingMatch) {
    const id = listingMatch[1];
    const key = `listing:${id}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < TTL) return hit.meta;
    const meta = await buildListingMeta(id);
    cache.set(key, { meta, ts: Date.now() });
    return meta;
  }

  // /categories sahifasi App.tsx'da OLIB TASHLANGAN (QA-04) — kategoriyalar
  // Header mega-menyu orqali ko'rsatiladi. Shuning uchun bu yo'l uchun alohida
  // meta YO'Q; /categories HomePage'ga tushadi va statik kanonik (/) qaytadi.

  // Axborot/huquqiy sahifalar (QA-05): /about /terms /privacy /contact
  const legalKey = clean.replace(/\/+$/, '');
  if (legalKey in LEGAL_PAGES) return buildLegalMeta(legalKey);

  // Hudud landing: /hudud/:regionSlug/:categorySlug? (kesh bilan)
  const hududMatch = clean.match(/^\/hudud\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (hududMatch) {
    const regionSlug = hududMatch[1];
    const categorySlug = hududMatch[2];
    const key = `landing:${regionSlug}:${categorySlug || ''}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < TTL) return hit.meta;
    const meta = await buildLandingMeta(regionSlug, categorySlug);
    cache.set(key, { meta, ts: Date.now() });
    return meta;
  }

  // Bosh sahifa va qolganlar — index.html'dagi statik SEO yetarli
  return null;
}

// ─── HTML'ga metani quyish (replace) ────────────────────────────────────
export function injectSeo(html: string, meta: SeoMeta): string {
  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${escAttr(meta.title)}</title>`);
  out = out.replace(
    /<meta[^>]*name=["']description["'][^>]*>/i,
    `<meta name="description" content="${escAttr(meta.description)}" />`
  );
  out = out.replace(
    /<link[^>]*rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${escAttr(meta.canonical)}" />`
  );
  out = out.replace(
    /<meta[^>]*property=["']og:title["'][^>]*>/i,
    `<meta property="og:title" content="${escAttr(meta.title)}" />`
  );
  out = out.replace(
    /<meta[^>]*property=["']og:description["'][^>]*>/i,
    `<meta property="og:description" content="${escAttr(meta.description)}" />`
  );
  out = out.replace(
    /<meta[^>]*property=["']og:url["'][^>]*>/i,
    `<meta property="og:url" content="${escAttr(meta.canonical)}" />`
  );
  out = out.replace(
    /<meta[^>]*property=["']og:type["'][^>]*>/i,
    `<meta property="og:type" content="${meta.ogType}" />`
  );
  if (meta.image) {
    out = out.replace(
      /<meta[^>]*property=["']og:image["'][^>]*>/i,
      `<meta property="og:image" content="${escAttr(meta.image)}" />`
    );
    out = out.replace(
      /<meta[^>]*name=["']twitter:image["'][^>]*>/i,
      `<meta name="twitter:image" content="${escAttr(meta.image)}" />`
    );
  }
  if (meta.jsonLd) {
    const ld = `<script type="application/ld+json">${safeJsonScript(meta.jsonLd)}</script>`;
    out = out.replace('</head>', `${ld}\n  </head>`);
  }
  return out;
}
