import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Listing, Category, ListingType, Region, District, CategoryAttribute, Catalog } from '../types/index.ts';
import { apiRequest, getCategoryAttributes } from '../lib/api.ts';
import { ListingCard } from '../components/listings/ListingCard.tsx';
import { CategoryFilter } from '../components/listings/CategoryFilter.tsx';
import { CategoryIcon, CategoryChip } from '../components/common/CategoryIcon.tsx';
import { NearbyMapModal } from '../components/modals/NearbyMapModal.tsx';
import {
  Search,
  MapPin,
  ChevronDown,
  SlidersHorizontal,
  X,
  RotateCcw,
  Users,
  Briefcase,
  Star,
  Layers,
  Navigation,
  Loader2,
  Wrench,
  ClipboardList,
  UserRound,
  ArrowUpDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useGeo } from '../context/GeoContext.tsx';

interface HomePageProps {
  initialType?: ListingType;
  onNavigate: (route: string) => void;
  onOpenListing: (id: string) => void;
}

// Bosh sahifa / katalog-landing kartochkasi — Avito uslubida: nomi tepada-chapda,
// rasm (PNG) o'ng pastda. PNG bo'lmasa ikonka (CategoryChip) ko'rsatiladi.
// Bosh sahifada: imgSrc=/catalogs/<id>.png. Katalog landingda: /categories/<catalogId>/<id>.png.
interface TileProps {
  label: string;
  icon: string;
  imgSrc: string;
  tone?: string;
  index: number;
  count?: number;
  onOpen: () => void;
}
const CatalogTile: React.FC<TileProps> = ({ label, icon, imgSrc, tone, index, count, onOpen }) => {
  // Faqat shaffof fonli PNG ishlatiladi — e'lon fotolari (cover_image) o'z foni bilan
  // kelgani uchun endi ishlatilmaydi; PNG bo'lmasa toza ikonka ko'rsatiladi.
  const [imgFailed, setImgFailed] = useState(false);
  const src = imgFailed ? '' : imgSrc;
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ '--d': `${index * 60}ms` } as React.CSSProperties}
      className="group th-card-in th-gpu th-isolate relative flex h-[92px] w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border border-white/70 bg-gradient-to-br from-white/60 to-white/25 p-2 shadow-[0_8px_24px_rgba(23,43,77,0.10)] ring-1 ring-black/5 backdrop-blur-md transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:from-white/75 hover:to-white/45 hover:shadow-[0_18px_44px_rgba(23,43,77,0.20)] cursor-pointer sm:h-[108px] sm:flex-row sm:items-stretch sm:justify-start sm:gap-0 sm:p-0 sm:pl-4 sm:pr-0 sm:pt-3.5"
    >
      <span className="th-shine" aria-hidden />
      <span className="z-10 order-2 w-full text-center text-[10px] font-bold leading-tight text-[#172B4D] line-clamp-2 transition-transform duration-300 group-hover:-translate-y-0.5 sm:order-1 sm:w-auto sm:max-w-[58%] sm:self-start sm:text-left sm:text-[13px]">
        {label}
        {typeof count === 'number' && count > 0 && (
          <span className="mt-0.5 block text-[9px] font-medium text-[#5E6C84] sm:mt-1 sm:text-[11px]">
            {count.toLocaleString('ru-RU')} ta e’lon
          </span>
        )}
      </span>
      {src ? (
        <span className="pointer-events-none order-1 flex h-[46px] w-full shrink-0 items-end justify-center sm:order-2 sm:ml-auto sm:h-[80%] sm:w-auto sm:max-w-[52%] sm:self-end">
          <img
            src={src}
            alt={label}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-110 sm:object-right"
          />
        </span>
      ) : (
        <span className="pointer-events-none order-1 flex w-full justify-center sm:order-2 sm:ml-auto sm:mr-3 sm:w-auto sm:self-center sm:justify-end">
          <CategoryChip name={icon} size="lg" tone={tone} />
        </span>
      )}
    </button>
  );
};

// Kartalar soniga qarab grid rejimi (BARCHA breakpointlarda — smartfon + desktop):
//  ≤5   → 'fit'  : sayt eniga moslashgan bitta qator grid (siljimaydi)
//  6-10 → 'row1' : 1 qator, gorizontal siljiydigan
//  >10  → 'row2' : 2 qator, gorizontal siljiydigan
function TileGrid<T>({
  items,
  getKey,
  renderItem,
}: {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  const count = items.length;
  const mode = count <= 5 ? 'fit' : count <= 10 ? 'row1' : 'row2';
  const scrollRef = useRef<HTMLDivElement>(null);

  // Kursor ustida turganda sichqoncha g'ildiragi (vertikal wheel) stripni gorizontal
  // siljitadi. Strip ichida g'ildirak HARMON gorizontal oladi — chekkaga yetganda
  // ham sahifaga bermaydi (sahifa faqat strip tashqarisida scroll bo'ladi).
  useEffect(() => {
    if (mode === 'fit') return;
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (raw === 0) return;
      e.preventDefault();
      // Brauzerlar wheel delta'ni turli birlikda beradi (deltaMode):
      // 0 = piksel (Chrome/Edge ~100/notch), 1 = qator (Firefox ~3/notch), 2 = sahifa.
      // Hammasini pikselga normallashtiramiz — shunda tezlik hamma brauzerda bir xil.
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? el.clientWidth : 1;
      el.scrollLeft += raw * unit * 1; // 1 — umumiy tezlik koeffitsiyenti (2x tezlashtirildi)
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [mode, count]);
  // Rejim barcha breakpointlarda bir xil ishlaydi (smartfon + desktop).
  const containerCls =
    mode === 'fit'
      ? 'grid gap-1.5 sm:gap-3'
      : mode === 'row1'
        ? 'no-scrollbar scroll-smooth flex snap-x gap-1.5 overflow-x-auto pb-1 sm:gap-3'
        : 'no-scrollbar scroll-smooth grid grid-flow-col grid-rows-2 auto-cols-[104px] gap-1.5 overflow-x-auto pb-1 sm:auto-cols-[220px] sm:gap-3';
  const wrapperCls =
    mode === 'fit'
      ? 'w-full'
      : mode === 'row1'
        ? 'w-[104px] shrink-0 snap-start sm:w-[220px]'
        : 'w-full snap-start';
  const style =
    mode === 'fit'
      ? ({ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` } as React.CSSProperties)
      : undefined;
  return (
    <div ref={scrollRef} className={containerCls} style={style}>
      {items.map((item, i) => (
        <div key={getKey(item)} className={wrapperCls}>
          {renderItem(item, i)}
        </div>
      ))}
    </div>
  );
}

export const HomePage: React.FC<HomePageProps> = ({
  initialType,
  onNavigate,
  onOpenListing,
}) => {
  const { user } = useAuth();
  const { coords } = useGeo();

  // Read URL params initially
  const getInitialParams = () => {
    if (typeof window === 'undefined') {
      return { cat: undefined, kw: '', type: initialType, catalog: undefined };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      cat: params.get('category') || undefined,
      kw: params.get('search') || params.get('keyword') || '',
      type: (params.get('type') as ListingType) || initialType,
      catalog: params.get('catalog') || undefined,
    };
  };

  const initialParams = getInitialParams();

  // Reference data
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);

  // Listings data
  const [listings, setListings] = useState<Listing[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  // Fon yangilash (filtr o'zgarganda) — eski ro'yxat ko'rinib turadi, faqat ingichka progress chizig'i
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const hasLoadedOnce = useRef<boolean>(false);

  const getInitialCatalogId = () => {
    if (initialParams.catalog) return initialParams.catalog;
    if (initialType === 'JOB_OPENING' || initialType === 'JOB_SEEKER') return 'jobs';
    if (initialType === 'SERVICE_OFFER' || initialType === 'SERVICE_REQUEST') return 'services';
    return undefined;
  };

  const [selectedCatalogId, setSelectedCatalogId] = useState<string | undefined>(getInitialCatalogId());
  const [selectedType, setSelectedType] = useState<ListingType | undefined>(initialParams.type);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(initialParams.cat);
  // Hudud filtri AVVALDAN qo'llanmaydi — GPS faqat eng-yaqin-avval tartibi va
  // mavzu uchun `coords` orqali ishlatiladi. Aks holda logo/"Barchasi" bosilganda
  // sahifa qayta mount bo'lib yuborilib, "landing" o'rniga filtrlangan sahifa chiqadi.
  const [selectedRegionId, setSelectedRegionId] = useState<string | undefined>(undefined);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | undefined>(undefined);
  const [selectedWorkSchedule, setSelectedWorkSchedule] = useState<string[]>([]);
  const [selectedExperience, setSelectedExperience] = useState<string[]>([]);
  const [keyword, setKeyword] = useState<string>(initialParams.kw);
  const [priceMin, setPriceMin] = useState<number | undefined>(undefined);
  const [priceMax, setPriceMax] = useState<number | undefined>(undefined);
  // Local string state for the price inputs — formatted with spaces, only applied on blur/Enter
  const [priceMinInput, setPriceMinInput] = useState<string>('');
  const [priceMaxInput, setPriceMaxInput] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [onlyFollowed, setOnlyFollowed] = useState<boolean>(false);

  // Kategoriyaga mos (adaptiv) atribut filtrlari
  const [attrSchema, setAttrSchema] = useState<CategoryAttribute[]>([]);
  const [attrFilters, setAttrFilters] = useState<Record<string, string | number>>({});

  // Landing: 4 ta kategoriya (turi) kartochkalari uchun e'lon sonlari
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});

  // Helper: format number with space separators: 9000000 → "9 000 000"
  const formatUZS = (n: number): string =>
    n.toLocaleString('ru-RU'); // ru-RU uses space as thousands separator

  // Mobile filters toggle
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isTopCategoryOpen, setIsTopCategoryOpen] = useState(false);
  const topCategoryRef = useRef<HTMLDivElement>(null);

  // GPS / Map state
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState<{
    region_id: string; region_name: string;
    district_id: string; district_name: string;
    lat: number; lon: number;
  } | null>(null);
  const [locationError, setLocationError] = useState('');

  const handleDetectAndOpenMap = useCallback(() => {
    setLocationError('');
    setIsMapOpen(true);

    if (detectedLocation) {
      return;
    }

    if (!navigator.geolocation) {
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const loc = await apiRequest<{
            region_id: string; region_name: string;
            district_id: string; district_name: string;
            lat: number; lon: number;
          }>(`/api/locations/detect?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
          setDetectedLocation(loc);
          setSelectedRegionId(loc.region_id);
        } catch {
          console.warn('Joylashuv aniqlanmadi');
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (err) => {
        if (err.code === 1) setLocationError("GPS ruxsati rad etildi");
        else setLocationError("GPS signal topilmadi");
        setIsDetectingLocation(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [detectedLocation]);

  // Close top category dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (topCategoryRef.current && !topCategoryRef.current.contains(e.target as Node)) {
        setIsTopCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mobil filtr sheet ochiq paytda orqa fon skrollini bloklash
  useEffect(() => {
    if (!isMobileFiltersOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isMobileFiltersOpen]);

  // Load initial reference data: Catalogs and Regions
  useEffect(() => {
    apiRequest<Catalog[]>('/api/catalogs')
      .then(setCatalogs)
      .catch(console.error);

    apiRequest<Region[]>('/api/locations/regions')
      .then(setRegions)
      .catch(console.error);
  }, []);

  // Load categories whenever selectedCatalogId changes
  useEffect(() => {
    const url = selectedCatalogId ? `/api/categories?catalog_id=${selectedCatalogId}` : '/api/categories';
    apiRequest<Category[]>(url)
      .then((data) => {
        setCategories(data);
        if (selectedCategoryId && !data.some((c) => c.id === selectedCategoryId)) {
          setSelectedCategoryId(undefined);
        }
      })
      .catch(console.error);
  }, [selectedCatalogId]);

  // Load districts when selectedRegionId changes
  useEffect(() => {
    if (!selectedRegionId) {
      setDistricts([]);
      setSelectedDistrictId(undefined);
      return;
    }
    apiRequest<District[]>(`/api/locations/districts?region_id=${selectedRegionId}`)
      .then(setDistricts)
      .catch(console.error);
  }, [selectedRegionId]);

  // Kategoriya o'zgarganda — atribut sxemasini yukla va atribut filtrlarini tozala
  useEffect(() => {
    setAttrFilters({});
    if (!selectedCategoryId) {
      setAttrSchema([]);
      return;
    }
    getCategoryAttributes(selectedCategoryId)
      .then((attrs) => setAttrSchema(attrs.filter((a) => a.filterable)))
      .catch(() => setAttrSchema([]));
  }, [selectedCategoryId]);

  // Filtr kontekstini (katalog/kategoriya/tur) URL'ga sinxronlaymiz — replaceState
  // orqali, sahifani qayta mount qilmasdan. Shunda Header'dagi global qidiruv
  // joriy doirani o'qib, faqat shu katalog/kategoriya ichidan qidiradi.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedCatalogId) params.set('catalog', selectedCatalogId);
    else params.delete('catalog');
    if (selectedCategoryId) params.set('category', selectedCategoryId);
    else params.delete('category');
    if (selectedType) params.set('type', selectedType);
    else params.delete('type');
    const qs = params.toString();
    window.history.replaceState({}, '', qs ? `/?${qs}` : '/');
  }, [selectedCatalogId, selectedCategoryId, selectedType]);

  // Fetch listings with all filter parameters
  const fetchListings = async (page: number = 1, append: boolean = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else if (!hasLoadedOnce.current) {
      // Birinchi yuklash: skelet ko'rsatiladi
      setIsLoading(true);
    } else {
      // Fon yangilash: mavjud ro'yxat saqlanadi, faqat progress chizig'i
      setIsRefreshing(true);
    }

    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '12');

      if (selectedCatalogId) params.append('catalog_id', selectedCatalogId);
      if (selectedType) params.append('type', selectedType);
      if (selectedCategoryId) params.append('category_id', selectedCategoryId);
      if (selectedRegionId) params.append('region_id', selectedRegionId);
      if (selectedDistrictId) params.append('district_id', selectedDistrictId);
      if (keyword.trim()) params.append('keyword', keyword.trim());
      if (priceMin !== undefined && !isNaN(priceMin)) params.append('price_min', String(priceMin));
      if (priceMax !== undefined && !isNaN(priceMax)) params.append('price_max', String(priceMax));
      if (selectedWorkSchedule.length > 0) params.append('work_format', selectedWorkSchedule.join(','));
      if (selectedExperience.length > 0) params.append('experience', selectedExperience.join(','));
      Object.entries(attrFilters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v) !== '') params.append(`attr.${k}`, String(v));
      });
      if (sortBy) params.append('sort_by', sortBy);
      if (onlyFollowed) params.append('only_followed', 'true');
      // GPS: yaqinlik bo'yicha saralash uchun koordinatalar (doimiy fonda)
      if (coords) {
        params.append('user_lat', String(coords.lat));
        params.append('user_lng', String(coords.lng));
      }

      const res = await apiRequest<{
        items: Listing[];
        pagination: { total: number; total_pages: number; page: number };
      }>(`/api/listings?${params.toString()}`);

      if (append) {
        setListings((prev) => [...prev, ...res.items]);
      } else {
        setListings(res.items);
      }

      setTotalCount(res.pagination.total);
      setTotalPages(res.pagination.total_pages);
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to load listings:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsRefreshing(false);
      hasLoadedOnce.current = true;
    }
  };

  // Trigger search when any filter changes.
  // DIQQAT: `coords` qasddan qo'shilmagan — mobil qurilmalarda GPS watchPosition
  // doimiy mayda siljishlarni uzatadi va xar safar refetch ro'yxatni "o'chib-yonish"
  // (flicker) ga majbur qilardi. Koordinatalar fetchListings ichida closure orqali
  // o'zi ishlatiladi (eng-yaqin/ masofa), ya'ni filtr o'zgarganda yangi coords bilan ketadi.
  useEffect(() => {
    fetchListings(1, false);
  }, [
    selectedCatalogId,
    selectedType,
    selectedCategoryId,
    selectedRegionId,
    selectedDistrictId,
    selectedWorkSchedule,
    selectedExperience,
    attrFilters,
    priceMin,
    priceMax,
    sortBy,
    onlyFollowed,
  ]);

  // Real-time qidiruv: kalit so'z o'zgarganda kichik pauza (debounce) bilan
  // joyida qayta izlaydi — Enter tugmasi shart emas. Sahifa qayta mount
  // bo'lmaydi, scroll sakramaydi (navigate'siz, in-place fetch).
  const searchDebounceRef = useRef<number | undefined>(undefined);
  const lastKeywordRef = useRef(keyword);
  useEffect(() => {
    if (keyword === lastKeywordRef.current) return; // mount qiymatini trigger effekt allaqachon oladi
    lastKeywordRef.current = keyword;
    window.clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = window.setTimeout(() => {
      fetchListings(1, false);
    }, 350);
    return () => window.clearTimeout(searchDebounceRef.current);
  }, [keyword]);

  // Header toolbar'dagi qidiruv vidjeti real-time: tashqi event orqali kalit
  // so'zni qabul qilamiz (navigate/remount yo'q). Yuqoridagi debounce-fetch ishga tushadi.
  useEffect(() => {
    const onLiveSearch = (e: Event) => {
      const q = (e as CustomEvent<string>).detail;
      setKeyword(typeof q === 'string' ? q : '');
    };
    window.addEventListener('tophand:search', onLiveSearch);
    return () => window.removeEventListener('tophand:search', onLiveSearch);
  }, []);

  // Landing kartochkalari uchun tur bo'yicha e'lon sonlarini yuklash
  useEffect(() => {
    const types = ['SERVICE_OFFER', 'JOB_OPENING', 'SERVICE_REQUEST', 'JOB_SEEKER'];
    types.forEach(async (t) => {
      try {
        const r = await apiRequest<{ pagination: { total: number } }>(`/api/listings?type=${t}&limit=1`);
        setTypeCounts((prev) => ({ ...prev, [t]: r.pagination.total }));
      } catch {
        /* ignore */
      }
    });
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchListings(1, false);
  };

  const handleResetFilters = () => {
    setSelectedType(undefined);
    setSelectedCategoryId(undefined);
    setSelectedRegionId(undefined);
    setSelectedDistrictId(undefined);
    setSelectedWorkSchedule([]);
    setSelectedExperience([]);
    setAttrFilters({});
    setKeyword('');
    setPriceMin(undefined);
    setPriceMax(undefined);
    setPriceMinInput('');
    setPriceMaxInput('');
    setSortBy('newest');
    setOnlyFollowed(false);
  };

  const handleLoadMore = () => {
    if (currentPage < totalPages && !isLoadingMore) {
      fetchListings(currentPage + 1, true);
    }
  };

  const toggleWorkSchedule = (val: string) => {
    setSelectedWorkSchedule((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    );
  };

  const toggleExperience = (val: string) => {
    setSelectedExperience((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    );
  };

  // Helper title based on type and catalog
  const getSectionTitle = () => {
    const catSuffix = selectedCategory ? ` — ${selectedCategory.name_uz}` : '';
    if (selectedType === 'JOB_OPENING') return `Vakansiyalar va bo‘sh ish o‘rinlari${catSuffix}`;
    if (selectedType === 'SERVICE_OFFER') return `Xizmatlar va mutaxassis ustalar${catSuffix}`;
    if (selectedType === 'SERVICE_REQUEST') return `Buyurtmalar va mijoz talablari${catSuffix}`;
    if (selectedType === 'JOB_SEEKER') return `Mutaxassislar va rezyumelar${catSuffix}`;
    if (selectedCatalogId === 'services') return `Barcha xizmatlar katalogi${catSuffix}`;
    if (selectedCatalogId === 'jobs') return `Barcha ish e’lonlari katalogi${catSuffix}`;
    return `Barcha e’lonlar${catSuffix}`;
  };

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const selectedRegion = regions.find((r) => r.id === selectedRegionId);
  const selectedDistrict = districts.find((d) => d.id === selectedDistrictId);

  // Count active filters (excluding default sort)
  const activeFiltersCount = [
    Boolean(selectedCatalogId || selectedType),
    Boolean(selectedCategoryId),
    Boolean(selectedRegionId),
    Boolean(selectedDistrictId),
    Boolean(keyword.trim()),
    priceMin !== undefined,
    priceMax !== undefined,
    selectedWorkSchedule.length > 0,
    selectedExperience.length > 0,
    onlyFollowed,
  ].filter(Boolean).length;

  interface MainTab {
    id: string;
    label: string;
    catalogId?: string;
    type?: ListingType;
  }

  const MAIN_TABS: MainTab[] = [
    { id: 'all', label: 'Barchasi', catalogId: undefined, type: undefined },
    { id: 'services', label: 'Xizmatlar', catalogId: 'services', type: 'SERVICE_OFFER' },
    { id: 'jobs', label: 'Ish e’lonlari', catalogId: 'jobs', type: 'JOB_OPENING' },
    { id: 'orders', label: 'Buyurtmalar', catalogId: 'services', type: 'SERVICE_REQUEST' },
    { id: 'resumes', label: 'Rezyumelar', catalogId: 'jobs', type: 'JOB_SEEKER' },
  ];

  const isMainTabActive = (tab: MainTab) => {
    if (tab.id === 'all') {
      return !selectedCatalogId && !selectedType;
    }
    if (tab.id === 'orders') {
      return selectedType === 'SERVICE_REQUEST';
    }
    if (tab.id === 'resumes') {
      return selectedType === 'JOB_SEEKER';
    }
    if (tab.id === 'services') {
      return (
        selectedType === 'SERVICE_OFFER' ||
        (selectedCatalogId === 'services' && !selectedType)
      );
    }
    if (tab.id === 'jobs') {
      return (
        selectedType === 'JOB_OPENING' ||
        (selectedCatalogId === 'jobs' && !selectedType)
      );
    }
    return false;
  };

  const handleMainTabClick = (tab: MainTab) => {
    if (tab.id === 'all') {
      // "Barchasi" -> doim sof asosiy sahifaga qaytamiz
      onNavigate('/');
      return;
    }
    if (selectedCatalogId !== tab.catalogId) {
      setSelectedCategoryId(undefined);
    }
    setSelectedCatalogId(tab.catalogId);
    setSelectedType(tab.type);
    setCurrentPage(1);
  };

  // "Toza" (landing) holatlari — boshqa filtrlar yo'q.
  // DIQQAT: `keyword` ataylab kiritilmagan — toolbar'dan qidirish sahifani
  // filtrlangan layout'ga (yon panel + ikkinchi qidiruv formasi) o'tkazmasin,
  // balki shu landing ko'rinishidagi "Barcha e'lonlar" ro'yxatini joyida filtrlasin.
  const otherFiltersActive =
    Boolean(selectedCategoryId) ||
    Boolean(selectedType) ||
    Boolean(selectedRegionId) ||
    Boolean(selectedDistrictId) ||
    priceMin !== undefined ||
    priceMax !== undefined ||
    selectedWorkSchedule.length > 0 ||
    selectedExperience.length > 0 ||
    onlyFollowed;
  // Sof bosh sahifa — 13 katalog gridi.
  const isLanding = !selectedCatalogId && !otherFiltersActive;
  // Katalog landing — tanlangan katalogning top-kategoriyalari gridi (home kabi).
  const isCatalogLanding = Boolean(selectedCatalogId) && !otherFiltersActive;
  // Ikkalasi ham soddalashtirilgan (yon panel/sarlavhasiz) "toza" ko'rinish.
  const isClean = isLanding || isCatalogLanding;
  const selectedCatalogName = catalogs.find((c) => c.id === selectedCatalogId)?.name_uz || '';

  // Landing'dagi 4 ta asosiy kategoriya (turi) kartochkasi
  const TYPE_CARDS: { type: ListingType; catalogId: string; label: string; hint: string; Icon: any }[] = [
    { type: 'SERVICE_OFFER', catalogId: 'services', label: 'Xizmatlar', hint: 'Ustalar va xizmat takliflari', Icon: Wrench },
    { type: 'JOB_OPENING', catalogId: 'jobs', label: "Ish o'rinlari", hint: 'Vakansiyalar va bo\u2018sh ish o\u2018rinlari', Icon: Briefcase },
    { type: 'SERVICE_REQUEST', catalogId: 'services', label: 'Buyurtmalar', hint: 'Xizmat qidirayotgan mijozlar', Icon: ClipboardList },
    { type: 'JOB_SEEKER', catalogId: 'jobs', label: 'Rezumelar', hint: 'Mutaxassislar va rezyumelar', Icon: UserRound },
  ];

  const openTypeCard = (catalogId: string, type: ListingType) => {
    setKeyword('');
    setSelectedCategoryId(undefined);
    setSelectedCatalogId(catalogId);
    setSelectedType(type);
    setCurrentPage(1);
  };

  // Sektor gridi uchun: katalog bo'yicha barqaror rang toni.
  const CAT_TONE: Record<string, string> = {
    transport: 'blue',
    realty: 'amber',
    jobs: 'violet',
    services: 'teal',
    personal: 'rose',
    'home-dacha': 'orange',
    parts: 'cyan',
    electronics: 'indigo',
    hobby: 'lime',
    animals: 'emerald',
    business: 'sky',
    business360: 'fuchsia',
    handmade: 'red',
  };

  // Katalog / kategoriya tanlash — URL orqali (navigate), shunda Header kontekstni
  // currentRoute'dan o'qib, "Barcha kategoriyalar" holatiga o'tadi.
  const openCatalog = (catalogId: string) => {
    onNavigate(`/?catalog=${catalogId}`);
  };
  const openCategoryTile = (catalogId: string, categoryId: string) => {
    onNavigate(`/?catalog=${catalogId}&category=${categoryId}`);
  };

  // Hero bloki olib tashlandi — qidiruv headerda mavjud.

  return (
    <div className={`max-w-[1440px] mx-auto flex-1 w-full flex flex-col ${isClean ? '' : 'lg:grid lg:grid-cols-[300px_1fr]'} min-h-[calc(100vh-64px)] overflow-x-hidden`}>
      {/* Mobile Filters Toggle Button */}
      {!isClean && (
        <>
      <div className="lg:hidden px-3 sm:px-4 py-2.5 sm:py-3 bg-white border-b border-[#EBECF0] flex items-center justify-between w-full max-w-full">
        <button
          onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
          className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 border border-[#EBECF0] rounded-xl text-xs font-semibold text-[#172B4D] hover:bg-gray-50 shadow-2xs"
        >
          <SlidersHorizontal className="w-4 h-4 text-[#1673E6]" />
          <span>Filtrlar</span>
          {activeFiltersCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
              {activeFiltersCount}
            </span>
          )}
        </button>
        <span className="text-xs text-[#5E6C84] font-medium">
          {totalCount} ta e’lon topildi
        </span>
      </div>

      {/* Backdrop (mobil sheet orqasida) */}
      {isMobileFiltersOpen && (
        <div
          className="lg:hidden th-backdrop fixed inset-0 z-40"
          onClick={() => setIsMobileFiltersOpen(false)}
          aria-hidden
        />
      )}

      {/* 1. Left Sidebar Filter — desktop'da ustun, mobil'da bottom-sheet */}
      <aside
        className={`${
          isMobileFiltersOpen
            ? 'block fixed left-0 right-0 bottom-0 top-[8%] z-50 overflow-y-auto bg-white rounded-t-3xl th-sheet'
            : 'hidden'
        } lg:block lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:overflow-y-auto lg:rounded-none border-r border-[#EBECF0] px-5 pt-0 pb-24 lg:pl-8 lg:pr-6 lg:pb-6 bg-white lg:bg-[#F9FAFB] shrink-0`}
      >
        {/* Mobil sheet: tortish dastasi + sarlavha (yuqorida qotib turadi) */}
        <div className="lg:hidden sticky top-0 z-10 -mx-5 px-5 pt-2.5 pb-3 mb-3 bg-white border-b border-[#EBECF0]">
          <div className="mx-auto mb-2.5 h-1.5 w-10 rounded-full bg-gray-300" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#1673E6]" />
              <span className="font-bold text-base text-[#172B4D]">Filtrlar</span>
            </div>
            <button
              onClick={() => setIsMobileFiltersOpen(false)}
              className="p-2 -mr-2 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer"
              aria-label="Yopish"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Section: Hudud va Tuman (Region and District) */}
        <div className="mb-6">
          <span className="font-mono text-[11px] uppercase tracking-wider text-[#5E6C84] font-semibold mb-2.5 block">
            Hudud va Tuman
          </span>

          {/* GPS detect + map button */}
          <button
            type="button"
            onClick={handleDetectAndOpenMap}
            disabled={isDetectingLocation}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 mb-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 hover:border-blue-400 transition-all disabled:opacity-60 cursor-pointer"
          >
            {isDetectingLocation ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Aniqlanmoqda...
              </>
            ) : (
              <>
                <Navigation className="w-3.5 h-3.5" />
                {detectedLocation
                  ? `📍 ${detectedLocation.district_name} · Xaritada ko'rish`
                  : 'GPS orqali aniqlash'}
              </>
            )}
          </button>
          {locationError && (
            <p className="text-[10px] text-red-500 mb-2">⚠️ {locationError}</p>
          )}

          <div className="space-y-2">
            <div className="relative">
              <select
                value={selectedRegionId || ''}
                onChange={(e) => {
                  setSelectedRegionId(e.target.value || undefined);
                  setSelectedDistrictId(undefined);
                }}
                className="w-full bg-white border border-[#EBECF0] rounded-xl px-3 py-2 text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] appearance-none pr-8 cursor-pointer"
              >
                <option value="">Barcha viloyatlar</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name_uz}
                  </option>
                ))}
              </select>
              <MapPin className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {selectedRegionId && districts.length > 0 && (
              <div className="relative animate-in fade-in duration-200">
                <select
                  value={selectedDistrictId || ''}
                  onChange={(e) => setSelectedDistrictId(e.target.value || undefined)}
                  className="w-full bg-white border border-[#1673E6]/40 rounded-xl px-3 py-2 text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] appearance-none pr-8 cursor-pointer"
                >
                  <option value="">Barcha tumanlar</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name_uz}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
          </div>
        </div>


        {/* Section: Kategoriyalar (Categories) */}
        <div className="mb-6">
          <span className="font-mono text-[11px] uppercase tracking-wider text-[#5E6C84] font-semibold mb-2.5 block">
            {selectedCatalogId === 'jobs'
              ? 'Ish sohalari'
              : selectedCatalogId === 'services'
              ? 'Xizmat kategoriyalari'
              : 'Barcha kategoriyalar'}
          </span>
          <CategoryFilter
            categories={categories}
            catalogId={selectedCatalogId}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={(catId) => setSelectedCategoryId(catId)}
            onClose={() => setIsMobileFiltersOpen(false)}
          />
        </div>

        {/* Section: Kategoriyaga mos atribut filtrlari (adaptiv) */}
        {attrSchema.length > 0 && (
          <div className="mb-6">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[#5E6C84] font-semibold mb-2.5 block">
              Qo'shimcha parametrlar
            </span>
            <div className="flex flex-col gap-2.5">
              {attrSchema.map((attr) => {
                const val = attrFilters[attr.key] ?? '';
                const setVal = (v: string | number) =>
                  setAttrFilters((prev) => {
                    const next = { ...prev };
                    if (v === '' || v === undefined || v === null) delete next[attr.key];
                    else next[attr.key] = v;
                    return next;
                  });
                const label = attr.unit ? `${attr.label} (${attr.unit})` : attr.label;
                if (attr.type === 'select' || attr.type === 'color') {
                  return (
                    <label key={attr.key} className="flex flex-col gap-1">
                      <span className="text-[11px] text-[#5E6C84] font-medium">{label}</span>
                      <select
                        value={String(val)}
                        onChange={(e) => setVal(e.target.value)}
                        className="w-full bg-white border border-[#EBECF0] rounded-xl px-3 py-2 text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] cursor-pointer"
                      >
                        <option value="">Belgilanmagan</option>
                        {(attr.options || []).map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </label>
                  );
                }
                if (attr.type === 'bool') {
                  return (
                    <label key={attr.key} className="flex flex-col gap-1">
                      <span className="text-[11px] text-[#5E6C84] font-medium">{label}</span>
                      <select
                        value={String(val)}
                        onChange={(e) => setVal(e.target.value)}
                        className="w-full bg-white border border-[#EBECF0] rounded-xl px-3 py-2 text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] cursor-pointer"
                      >
                        <option value="">Farq qilmaydi</option>
                        <option value="true">Ha</option>
                        <option value="false">Yo'q</option>
                      </select>
                    </label>
                  );
                }
                if (attr.type === 'number' || attr.type === 'year' || attr.type === 'range') {
                  return (
                    <label key={attr.key} className="flex flex-col gap-1">
                      <span className="text-[11px] text-[#5E6C84] font-medium">{label}</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={String(val)}
                        onChange={(e) => setVal(e.target.value.replace(/\D/g, ''))}
                        placeholder="Masalan: 50000"
                        className="w-full bg-white border border-[#EBECF0] rounded-xl px-3 py-2 text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] placeholder-gray-400"
                      />
                    </label>
                  );
                }
                // text / multiselect → erkin matn
                return (
                  <label key={attr.key} className="flex flex-col gap-1">
                    <span className="text-[11px] text-[#5E6C84] font-medium">{label}</span>
                    <input
                      type="text"
                      value={String(val)}
                      onChange={(e) => setVal(e.target.value)}
                      placeholder={attr.label}
                      className="w-full bg-white border border-[#EBECF0] rounded-xl px-3 py-2 text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] placeholder-gray-400"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Section: Ish formati (Work Format) */}
        <div className="mb-6">
          <span className="font-mono text-[11px] uppercase tracking-wider text-[#5E6C84] font-semibold mb-2.5 block">
            Ish / Xizmat formati
          </span>
          <div className="flex flex-col gap-2">
            {[
              { id: 'ONSITE', label: 'Joyida (Ofis / Xonadon)' },
              { id: 'REMOTE', label: 'Masofaviy (Online)' },
              { id: 'HYBRID', label: 'Gibrid (Aralash)' },
            ].map((item) => {
              const isChecked = selectedWorkSchedule.includes(item.id);
              return (
                <label
                  key={item.id}
                  className="flex items-center gap-2.5 text-xs text-[#172B4D] cursor-pointer hover:text-[#1673E6] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleWorkSchedule(item.id)}
                    className="w-3.5 h-3.5 rounded text-[#1673E6] border-[#EBECF0] focus:ring-[#1673E6] accent-[#1673E6]"
                  />
                  <span className={isChecked ? 'font-semibold text-[#1673E6]' : ''}>{item.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Section: Narx va Maosh (UZS) */}
        <div className="mb-6">
          <span className="font-mono text-[11px] uppercase tracking-wider text-[#5E6C84] font-semibold mb-2.5 block">
            Narx / Maosh oralig'i (UZS)
          </span>

          {/* Active price display */}
          {(priceMin !== undefined || priceMax !== undefined) && (
            <div className="mb-2 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5">
              <span className="text-[11px] font-bold text-blue-700">
                {priceMin !== undefined ? formatUZS(priceMin) : '0'} —{' '}
                {priceMax !== undefined ? formatUZS(priceMax) : '∞'} so'm
              </span>
              <button
                type="button"
                onClick={() => {
                  setPriceMin(undefined);
                  setPriceMax(undefined);
                  setPriceMinInput('');
                  setPriceMaxInput('');
                }}
                className="text-blue-400 hover:text-blue-700"
                title="Narx filtrini tozalash"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick price chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[
              { label: '< 500 ming', min: undefined, max: 500000 },
              { label: '500k – 2M', min: 500000, max: 2000000 },
              { label: '2M – 5M', min: 2000000, max: 5000000 },
              { label: '5M – 10M', min: 5000000, max: 10000000 },
              { label: '10M+', min: 10000000, max: undefined },
            ].map((chip) => {
              const isChipActive = priceMin === chip.min && priceMax === chip.max;
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    if (isChipActive) {
                      setPriceMin(undefined);
                      setPriceMax(undefined);
                      setPriceMinInput('');
                      setPriceMaxInput('');
                    } else {
                      setPriceMin(chip.min);
                      setPriceMax(chip.max);
                      setPriceMinInput(chip.min !== undefined ? String(chip.min) : '');
                      setPriceMaxInput(chip.max !== undefined ? String(chip.max) : '');
                    }
                  }}
                  className={`text-[10px] px-2.5 py-1.5 rounded-lg border font-semibold transition-all ${
                    isChipActive
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* Manual price inputs — text based, no spinners */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Dan"
                value={priceMinInput}
                onChange={(e) => {
                  // Allow only digits
                  const raw = e.target.value.replace(/\D/g, '');
                  setPriceMinInput(raw);
                }}
                onBlur={() => {
                  const n = priceMinInput ? parseInt(priceMinInput, 10) : undefined;
                  setPriceMin(n);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const n = priceMinInput ? parseInt(priceMinInput, 10) : undefined;
                    setPriceMin(n);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-full px-3 py-2 bg-white border border-[#EBECF0] rounded-xl text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] placeholder-gray-400"
              />
              {priceMinInput && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">
                  {Number(priceMinInput).toLocaleString('ru-RU')}
                </span>
              )}
            </div>

            <span className="text-gray-400 text-sm font-medium shrink-0">—</span>

            <div className="flex-1 relative">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Gacha"
                value={priceMaxInput}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '');
                  setPriceMaxInput(raw);
                }}
                onBlur={() => {
                  const n = priceMaxInput ? parseInt(priceMaxInput, 10) : undefined;
                  setPriceMax(n);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const n = priceMaxInput ? parseInt(priceMaxInput, 10) : undefined;
                    setPriceMax(n);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-full px-3 py-2 bg-white border border-[#EBECF0] rounded-xl text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] placeholder-gray-400"
              />
              {priceMaxInput && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">
                  {Number(priceMaxInput).toLocaleString('ru-RU')}
                </span>
              )}
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            Raqam yozing yoki yuqoridagi tezkor tugmalardan birini bosing
          </p>
        </div>


        {/* Section: Tajriba (Experience) */}
        <div className="mb-6">
          <span className="font-mono text-[11px] uppercase tracking-wider text-[#5E6C84] font-semibold mb-2.5 block">
            Tajriba darajasi
          </span>
          <div className="flex flex-col gap-2">
            {[
              { id: 'none', label: 'Tajribasiz / Yangi boshlovchi' },
              { id: '1-3', label: '1–3 yil' },
              { id: '3-5', label: '3–5 yil' },
              { id: '5+', label: '5+ yil' },
            ].map((exp) => {
              const isChecked = selectedExperience.includes(exp.id);
              return (
                <label
                  key={exp.id}
                  className="flex items-center gap-2.5 text-xs text-[#172B4D] cursor-pointer hover:text-[#1673E6] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleExperience(exp.id)}
                    className="w-3.5 h-3.5 rounded text-[#1673E6] border-[#EBECF0] accent-[#1673E6]"
                  />
                  <span className={isChecked ? 'font-semibold text-[#1673E6]' : ''}>{exp.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Clear Filters Button */}
        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={() => {
              handleResetFilters();
              setIsMobileFiltersOpen(false);
            }}
            className="w-full py-2.5 px-4 border border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 rounded-xl text-xs font-semibold text-rose-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Filtrlarni tozalash ({activeFiltersCount})</span>
          </button>
        )}

        {/* Mobil sheet: pastdagi qotib turuvcha “qo'llash” paneli */}
        <div className="lg:hidden sticky bottom-0 z-10 -mx-5 mt-4 px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] bg-white border-t border-[#EBECF0] flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="shrink-0 px-4 py-3 rounded-xl border border-[#EBECF0] text-[#5E6C84] font-semibold text-sm active:bg-gray-50"
            >
              Tozalash
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsMobileFiltersOpen(false)}
            className="flex-1 py-3 rounded-xl bg-[#1673E6] text-white font-bold text-sm active:scale-[.99] shadow-sm"
          >
            {totalCount.toLocaleString()} ta e’lonni ko‘rish
          </button>
        </div>
      </aside>
        </>
      )}

      {/* 2. Main Content */}
      <div className="px-3 py-3.5 sm:p-6 lg:p-8 bg-white flex-1 flex flex-col justify-between lg:overflow-y-auto w-full max-w-full min-w-0">
        <div>
          {/* Search Form — faqat kategoriya/filtrlangan sahifada (home'da qidiruv header'da) */}
          {!isClean && (
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col sm:flex-row bg-[#F9FAFB] border border-[#EBECF0] rounded-2xl p-2 sm:p-1.5 mb-5 gap-2 sm:gap-1.5 shadow-2xs focus-within:border-[#1673E6]/60 transition-all w-full max-w-full"
          >
            {/* Search Keyword */}
            <div className="flex items-center gap-2 px-3 sm:px-4 flex-1 bg-white sm:bg-transparent rounded-xl sm:rounded-none py-2 sm:py-0 border border-[#EBECF0] sm:border-0 sm:border-r min-w-0">
              <Search className="w-4 h-4 text-[#5E6C84] shrink-0" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Mutaxassislik, xizmat, kasb yoki kalit so‘z..."
                className="w-full bg-transparent h-8 sm:h-10 text-xs sm:text-sm text-[#172B4D] placeholder-[#5E6C84] focus:outline-hidden min-w-0"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => {
                    setKeyword('');
                    fetchListings(1, false);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-full cursor-pointer shrink-0"
                  title="Tozalash"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Top Bar Category Selector */}
            {!isLanding && (
            <div className="relative" ref={topCategoryRef}>
              <button
                type="button"
                onClick={() => setIsTopCategoryOpen(!isTopCategoryOpen)}
                className="flex items-center gap-1.5 px-3 sm:px-3.5 h-8 sm:h-10 bg-white sm:bg-transparent rounded-xl sm:rounded-none py-1.5 sm:py-0 border border-[#EBECF0] sm:border-0 sm:border-r text-xs sm:text-sm font-medium text-[#172B4D] hover:text-[#1673E6] cursor-pointer transition-colors w-full sm:w-auto justify-between"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <CategoryIcon
                    name={selectedCategory?.icon}
                    className={`w-4 h-4 shrink-0 ${selectedCategory ? 'text-[#1673E6]' : 'text-[#5E6C84]'}`}
                  />
                  <span className="truncate max-w-[130px] sm:max-w-[140px]">
                    {selectedCategory ? selectedCategory.name_uz : (selectedCatalogId === 'jobs' ? 'Ish sohalari' : 'Kategoriyalar')}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" />
              </button>

              {/* Popover Dropdown */}
              {isTopCategoryOpen && (
                <div className="absolute left-0 top-full mt-2 w-72 sm:w-96 bg-white rounded-2xl border border-gray-200 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                    <span className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      {selectedCatalogId === 'jobs' ? 'Ish e’lonlari katalogi' : 'Xizmatlar katalogi'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsTopCategoryOpen(false)}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <CategoryFilter
                    categories={categories}
                    catalogId={selectedCatalogId}
                    selectedCategoryId={selectedCategoryId}
                    onSelectCategory={(id) => {
                      setSelectedCategoryId(id);
                      setIsTopCategoryOpen(false);
                    }}
                  />
                </div>
              )}
            </div>
            )}

            {/* Region Selector */}
            <div className="flex items-center gap-2 px-3 sm:px-4 sm:max-w-[200px] bg-white sm:bg-transparent rounded-xl sm:rounded-none py-1.5 sm:py-0 border border-[#EBECF0] sm:border-0 flex-1 min-w-0">
              <MapPin className="w-4 h-4 text-[#5E6C84] shrink-0" />
              <select
                value={selectedRegionId || ''}
                onChange={(e) => {
                  setSelectedRegionId(e.target.value || undefined);
                  setSelectedDistrictId(undefined);
                }}
                className="w-full bg-transparent h-8 sm:h-10 text-xs sm:text-sm text-[#172B4D] focus:outline-hidden cursor-pointer min-w-0"
              >
                <option value="">Barcha viloyatlar</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name_uz}
                  </option>
                ))}
              </select>
            </div>

            {/* District Selector (visible in top bar if region selected) */}
            {selectedRegionId && districts.length > 0 && (
              <div className="flex items-center gap-2 px-3 sm:px-4 sm:max-w-[190px] bg-white sm:bg-transparent rounded-xl sm:rounded-none py-1.5 sm:py-0 border border-[#EBECF0] sm:border-0 flex-1 min-w-0">
                <select
                  value={selectedDistrictId || ''}
                  onChange={(e) => setSelectedDistrictId(e.target.value || undefined)}
                  className="w-full bg-transparent h-8 sm:h-10 text-xs sm:text-sm text-[#172B4D] focus:outline-hidden cursor-pointer min-w-0"
                >
                  <option value="">Barcha tumanlar</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name_uz}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full sm:w-auto bg-[#1673E6] hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs sm:text-sm px-6 py-2.5 rounded-xl transition-colors shrink-0 cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <Search className="w-4 h-4" />
              <span>Topish</span>
            </button>

            {/* Xarita Button */}
            <button
              type="button"
              onClick={handleDetectAndOpenMap}
              className="w-full sm:w-auto bg-blue-50 hover:bg-blue-100 text-[#1673E6] font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl border border-blue-200 transition-colors shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
              title="Barcha e'lonlarni xaritada ko'rish"
            >
              <Navigation className="w-4 h-4 text-blue-600" />
              <span>Xarita</span>
            </button>
          </form>
          )}

          {/* ─── SEKTOR (KATALOG) GRIDI (faqat toza bosh sahifada) ─── */}
          {isLanding && (
            <>
              <section className="mb-6">
                <h2 className="text-base sm:text-lg font-extrabold text-[#172B4D] tracking-tight mb-3">
                  Kategoriyalar bo‘yicha
                </h2>
                <TileGrid
                  items={[...catalogs].sort((a, b) => (a.id === 'handmade' ? -1 : b.id === 'handmade' ? 1 : 0))}
                  getKey={(cat) => cat.id}
                  renderItem={(cat, i) => (
                    <CatalogTile
                      label={cat.name_uz}
                      icon={cat.icon}
                      imgSrc={`/catalogs/${cat.id}.png`}
                      tone={CAT_TONE[cat.id]}
                      index={i}
                      onOpen={() => openCatalog(cat.id)}
                    />
                  )}
                />
              </section>
            </>
          )}

          {/* ─── KATALOG ICHIDAGI TOP-KATEGORIYALAR GRIDI (katalog landing) ─── */}
          {isCatalogLanding && (
            <section className="mb-6">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-[#172B4D] tracking-tight">
                  {selectedCatalogName} — kategoriyalar
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('/')}
                  className="shrink-0 text-xs font-semibold text-[#1673E6] hover:underline cursor-pointer"
                >
                  Bosh sahifa
                </button>
              </div>
              <TileGrid
                items={categories.filter((c) => !c.parent_id)}
                getKey={(c) => c.id}
                renderItem={(c, i) => (
                  <CatalogTile
                    label={c.name_uz}
                    icon={c.icon}
                    imgSrc={`/categories/${selectedCatalogId}/${c.id}.png`}
                    tone={CAT_TONE[selectedCatalogId ?? '']}
                    index={i}
                    count={c.active_count}
                    onOpen={() => openCategoryTile(selectedCatalogId!, c.id)}
                  />
                )}
              />
            </section>
          )}

          {/* Main Catalog Tabs — faqat kategoriya sahifasida (landing'da grid bor) */}
          {!isClean && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-5 no-scrollbar border-b border-[#EBECF0] w-full max-w-full">
            {MAIN_TABS.map((tab) => {
              const isSelected = isMainTabActive(tab);
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleMainTabClick(tab)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-150 shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          )}

          {/* Results Header — smartfonda boshqaruv sarlavha o'ngidagi bo'sh joyda */}
          <div className="mb-6 flex items-start justify-between gap-3 sm:items-end">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#172B4D] tracking-tight">
                {getSectionTitle()}
              </h1>
              <p className="text-xs sm:text-sm text-[#5E6C84] mt-1">
                {totalCount > 0
                  ? `O‘zbekiston bo‘ylab ${totalCount.toLocaleString()} ta dolzarb taklif topildi`
                  : 'E’lonlar qidirilmoqda...'}
              </p>
            </div>

            {/* Sorting Dropdown & Obunalar filter — smartfonda 1 qator, faqat ikonka */}
            <div className="flex shrink-0 flex-nowrap items-center gap-2 sm:gap-2.5">
              {user && (
                <button
                  type="button"
                  onClick={() => setOnlyFollowed(!onlyFollowed)}
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer sm:h-auto sm:w-auto sm:justify-start sm:px-3 sm:py-1.5 ${
                    onlyFollowed
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white hover:bg-gray-50 text-[#172B4D] border-[#EBECF0]'
                  }`}
                  title="Faqat o‘zingiz obuna bo‘lgan mutaxassislar va tashkilotlar e’lonlarini ko‘rish"
                >
                  <Users className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">Obunalarim</span>
                  {onlyFollowed && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                </button>
              )}

              {/* Saralash — smartfonda ikonka + tanlangan qiymat (yonma-yon) */}
              <div className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-[#EBECF0] bg-white pl-2.5 pr-1.5 sm:hidden">
                <ArrowUpDown className="h-4 w-4 shrink-0 text-[#5E6C84]" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="max-w-[128px] cursor-pointer appearance-none truncate bg-transparent text-xs font-medium text-[#172B4D] focus:outline-hidden"
                  aria-label="Saralash"
                >
                  <option value="newest">Eng yangilari</option>
                  <option value="price_asc">Narx: pastdan yuqoriga</option>
                  <option value="price_desc">Narx: yuqoridan pastga</option>
                  <option value="rating_desc">Reytingi yuqorilar</option>
                </select>
              </div>

              {/* Saralash — planshet/desktop’da matnli select */}
              <span className="hidden font-mono text-[11px] uppercase tracking-wider text-[#5E6C84] font-semibold sm:inline">
                Saralash:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="hidden cursor-pointer rounded-xl border border-[#EBECF0] bg-white px-3 py-1.5 text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] sm:inline-block"
              >
                <option value="newest">Eng yangilari</option>
                <option value="price_asc">Narx / Maosh: pastdan yuqoriga</option>
                <option value="price_desc">Narx / Maosh: yuqoridan pastga</option>
                <option value="rating_desc">Reytingi yuqorilar</option>
              </select>
            </div>
          </div>

          {/* Fon yangilanmoqda — ingichka progress chizig'i (ro'yxat yashirilmaydi) */}
          {isRefreshing && (
            <div className="h-0.5 w-full rounded-full bg-blue-100 overflow-hidden mb-3">
              <div className="h-full w-1/3 rounded-full bg-blue-500 animate-pulse" />
            </div>
          )}

          {/* Job / Service Listing Cards */}
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="border border-[#EBECF0] rounded-2xl p-6 bg-white animate-pulse flex flex-col md:flex-row gap-6 justify-between"
                >
                  <div className="space-y-3 flex-1">
                    <div className="w-1/4 h-5 bg-gray-100 rounded" />
                    <div className="w-3/4 h-6 bg-gray-100 rounded" />
                    <div className="w-1/2 h-4 bg-gray-100 rounded" />
                    <div className="w-full h-12 bg-gray-100 rounded" />
                  </div>
                  <div className="w-full md:w-56 h-32 bg-gray-50 rounded-xl" />
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="bg-[#F9FAFB] rounded-3xl border border-[#EBECF0] p-12 text-center max-w-md mx-auto my-8">
              <div className="w-16 h-16 rounded-full bg-blue-50 text-[#1673E6] flex items-center justify-center text-2xl mx-auto mb-3">
                🔍
              </div>
              <h3 className="font-bold text-base text-[#172B4D]">Mos e’lonlar topilmadi</h3>
              <p className="text-xs text-[#5E6C84] mt-1 mb-5">
                Tanlangan filtrlar bo‘yicha e’lon mavjud emas. Filtrlarni tozalab yoki qidiruv so‘zini o‘zgartirib ko‘ring.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-5 py-2.5 rounded-xl bg-[#1673E6] hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Barcha filtrlarni tozalash
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  variant="grid"
                  onClick={() => onOpenListing(listing.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Load More Button */}
        {currentPage < totalPages && (
          <div className="py-10 flex justify-center">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="bg-transparent border border-[#EBECF0] hover:border-[#1673E6] hover:bg-blue-50/20 px-8 py-3 rounded-xl text-[#1673E6] font-bold text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-2"
            >
              <span>{isLoadingMore ? 'Yuklanmoqda...' : 'Yana yuklash'}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Nearby Map Modal — fixed position, unaffected by layout */}
      <NearbyMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onOpenListing={onOpenListing}
        initialLocation={detectedLocation}
      />
    </div>
  );
};

export default HomePage;
