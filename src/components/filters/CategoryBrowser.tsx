// Qayta dizaynlangan KATEGORIYA SAHIFASI (Avito uslubi):
//   toolbar ostida → "top mashxur" qatori (yoki reklama sloti)
//   ikki ustun: [ filtr paneli (subkategoriyalar + atributlar + hudud + narx) | natijalar gridi ]
// Bu komponent sof presentational — barcha holat (listings, filtrlar, qidiruv) HomePage'da
// saqlanadi va props orqali keladi (shu sabab toolbar qidiruv / debounce / atribut yuklash
// xatti-harakatlari bu yerda ham bir xil ishlaydi).

import { Fragment, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  SlidersHorizontal, X, MapPin, ChevronDown, ArrowUpDown, Users, ArrowLeft,
} from 'lucide-react';
import { Listing, Category, CategoryAttribute, Region, District } from '../../types/index.ts';
import { ListingCard } from '../listings/ListingCard.tsx';
import { PopularRow } from '../filters/PopularRow.tsx';
import { SubcategoryLinks } from '../filters/SubcategoryLinks.tsx';
import { CategoryFilterPanel } from '../filters/CategoryFilterPanel.tsx';
import { AdSlot } from '../ads/AdSlot.tsx';
import { INLINE_AD_EVERY } from '../ads/adConfig.ts';
import { useAds } from '../../context/AdsContext.tsx';

type Setter = React.Dispatch<React.SetStateAction<Record<string, string | number>>>;

export interface CategoryBrowserProps {
  category?: Category;
  parentCategory?: Category;
  catalogName: string;
  subs: Category[];
  onSelectCategory: (id: string) => void;
  onNavigate: (route: string) => void;
  onOpenListing: (id: string) => void;

  listings: Listing[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  onLoadMore: () => void;

  attrSchema: CategoryAttribute[];
  attrFilters: Record<string, string | number>;
  setAttrFilters: Setter;
  onTogglePopular: (key: string, value: string) => void;

  regions: Region[];
  districts: District[];
  selectedRegionId?: string;
  setSelectedRegionId: (v?: string) => void;
  selectedDistrictId?: string;
  setSelectedDistrictId: (v?: string) => void;

  priceMin?: number;
  priceMax?: number;
  setPriceMin: (v?: number) => void;
  setPriceMax: (v?: number) => void;

  sortBy: string;
  setSortBy: (v: string) => void;
  user: boolean;
  onlyFollowed: boolean;
  setOnlyFollowed: (v: boolean) => void;

  activeFiltersCount: number;
  onReset: () => void;

  isMobileFiltersOpen: boolean;
  setIsMobileFiltersOpen: (v: boolean) => void;
}

// Narx oralig'i (Dan / Gacha) — blur/Enter'da qo'llanadi.
function PriceRange({
  priceMin, priceMax, setPriceMin, setPriceMax,
}: Pick<CategoryBrowserProps, 'priceMin' | 'priceMax' | 'setPriceMin' | 'setPriceMax'>) {
  const [minStr, setMinStr] = useState(priceMin != null ? String(priceMin) : '');
  const [maxStr, setMaxStr] = useState(priceMax != null ? String(priceMax) : '');
  useEffect(() => { setMinStr(priceMin != null ? String(priceMin) : ''); }, [priceMin]);
  useEffect(() => { setMaxStr(priceMax != null ? String(priceMax) : ''); }, [priceMax]);
  const apply = () => {
    setPriceMin(minStr ? parseInt(minStr, 10) : undefined);
    setPriceMax(maxStr ? parseInt(maxStr, 10) : undefined);
  };
  const digits = (v: string) => v.replace(/[^\d]/g, '');
  return (
    <div className="flex items-center gap-2">
      <input type="text" inputMode="numeric" placeholder="Dan" value={minStr}
        onChange={(e) => setMinStr(digits(e.target.value))} onBlur={apply}
        onKeyDown={(e) => { if (e.key === 'Enter') apply(); }}
        className="w-full bg-white border border-[#EBECF0] rounded-xl px-3 py-2 text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] placeholder-gray-400" />
      <span className="text-gray-400 shrink-0">—</span>
      <input type="text" inputMode="numeric" placeholder="Gacha" value={maxStr}
        onChange={(e) => setMaxStr(digits(e.target.value))} onBlur={apply}
        onKeyDown={(e) => { if (e.key === 'Enter') apply(); }}
        className="w-full bg-white border border-[#EBECF0] rounded-xl px-3 py-2 text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] placeholder-gray-400" />
    </div>
  );
}

export function CategoryBrowser(props: CategoryBrowserProps) {
  const { ads } = useAds();
  const inlineEvery = ads.inlineEvery > 0 ? ads.inlineEvery : INLINE_AD_EVERY;
  const {
    category, parentCategory, catalogName, subs, onSelectCategory, onNavigate, onOpenListing,
    listings, isLoading, isLoadingMore, isRefreshing, totalCount, currentPage, totalPages, onLoadMore,
    attrSchema, attrFilters, setAttrFilters, onTogglePopular,
    regions, districts, selectedRegionId, setSelectedRegionId, selectedDistrictId, setSelectedDistrictId,
    sortBy, setSortBy, user, onlyFollowed, setOnlyFollowed,
    activeFiltersCount, onReset,
    isMobileFiltersOpen, setIsMobileFiltersOpen,
  } = props;

  const title = category?.name_uz || 'Kategoriya';

  // Filtr paneli mazmuni — desktop ustun va mobil drawer ikkalasi ham shu blokdan foydalanadi.
  const panelBody = (
    <>
      {(parentCategory || category) && subs.length > 0 && (
        <SubcategoryLinks parent={parentCategory || category!} subs={subs} activeId={category?.id} onSelect={onSelectCategory} />
      )}

      {attrSchema.length > 0 && (
        <div className="mb-5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-[#5E6C84] font-semibold mb-2.5 block">
            Parametrlar
          </span>
          <CategoryFilterPanel attrSchema={attrSchema} attrFilters={attrFilters} setAttrFilters={setAttrFilters} />
        </div>
      )}

      <div className="mb-5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[#5E6C84] font-semibold mb-2.5 block">
          Hudud
        </span>
        <div className="space-y-2">
          <div className="relative">
            <select
              value={selectedRegionId || ''}
              onChange={(e) => { setSelectedRegionId(e.target.value || undefined); setSelectedDistrictId(undefined); }}
              className="w-full bg-white border border-[#EBECF0] rounded-xl px-3 py-2 text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] appearance-none pr-8 cursor-pointer"
            >
              <option value="">Barcha viloyatlar</option>
              {regions.map((r) => (<option key={r.id} value={r.id}>{r.name_uz}</option>))}
            </select>
            <MapPin className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {selectedRegionId && districts.length > 0 && (
            <div className="relative">
              <select
                value={selectedDistrictId || ''}
                onChange={(e) => setSelectedDistrictId(e.target.value || undefined)}
                className="w-full bg-white border border-[#1673E6]/40 rounded-xl px-3 py-2 text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] appearance-none pr-8 cursor-pointer"
              >
                <option value="">Barcha tumanlar</option>
                {districts.map((d) => (<option key={d.id} value={d.id}>{d.name_uz}</option>))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      <div className="mb-5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[#5E6C84] font-semibold mb-2.5 block">
          Narx oralig’i (UZS)
        </span>
        <PriceRange {...props} />
      </div>

      {activeFiltersCount > 0 && (
        <button
          type="button"
          onClick={() => { onReset(); setIsMobileFiltersOpen(false); }}
          className="w-full py-2.5 px-4 border border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 rounded-xl text-xs font-semibold text-rose-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
        >
          <X className="w-3.5 h-3.5" />
          <span>Filtrlarni tozalash ({activeFiltersCount})</span>
        </button>
      )}

      {/* Filtr paneli ostidagi reklama joyi */}
      <AdSlot placement="sidebar" variant="box" className="mt-5" />
    </>
  );

  return (
    <div className="max-w-[1440px] mx-auto w-full flex-1 flex flex-col px-3 sm:px-6 py-4 lg:py-6 min-h-[calc(100vh-64px)] overflow-x-hidden">
      {/* Header ostidagi, yopiladigan (dismissible) reklama banneri */}
      <AdSlot
        placement="top"
        variant="banner"
        dismissible
        storageKey="th_ad_top_v1"
        className="mb-4"
      />

      {/* Mashxur qatori / reklama sloti — toolbar ostida, to'liq kenglikda */}
      {category && (
        <PopularRow
          categoryId={category.id}
          categoryTitle={title}
          attrFilters={attrFilters}
          onToggle={onTogglePopular}
        />
      )}

      <div className="lg:grid lg:grid-cols-[280px_1fr] gap-6 flex-1 min-w-0">
        {/* Desktop filtr paneli */}
        <aside className="no-scrollbar hidden lg:block lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-96px)] lg:overflow-y-auto border-r border-[#EBECF0] pr-4 pb-8">
          {panelBody}
        </aside>

        {/* Mobil filtr drawer (bottom-sheet) — document.body'ga portal qilinadi,
            chunkim `main` ichida z-10 stacking context yaratadi va aks holda
            sheet header (toolbar z-40) va MobileNav (z-40) ORTIGA tushib qoladi. */}
        {isMobileFiltersOpen &&
          createPortal(
            <>
              <div
                className="lg:hidden th-backdrop fixed inset-0 z-[95]"
                onClick={() => setIsMobileFiltersOpen(false)}
                aria-hidden
              />
              <aside
                className="lg:hidden fixed left-2 right-2 z-[100] top-[15%] bottom-[calc(var(--mobile-nav-h)+8px+env(safe-area-inset-bottom))] overflow-y-auto bg-white rounded-3xl th-sheet px-4 pt-0 pb-0 shadow-2xl ring-1 ring-black/5"
              >
                <div className="sticky top-0 z-10 -mx-4 px-4 pt-2.5 pb-2.5 mb-2 bg-white rounded-t-3xl border-b border-[#EBECF0]">
                  <div className="mx-auto mb-2.5 h-1.5 w-10 rounded-full bg-gray-300" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-[#1673E6]" />
                      <span className="font-bold text-sm text-[#172B4D]">Filtrlar</span>
                    </div>
                    <button onClick={() => setIsMobileFiltersOpen(false)} className="p-2 -mr-2 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer" aria-label="Yopish">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                {panelBody}
                <div className="sticky bottom-0 z-10 -mx-4 mt-4 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] bg-white rounded-b-3xl border-t border-[#EBECF0]">
                  <button
                    onClick={() => setIsMobileFiltersOpen(false)}
                    className="w-full py-2.5 rounded-xl bg-[#1673E6] text-white font-bold text-sm active:scale-[.99] shadow-sm"
                  >
                    {totalCount.toLocaleString('ru-RU')} ta e’lonni ko‘rish
                  </button>
                </div>
              </aside>
            </>,
            document.body
          )}

        {/* Natijalar ustuni */}
        <div className="min-w-0 flex flex-col justify-between">
          {/* Sarlavha + boshqaruv */}
          <div className="mb-4">
            <button
              onClick={() => window.history.back()}
              className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#5E6C84] hover:text-[#1673E6] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Orqaga</span>
            </button>
            <nav className="flex items-center gap-1 text-[11px] text-[#5E6C84] mb-1.5 flex-wrap">
              <button onClick={() => onNavigate('/')} className="hover:text-[#1673E6] cursor-pointer">Bosh sahifa</button>
              <span>/</span>
              {catalogName && (<>
                <button onClick={() => onNavigate(`/?catalog=${category?.catalog_id || ''}`)} className="hover:text-[#1673E6] cursor-pointer">{catalogName}</button>
                <span>/</span>
              </>)}
              <span className="text-[#172B4D] font-semibold">{title}</span>
            </nav>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#172B4D] tracking-tight">{title}</h1>
                <p className="text-xs sm:text-sm text-[#5E6C84] mt-1">
                  {totalCount > 0 ? `${totalCount.toLocaleString('ru-RU')} ta taklif topildi` : 'E’lonlar qidirilmoqda...'}
                </p>
              </div>

              <div className="flex shrink-0 flex-nowrap items-center gap-2">
                {/* Mobil filtr tugmasi */}
                <button
                  onClick={() => setIsMobileFiltersOpen(true)}
                  className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 border border-[#EBECF0] rounded-xl text-xs font-semibold text-[#172B4D] hover:bg-gray-50"
                >
                  <SlidersHorizontal className="w-4 h-4 text-[#1673E6]" />
                  <span>Filtrlar</span>
                  {activeFiltersCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">{activeFiltersCount}</span>
                  )}
                </button>

                {user && (
                  <button
                    type="button"
                    onClick={() => setOnlyFollowed(!onlyFollowed)}
                    className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      onlyFollowed ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50 text-[#172B4D] border-[#EBECF0]'
                    }`}
                    title="Faqat obunalarim"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Obunalarim</span>
                  </button>
                )}

                <div className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-[#EBECF0] bg-white pl-2.5 pr-1.5 sm:hidden">
                  <ArrowUpDown className="h-4 w-4 shrink-0 text-[#5E6C84]" />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="max-w-[110px] cursor-pointer appearance-none truncate bg-transparent text-xs font-medium text-[#172B4D] focus:outline-hidden">
                    <option value="newest">Yangi</option>
                    <option value="price_asc">Arzon</option>
                    <option value="price_desc">Qimmat</option>
                    <option value="rating_desc">Reyting</option>
                  </select>
                </div>
                <select
                  value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                  className="hidden cursor-pointer rounded-xl border border-[#EBECF0] bg-white px-3 py-1.5 text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] sm:inline-block"
                >
                  <option value="newest">Eng yangilari</option>
                  <option value="price_asc">Narx: pastdan yuqoriga</option>
                  <option value="price_desc">Narx: yuqoridan pastga</option>
                  <option value="rating_desc">Reytingi yuqorilar</option>
                </select>
              </div>
            </div>
          </div>

          {isRefreshing && (
            <div className="h-0.5 w-full rounded-full bg-blue-100 overflow-hidden mb-3">
              <div className="h-full w-1/3 rounded-full bg-blue-500 animate-pulse" />
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="border border-[#EBECF0] rounded-2xl overflow-hidden bg-white animate-pulse">
                  <div className="aspect-square bg-gray-100" />
                  <div className="p-3 space-y-2">
                    <div className="h-3.5 w-3/4 bg-gray-100 rounded" />
                    <div className="h-3 w-1/2 bg-gray-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="bg-[#F9FAFB] rounded-3xl border border-[#EBECF0] p-12 text-center max-w-md mx-auto my-8">
              <div className="w-16 h-16 rounded-full bg-blue-50 text-[#1673E6] flex items-center justify-center text-2xl mx-auto mb-3">🔍</div>
              <h3 className="font-bold text-base text-[#172B4D]">Mos e’lonlar topilmadi</h3>
              <p className="text-xs text-[#5E6C84] mt-1 mb-5">Filtrlarni tozalab yoki qidiruv so‘zini o‘zgartirib ko‘ring.</p>
              <button onClick={onReset} className="px-5 py-2.5 rounded-xl bg-[#1673E6] hover:bg-blue-700 text-white font-bold text-xs cursor-pointer">Barcha filtrlarni tozalash</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4">
              {listings.map((listing, idx) => (
                <Fragment key={listing.id}>
                  <ListingCard listing={listing} variant="grid" onClick={() => onOpenListing(listing.id)} />
                  {/* E'lonlar orasida, xuddi e'lon kartidek reklama */}
                  {(idx + 1) % inlineEvery === 0 && (
                    <AdSlot placement="inline" variant="card" />
                  )}
                </Fragment>
              ))}
            </div>
          )}

          {currentPage < totalPages && (
            <div className="py-10 flex justify-center">
              <button
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="bg-transparent border border-[#EBECF0] hover:border-[#1673E6] hover:bg-blue-50/20 px-8 py-3 rounded-xl text-[#1673E6] font-bold text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-2"
              >
                <span>{isLoadingMore ? 'Yuklanmoqda...' : 'Yana yuklash'}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
