// ─── SPA per-sahifa <head> SEO boshqaruvi ─────────────────────────────────
// index.html barcha yo'llar uchun bir xil servis qilinadi (SPA). Shuning uchun
// har sahifa o'z title/description/canonical/JSON-LD'ini JS orqali qo'yishi,
// sahifadan chiqqanda esa asl (bosh sahifa) qiymatlariga qaytishi kerak — aks
// holda Google barcha URL'larni bosh sahifaning nusxasi deb konsolidatsiya qiladi.

interface SeoDefaults {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  og: { title: string; description: string; url: string; image: string };
}

const DEFAULT_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

let defaults: SeoDefaults | null = null;

function getMeta(attr: 'name' | 'property', key: string): string {
  return document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)?.getAttribute('content') || '';
}

export function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function setCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

/** `<script type="application/ld+json" id=...>` qo'yish yoki o'chirish (null). */
export function setJsonLd(id: string, data: unknown | null): void {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (data == null) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.id = id;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function captureDefaults(): SeoDefaults {
  return {
    title: document.title,
    description: getMeta('name', 'description'),
    canonical:
      document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ||
      window.location.origin + '/',
    robots: getMeta('name', 'robots'),
    og: {
      title: getMeta('property', 'og:title'),
      description: getMeta('property', 'og:description'),
      url: getMeta('property', 'og:url'),
      image: getMeta('property', 'og:image'),
    },
  };
}

export interface PageSeo {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  robots?: string;
  jsonLdId?: string;
  jsonLd?: unknown;
}

/** Sahifa ochilganda chaqiriladi — birinchi ishlatishda aslqiymatlar saqlanadi. */
export function applyPageSeo(opts: PageSeo): void {
  if (!defaults) defaults = captureDefaults();
  document.title = opts.title;
  setMeta('name', 'description', opts.description);
  setCanonical(opts.canonical);
  setMeta('property', 'og:title', opts.title);
  setMeta('property', 'og:description', opts.description);
  setMeta('property', 'og:url', opts.canonical);
  if (opts.ogImage) setMeta('property', 'og:image', opts.ogImage);
  setMeta('name', 'robots', opts.robots || DEFAULT_ROBOTS);
  if (opts.jsonLdId) setJsonLd(opts.jsonLdId, opts.jsonLd ?? null);
}

/** Sahifadan chiqqanda — asl (bosh sahifa) head holatiga qaytarish. */
export function restoreDefaultSeo(jsonLdIds: string[] = []): void {
  if (!defaults) return; // hech qachon o'zgartirilmagan — tinch qolamiz
  document.title = defaults.title;
  setMeta('name', 'description', defaults.description);
  setCanonical(defaults.canonical);
  setMeta('name', 'robots', defaults.robots || DEFAULT_ROBOTS);
  setMeta('property', 'og:title', defaults.og.title);
  setMeta('property', 'og:description', defaults.og.description);
  setMeta('property', 'og:url', defaults.og.url);
  setMeta('property', 'og:image', defaults.og.image);
  jsonLdIds.forEach((id) => setJsonLd(id, null));
}
