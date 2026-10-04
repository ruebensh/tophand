import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, MapPin, Loader2, SearchX } from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import { Listing } from '../types/index.ts';
import { ListingCard } from '../components/listings/ListingCard.tsx';

interface LandingData {
  region: { id: string; name_uz: string; slug: string };
  category?: { id: string; name_uz: string; slug: string };
  count: number;
  listings: Listing[];
  total: number;
}

interface Props {
  regionSlug: string;
  categorySlug?: string;
  onNavigate: (route: string) => void;
  onOpenListing: (id: string) => void;
}

// SPA ichida sahifa almashtirilganda HTML head meta'larni yangilash
function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}
function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

export const RegionCategoryPage: React.FC<Props> = ({ regionSlug, categorySlug, onNavigate, onOpenListing }) => {
  const [data, setData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const params = new URLSearchParams({ region: regionSlug });
      if (categorySlug) params.set('category', categorySlug);
      const res = await apiRequest<LandingData>(`/api/seo/landing?${params.toString()}`);
      setData(res);

      const base = window.location.origin;
      const title = res.category
        ? `${res.category.name_uz} — ${res.region.name_uz}: ${res.count} ta e'lon | TopHand`
        : `${res.region.name_uz} — xizmatlar va ish e'lonlari | TopHand`;
      const desc = res.category
        ? `${res.region.name_uz} bo'yicha ${res.category.name_uz} xizmatlari va e'lonlari (${res.count} ta). Narxlar, telefon raqamlari va mutaxassislar — TopHand'da.`
        : `${res.region.name_uz} bo'ylab mahalliy xizmatlar, mutaxassislar va ish e'lonlari. ${res.count} ta faol e'lon.`;
      document.title = title;
      setMeta('description', desc);
      setMeta('og:title', title, 'property');
      setMeta('og:description', desc, 'property');
      setCanonical(`${base}/hudud/${regionSlug}${categorySlug ? `/${categorySlug}` : ''}`);
    } catch (e: any) {
      if (String(e.message || '').includes('404') || String(e.message || '').includes('topilmadi')) {
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  }, [regionSlug, categorySlug]);

  useEffect(() => {
    load();
  }, [load]);

  const heading = data?.category
    ? `${data.category.name_uz} — ${data.region.name_uz}`
    : data?.region
      ? `${data.region.name_uz} e'lonlari`
      : '';

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-gray-500 mb-3 flex-wrap">
        <button onClick={() => onNavigate('/')} className="hover:text-blue-600 font-medium cursor-pointer">Bosh sahifa</button>
        <ChevronRight className="w-3.5 h-3.5" />
        {data && (
          <button
            onClick={() => onNavigate(`/hudud/${regionSlug}`)}
            className={`hover:text-blue-600 font-medium cursor-pointer ${data.category ? '' : 'text-gray-900'}`}
          >
            {data.region.name_uz}
          </button>
        )}
        {data?.category && (
          <>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-gray-900 font-medium">{data.category.name_uz}</span>
          </>
        )}
      </nav>

      {loading && (
        <div className="flex items-center justify-center py-24 text-gray-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Yuklanmoqda…</span>
        </div>
      )}

      {!loading && notFound && (
        <div className="text-center py-24">
          <SearchX className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h1 className="text-lg font-extrabold text-gray-900">Bo'lim topilmadi</h1>
          <p className="text-sm text-gray-500 mt-1">Ushbu hudud yoki kategoriya mavjud emas yoki e'lonlar yo'q.</p>
          <button
            onClick={() => onNavigate('/')}
            className="mt-5 px-5 py-2.5 rounded-full bg-blue-600 text-white text-xs font-bold cursor-pointer"
          >
            Bosh sahifaga qaytish
          </button>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Sarlavha + tavsif */}
          <header className="mb-5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600 shrink-0" />
              <span>{heading}</span>
            </h1>
            <p className="text-sm text-gray-600 mt-1.5 max-w-3xl leading-relaxed">
              {data.count} ta e'lon.{' '}
              {data.category
                ? `${data.region.name_uz} bo'yicha ${data.category.name_uz} xizmatlari va mutaxassislarini toping — narxlar, telefon raqamlari va bog'lanish bir joyda.`
                : `${data.region.name_uz} bo'ylab xizmatlar, mutaxassislar va ish e'lonlarini ko'ring va bepul joylang.`}
            </p>
          </header>

          {/* E'lonlar grid */}
          {data.listings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {data.listings.map((l) => (
                <ListingCard key={l.id} listing={l} onClick={() => onOpenListing(l.id)} variant="grid" />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <p className="text-sm text-gray-500">Hozircha bu yo'nalishda faol e'lonlar yo'q.</p>
              <button
                onClick={() => onNavigate('/create')}
                className="mt-4 px-5 py-2.5 rounded-full bg-blue-600 text-white text-xs font-bold cursor-pointer"
              >
                Birinchi e'lonni joylash
              </button>
            </div>
          )}

          {/* Ichki havolalar (SEO) */}
          <div className="mt-8 flex flex-wrap items-center gap-2 text-xs">
            <button onClick={() => onNavigate('/categories')} className="px-3 py-2 rounded-xl bg-white border border-gray-200 hover:border-blue-400 font-semibold text-gray-700 cursor-pointer">
              Barcha kataloglar
            </button>
            {data.category && (
              <button onClick={() => onNavigate(`/hudud/${regionSlug}`)} className="px-3 py-2 rounded-xl bg-white border border-gray-200 hover:border-blue-400 font-semibold text-gray-700 cursor-pointer">
                {data.region.name_uz} — barcha yo'nalishlar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default RegionCategoryPage;
