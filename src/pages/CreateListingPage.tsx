import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ListingType,
  PriceType,
  SalaryType,
  ContactTime,
  WorkFormat,
  Category,
  Region,
  District,
  Organization,
  Catalog,
  CategoryAttribute,
} from '../types/index.ts';
import {
  apiRequest,
  uploadImageFile,
  uploadVideoFile,
  getPublicMonetization,
  getCatalogs,
  getCategoryAttributes,
  type PublicMonetization,
} from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { CategoryChip } from '../components/common/CategoryIcon.tsx';
import {
  UploadCloud,
  X,
  MapPin,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Navigation,
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Tag,
  ShieldCheck,
  Building2,
  DollarSign,
  SlidersHorizontal,
} from 'lucide-react';

interface CreateListingPageProps {
  onNavigate: (route: string) => void;
  onCreated: (listingId: string) => void;
  editListingId?: string;
}

// Katalog bo'yicha barqaror rang toni (Header/HomePage bilan mos).
const CAT_TONE: Record<string, string> = {
  transport: 'blue', realty: 'amber', jobs: 'violet', services: 'teal',
  personal: 'rose', 'home-dacha': 'orange', parts: 'cyan', electronics: 'indigo',
  hobby: 'lime', animals: 'emerald', business: 'sky', business360: 'fuchsia', handmade: 'red',
};

// Listing turi uchun meta (13 katalog bo'ylab umumiy).
const TYPE_META: Record<ListingType, { label: string; hint: string; emoji: string }> = {
  SELL: { label: 'Sotaman', hint: "Buyumingizni sotuvga joylang", emoji: '🏷️' },
  WANTED: { label: 'Izlayman', hint: "Kerakli narsa bo'yicha so'rov yuboring", emoji: '🔎' },
  RENT_OUT: { label: 'Ijaraga beraman', hint: 'Obyekt yoki uskunani ijaraga bering', emoji: '🔑' },
  RENT_WANTED: { label: 'Ijara izlayman', hint: "Ijaraga olmoqchi bo'lgan narsangiz", emoji: '🏠' },
  SERVICE_OFFER: { label: "Xizmat ko'rsataman", hint: "Ustalik/xizmat taklifingizni joylang", emoji: '🛠️' },
  SERVICE_REQUEST: { label: 'Xizmat izlayman', hint: "Kerakli xizmat uchun so'rov joylang", emoji: '🧰' },
  JOB_OPENING: { label: 'Vakansiya joylash', hint: "Kompaniyangizga xodim izlayapsiz", emoji: '💼' },
  JOB_SEEKER: { label: 'Rezyume (ish izlayman)', hint: "O'zingiz ish qidiryapsiz", emoji: '👤' },
};

// Rang uchun standart variantlar (attribute.options bo'sh bo'lsa ishlatiladi).
const COLOR_OPTIONS = [
  'Oq', 'Qora', 'Kulrang', 'Qizil', "Ko'k", 'Yashil', 'Sariq', 'Jigarrang', 'Binafsha', 'Rangli',
];

// Xizmatlar uchun tezkor "afzalliklar" chiplari.
const PRESET_FEATURES = [
  "Kafolat beriladi (100%)",
  "Tezkor yetib borish (30–60 daqiqa)",
  "O'z professional asboblari bor",
  "Rasmiy shartnoma va chek",
  "Bepul maslahat va o'lchash",
  "24/7 xizmat ko'rsatish",
  "Tajribali mutaxassis (5+ yil)",
  "Hamyonbop va kelishilgan narx",
];

const INPUT_CLS =
  'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500';

const chipCls = (on: boolean, tone = 'blue') =>
  `px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
    on
      ? 'bg-blue-600 text-white font-bold shadow-xs'
      : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-700'
  }${tone === 'emerald' && on ? '!bg-emerald-600' : ''}`;

export const CreateListingPage: React.FC<CreateListingPageProps> = ({ onNavigate, onCreated, editListingId }) => {
  const { user } = useAuth();
  const isEditing = !!editListingId;

  // ── Workflow steps ──
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState<Catalog | null>(null);
  const [selectedType, setSelectedType] = useState<ListingType | null>(null);

  // ── Reference data ──
  const [categories, setCategories] = useState<Category[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [userOrgs, setUserOrgs] = useState<Organization[]>([]);

  // ── Form fields ──
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [regionId, setRegionId] = useState(user?.region_id || '');
  const [districtId, setDistrictId] = useState(user?.district_id || '');
  const [latitude, setLatitude] = useState<number | undefined>(user?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(user?.longitude);

  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [customDescription, setCustomDescription] = useState('');
  const [isCustomDescOpen, setIsCustomDescOpen] = useState(false);

  // ── Dinamik atributlar (category_attributes sxemasi) ──
  const [attrSchema, setAttrSchema] = useState<CategoryAttribute[]>([]);
  const [attributes, setAttributes] = useState<Record<string, string | number | boolean>>({});

  // ── Pricing / employment ──
  const [priceType, setPriceType] = useState<PriceType>('FIXED');
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  const [salaryType, setSalaryType] = useState<SalaryType>('SALARY_FIXED');
  const [salaryMin, setSalaryMin] = useState<string>('');
  const [salaryMax, setSalaryMax] = useState<string>('');
  const [workFormat, setWorkFormat] = useState<WorkFormat>('ONSITE');
  const [experienceLevel, setExperienceLevel] = useState('1-3');
  const [contactTime, setContactTime] = useState<ContactTime>('ANY_TIME');
  const [contactCustomText, setContactCustomText] = useState('');
  const [organizationId, setOrganizationId] = useState<string>('');

  // ── Media ──
  const [images, setImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videos, setVideos] = useState<string[]>([]);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ── Submission / UI ──
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [monetization, setMonetization] = useState<PublicMonetization | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(!!editListingId);

  // AI suggestion (server-side)
  const [aiSuggestion, setAiSuggestion] = useState<{
    catalog_id?: string; category_id?: string; subcategory_id?: string;
    type?: ListingType; confidence?: number; reasoning_uz?: string;
  } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const currentCatalogId = selectedCatalog?.id || '';
  const isJobs = currentCatalogId === 'jobs';
  const isServices = currentCatalogId === 'services';
  const showEmployment = isJobs || isServices;

  // ── Load catalogs + regions + orgs once ──
  useEffect(() => {
    getCatalogs().then(setCatalogs).catch(() => setCatalogs([]));
    apiRequest<Region[]>('/api/locations/regions').then(setRegions).catch(console.error);
    apiRequest<Organization[]>('/api/organizations/my/list').then(setUserOrgs).catch(console.error);
    getPublicMonetization().then(setMonetization).catch(() => {});
  }, []);

  // ── Categories depend on catalog + (jobs) scope ──
  useEffect(() => {
    if (!selectedCatalog) {
      setCategories([]);
      return;
    }
    const qs = new URLSearchParams({ catalog_id: selectedCatalog.id });
    if (selectedCatalog.id === 'jobs' && selectedType) qs.set('scope', selectedType);
    apiRequest<Category[]>(`/api/categories?${qs.toString()}`)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [selectedCatalog, selectedType]);

  // ── Attribute schema depends on category ──
  useEffect(() => {
    if (!categoryId) {
      setAttrSchema([]);
      return;
    }
    getCategoryAttributes(categoryId)
      .then(setAttrSchema)
      .catch(() => setAttrSchema([]));
  }, [categoryId]);

  // ── Districts on region change ──
  useEffect(() => {
    if (!regionId) {
      setDistricts([]);
      return;
    }
    apiRequest<District[]>(`/api/locations/districts?region_id=${regionId}`)
      .then(setDistricts)
      .catch(console.error);
  }, [regionId]);

  // ── Edit mode: prefill (catalog/type/category/attributes) ──
  useEffect(() => {
    if (!editListingId) return;
    (async () => {
      try {
        const l = await apiRequest<any>(`/api/listings/${editListingId}`);
        if (!l) return;
        const cat = catalogs.find((c) => c.id === l.catalog_id) || null;
        setSelectedCatalog(cat);
        setSelectedType(l.type || 'SERVICE_OFFER');
        setTitle(l.title || '');
        setCategoryId(l.category_id || '');
        setRegionId(l.region_id || '');
        setDistrictId(l.district_id || '');
        if (l.latitude != null) setLatitude(l.latitude);
        if (l.longitude != null) setLongitude(l.longitude);
        setPriceType(l.price_type || 'FIXED');
        setPriceMin(l.price_min != null ? String(l.price_min) : '');
        setPriceMax(l.price_max != null ? String(l.price_max) : '');
        setSalaryType(l.salary_type || 'SALARY_FIXED');
        setSalaryMin(l.salary_min != null ? String(l.salary_min) : '');
        setSalaryMax(l.salary_max != null ? String(l.salary_max) : '');
        setWorkFormat(l.work_format || 'ONSITE');
        setExperienceLevel(l.experience_level || '1-3');
        setContactTime(l.contact_time || 'ANY_TIME');
        setContactCustomText(l.contact_custom_text || '');
        setOrganizationId(l.organization_id || '');
        const skillsArr: string[] = Array.isArray(l.skills) ? l.skills : (() => { try { return JSON.parse(l.skills || '[]'); } catch { return []; } })();
        setSelectedSubcategories(skillsArr);
        setCustomDescription(l.description || '');
        const attrs = typeof l.attributes === 'string' ? JSON.parse(l.attributes || '{}') : (l.attributes || {});
        setAttributes(attrs);
        const media: string[] = Array.isArray(l.images) ? l.images : [];
        const isVid = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);
        setImages(media.filter((u) => !isVid(u)));
        setVideos(media.filter((u) => isVid(u)));
      } catch (err) {
        console.error('Edit listing load error:', err);
        setError("E'lonni yuklashda xatolik");
      } finally {
        setIsLoadingEdit(false);
      }
    })();
  }, [editListingId, catalogs]);

  // ── Derived ──
  const catalogTypes = useMemo<ListingType[]>(() => {
    if (!selectedCatalog) return [];
    return (selectedCatalog.listing_types || '')
      .split(',')
      .map((t) => t.trim())
      .filter((t) => !!TYPE_META[t as ListingType]) as ListingType[];
  }, [selectedCatalog]);

  const activeCategory = useMemo(() => categories.find((c) => c.id === categoryId), [categories, categoryId]);

  const parentCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);

  const availableSubcategories = useMemo(() => {
    if (!activeCategory) return [];
    return categories.filter((c) => c.parent_id === activeCategory.id).map((c) => c.name_uz);
  }, [activeCategory, categories]);

  const autoGeneratedDescription = useMemo(() => {
    const parts: string[] = [];
    if (title.trim()) parts.push(title.trim());
    if (activeCategory) parts.push(`Kategoriya: ${activeCategory.name_uz}`);
    if (selectedSubcategories.length > 0) parts.push(`Yo'nalishlar: ${selectedSubcategories.join(', ')}`);
    const attrText = attrSchema
      .map((a) => (attributes[a.key] !== undefined && attributes[a.key] !== '' ? `${a.label}: ${attributes[a.key]}` : null))
      .filter(Boolean) as string[];
    if (attrText.length) parts.push(attrText.join(', '));
    if (showEmployment && selectedFeatures.length > 0) parts.push(`Afzalliklar: ${selectedFeatures.join(', ')}`);
    if (customDescription.trim()) parts.push(`Qo'shimcha izoh: ${customDescription.trim()}`);
    return parts.join('. ') + (parts.length ? '.' : '');
  }, [title, activeCategory, selectedSubcategories, attrSchema, attributes, selectedFeatures, customDescription, showEmployment]);

  // ── Handlers ──
  const chooseCatalog = (cat: Catalog) => {
    setSelectedCatalog(cat);
    setCategoryId('');
    setAttributes({});
    setSelectedSubcategories([]);
    setAiSuggestion(null);
    const types = (cat.listing_types || '').split(',').map((t) => t.trim()).filter((t) => !!TYPE_META[t as ListingType]);
    setSelectedType(types.length === 1 ? (types[0] as ListingType) : null);
  };

  const chooseType = (t: ListingType) => {
    setSelectedType(t);
    setCategoryId('');
    setAttributes({});
    setSelectedSubcategories([]);
  };

  const setAttr = (key: string, val: string | number | boolean | undefined) => {
    setAttributes((prev) => {
      const next = { ...prev };
      if (val === undefined || val === '') delete next[key];
      else next[key] = val;
      return next;
    });
  };

  const handleToggleSubcategory = (item: string) =>
    setSelectedSubcategories((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));

  const handleToggleFeature = (feat: string) =>
    setSelectedFeatures((prev) => (prev.includes(feat) ? prev.filter((f) => f !== feat) : [...prev, feat]));

  const requestAiSuggestion = async (searchTitle?: string) => {
    const text = (searchTitle !== undefined ? searchTitle : title).trim();
    if (!text || text.length < 3) return;
    setIsAiLoading(true);
    try {
      const res = await apiRequest<{
        catalog_id: string; category_id: string; subcategory_id: string;
        type: ListingType; confidence: number; reasoning_uz: string;
      }>('/api/ai/suggest-category', { method: 'POST', body: JSON.stringify({ title: text, description: customDescription }) });
      if (res && res.category_id) setAiSuggestion(res);
    } catch (err) {
      console.warn('AI suggestion error:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const applyAiSuggestion = () => {
    if (!aiSuggestion) return;
    if (aiSuggestion.category_id) setCategoryId(aiSuggestion.category_id);
    if (aiSuggestion.subcategory_id) {
      const sub = categories.find((c) => c.id === aiSuggestion.subcategory_id);
      if (sub) setSelectedSubcategories((prev) => Array.from(new Set([...prev, sub.name_uz])));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (images.length + files.length > 8) {
      alert("Ko'pi bilan 8 ta rasm yuklash mumkin");
      return;
    }
    setIsUploadingImage(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const url = await uploadImageFile(files[i]);
        setImages((prev) => [...prev, url].slice(0, 8));
      }
    } catch (err: any) {
      alert(err.message || 'Rasm yuklashda xatolik');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove: number) => setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (videos.length + files.length > 2) {
      alert("Ko'pi bilan 2 ta video yuklash mumkin");
      return;
    }
    setIsUploadingVideo(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const url = await uploadVideoFile(files[i]);
        setVideos((prev) => [...prev, url].slice(0, 2));
      }
    } catch (err: any) {
      alert(err.message || 'Video yuklashda xatolik');
    } finally {
      setIsUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleRemoveVideo = (indexToRemove: number) => setVideos((prev) => prev.filter((_, idx) => idx !== indexToRemove));

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert("Brauzeringiz geolokatsiyani qo'llab-quvvatlamaydi");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLatitude(lat);
        setLongitude(lon);
        try {
          const detected = await apiRequest<{ region_id: string; region_name: string; district_id: string; district_name: string }>(
            `/api/locations/detect?lat=${lat}&lon=${lon}`
          );
          if (detected?.region_id) {
            setRegionId(detected.region_id);
            const dists = await apiRequest<District[]>(`/api/locations/districts?region_id=${detected.region_id}`);
            setDistricts(dists);
            setDistrictId(detected.district_id);
          }
        } catch (err) {
          console.warn('Avtomatik tuman aniqlashda xatolik:', err);
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setIsLocating(false);
        alert('Joylashuvni aniqlashga ruxsat berilmadi');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatalog || !selectedType) return;

    if (!title.trim() || title.trim().length < 5) {
      setError("Sarlavha kamida 5 ta belgidan iborat bo'lishi kerak");
      return;
    }
    if (!categoryId) {
      setError('Iltimos, kategoriyani tanlang');
      return;
    }
    if (!regionId || !districtId) {
      setError('Viloyat va tumanni belgilang');
      return;
    }
    const missing = attrSchema.filter((a) => a.required && (attributes[a.key] === undefined || attributes[a.key] === ''));
    if (missing.length) {
      setError(`Majburiy parametrlarni to'ldiring: ${missing.map((m) => m.label).join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    setError('');
    const combinedSkills = Array.from(new Set([...selectedSubcategories, ...(showEmployment ? selectedFeatures : [])]));

    try {
      const payload = {
        catalog_id: selectedCatalog.id,
        type: selectedType,
        title: title.trim(),
        description: autoGeneratedDescription,
        category_id: categoryId,
        region_id: regionId,
        district_id: districtId,
        latitude,
        longitude,
        price_type: priceType,
        price_min: priceMin ? parseFloat(priceMin) : undefined,
        price_max: priceMax ? parseFloat(priceMax) : undefined,
        salary_type: isJobs ? salaryType : undefined,
        salary_min: salaryMin ? parseFloat(salaryMin) : undefined,
        salary_max: salaryMax ? parseFloat(salaryMax) : undefined,
        work_format: showEmployment ? workFormat : undefined,
        experience_level: showEmployment ? experienceLevel || undefined : undefined,
        skills: combinedSkills,
        attributes,
        contact_time: contactTime,
        contact_custom_text: contactCustomText || undefined,
        organization_id: organizationId || undefined,
        images,
        videos,
      };

      if (isEditing && editListingId) {
        const updated = await apiRequest<any>(`/api/listings/${editListingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        onCreated(updated?.id || editListingId);
      } else {
        const res = await apiRequest<any>('/api/listings', { method: 'POST', body: JSON.stringify(payload) });
        onCreated(res.id);
      }
    } catch (err: any) {
      setError(err.message || (isEditing ? "E'lonni tahrirlashda xatolik" : "E'lon joylashda xatolik yuz berdi"));
      setIsSubmitting(false);
    }
  };

  // ── Dinamik atribut maydoni ──
  const renderAttrField = (attr: CategoryAttribute) => {
    const val = attributes[attr.key];
    switch (attr.type) {
      case 'select':
      case 'color': {
        const opts = attr.options && attr.options.length ? attr.options : attr.type === 'color' ? COLOR_OPTIONS : [];
        return (
          <select value={typeof val === 'string' ? val : ''} onChange={(e) => setAttr(attr.key, e.target.value)} className={INPUT_CLS}>
            <option value="">{attr.label} (tanlang)</option>
            {opts.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        );
      }
      case 'bool':
        return (
          <div className="flex gap-2">
            {[{ v: true, l: 'Ha' }, { v: false, l: "Yo'q" }].map((o) => (
              <button key={o.l} type="button" onClick={() => setAttr(attr.key, o.v)} className={chipCls(val === o.v)}>
                {val === o.v && <Check className="w-3.5 h-3.5" />}
                {o.l}
              </button>
            ))}
          </div>
        );
      case 'multiselect': {
        const arr = typeof val === 'string' && val ? val.split(', ') : [];
        return (
          <div className="flex flex-wrap gap-2">
            {(attr.options || []).map((o) => {
              const on = arr.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => setAttr(attr.key, (on ? arr.filter((x) => x !== o) : [...arr, o]).join(', '))}
                  className={chipCls(on)}
                >
                  {on && <Check className="w-3.5 h-3.5" />}
                  {o}
                </button>
              );
            })}
          </div>
        );
      }
      case 'number':
      case 'year':
        return (
          <div className="relative">
            <input
              type="number"
              min={attr.type === 'year' ? 1950 : undefined}
              max={attr.type === 'year' ? new Date().getFullYear() : undefined}
              value={typeof val === 'number' ? String(val) : typeof val === 'string' ? val : ''}
              onChange={(e) => setAttr(attr.key, e.target.value === '' ? undefined : Number(e.target.value))}
              className={INPUT_CLS}
              placeholder={attr.unit || ''}
            />
            {attr.unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">{attr.unit}</span>}
          </div>
        );
      case 'range':
        return (
          <input
            type="text"
            value={typeof val === 'string' ? val : ''}
            onChange={(e) => setAttr(attr.key, e.target.value)}
            className={INPUT_CLS}
            placeholder={attr.unit ? `masalan 50 ${attr.unit}` : 'masalan 50–100'}
          />
        );
      default:
        return (
          <input
            type="text"
            value={typeof val === 'string' ? val : ''}
            onChange={(e) => setAttr(attr.key, e.target.value)}
            className={INPUT_CLS}
          />
        );
    }
  };

  const showForm = !!selectedCatalog && !!selectedType;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-10 pb-6">
      {isLoadingEdit ? (
        <div className="space-y-4 animate-pulse">
          <div className="w-48 h-8 bg-gray-200 rounded-lg" />
          <div className="h-96 bg-gray-100 rounded-3xl" />
        </div>
      ) : !selectedCatalog ? (
        /* ── STEP 1: Katalog tanlash (13 sektor) ── */
        <div className="space-y-6">
          <div className="text-center max-w-lg mx-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-3 border border-blue-100">
              <Sparkles className="w-3.5 h-3.5" />
              TopHand — ko'p tarmoqli platforma
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Qaysi bo'limdan joylaysiz?</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-2">Katalogni tanlang — keyin tur va kategoriya taklif qilinadi.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
            {catalogs.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => chooseCatalog(cat)}
                className="p-4 rounded-2xl border-2 border-gray-100 bg-white hover:border-blue-500 hover:shadow-lg transition-all text-left group flex flex-col gap-2.5 cursor-pointer"
              >
                <CategoryChip name={cat.icon} tone={CAT_TONE[cat.id]} size="lg" />
                <span className="font-bold text-sm text-gray-900 group-hover:text-blue-600 transition-colors leading-tight">{cat.name_uz}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                  Tanlash <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : !selectedType ? (
        /* ── STEP 2: Tur tanlash ── */
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setSelectedCatalog(null)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> <span>Boshqa katalog</span>
          </button>
          <div className="text-center max-w-lg mx-auto">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CategoryChip name={selectedCatalog.icon} tone={CAT_TONE[selectedCatalog.id]} size="md" />
              <h1 className="text-xl sm:text-2xl font-black text-gray-900">{selectedCatalog.name_uz}</h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Bu bo'limda qanday e'lon bermoqchisiz?</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {catalogTypes.map((t) => {
              const meta = TYPE_META[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => chooseType(t)}
                  className="p-5 rounded-2xl border-2 border-gray-100 bg-white hover:border-blue-500 hover:shadow-lg transition-all text-left group flex items-start gap-4 cursor-pointer"
                >
                  <div className="text-2xl shrink-0">{meta.emoji}</div>
                  <div className="min-w-0">
                    <span className="font-bold text-sm text-gray-900 block group-hover:text-blue-600 transition-colors">{meta.label}</span>
                    <span className="text-xs text-gray-500 mt-1 block leading-relaxed">{meta.hint}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── STEP 3: Forma ── */
        <div className="bg-white rounded-3xl border border-gray-100 p-5 sm:p-8 shadow-xs">
          <div className="flex items-center justify-between pb-5 border-b border-gray-100 mb-6">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setSelectedType(null)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> <span>Tur/katalogni o'zgartirish</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(`/listing/${editListingId}`)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> <span>E'longa qaytish</span>
              </button>
            )}
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100 truncate max-w-[55%]">
              {TYPE_META[selectedType].emoji} {selectedCatalog.name_uz} · {TYPE_META[selectedType].label}
            </span>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <X className="w-4 h-4 shrink-0 text-rose-600" /> <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {userOrgs.length > 0 && (selectedType === 'JOB_OPENING' || selectedType === 'SERVICE_OFFER' || selectedType === 'SELL') && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-gray-500" /> Qaysi nomdan e'lon bermoqchisiz?
                </label>
                <select
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">O'zim nomimdan ({user?.name})</option>
                  {userOrgs.map((org) => (
                    <option key={org.id} value={org.id}>Tashkilot: {org.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* TITLE + AI */}
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <label className="text-xs font-bold text-gray-800">Nomi <span className="text-rose-500">*</span></label>
                <button
                  type="button"
                  onClick={() => requestAiSuggestion(title)}
                  disabled={isAiLoading || !title.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold transition-all border border-purple-200 cursor-pointer disabled:opacity-40"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                  <span>{isAiLoading ? 'AI tahlil qilmoqda...' : '✨ AI orqali aniqlash'}</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => { if (title.trim().length >= 5 && !categoryId && !aiSuggestion) requestAiSuggestion(title); }}
                placeholder="Masalan: iPhone 13 Pro 256GB, 2-xonali kvartira, Dasturchi..."
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
              />
              {aiSuggestion && (
                <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-r from-purple-50/90 via-indigo-50/80 to-blue-50/90 border border-purple-200 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">✨</div>
                      <div>
                        <span className="text-xs font-bold text-gray-900">
                          AI Tavsiyasi: {categories.find((c) => c.id === aiSuggestion.category_id)?.name_uz || 'Topildi'}
                        </span>
                        <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">{aiSuggestion.reasoning_uz || "Sarlavha tahlili asosida tanlandi"}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={applyAiSuggestion}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" /> <span>Qo'llash</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* CATEGORY SELECTOR */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-800">Kategoriya <span className="text-rose-500">*</span></label>
                <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{selectedCatalog.name_uz}</span>
              </div>
              <select
                required
                value={categoryId}
                onChange={(e) => { setCategoryId(e.target.value); setSelectedSubcategories([]); setAttributes({}); }}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Kategoriyani tanlang...</option>
                {parentCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name_uz}</option>
                ))}
              </select>
            </div>

            {/* SUBCATEGORIES (API daraxti) */}
            {availableSubcategories.length > 0 && (
              <div className="p-4 rounded-2xl bg-gray-50/70 border border-gray-100">
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-blue-600" /> Yo'nalish / tum-kategoriya
                  </label>
                  <span className="text-[11px] text-gray-400">{selectedSubcategories.length} ta tanlandi</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableSubcategories.map((item) => {
                    const isSelected = selectedSubcategories.includes(item);
                    return (
                      <button key={item} type="button" onClick={() => handleToggleSubcategory(item)} className={chipCls(isSelected)}>
                        {isSelected && <Check className="w-3.5 h-3.5" />} <span>{item}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DYNAMIC ATTRIBUTES */}
            {attrSchema.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-3">
                <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                  {activeCategory?.name_uz || 'Kategoriya'} parametrlari
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {attrSchema.map((attr) => (
                    <div key={attr.id}>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        {attr.label} {attr.required && <span className="text-rose-500">*</span>}
                      </label>
                      {renderAttrField(attr)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SERVICES: features */}
            {isServices && (
              <div className="p-4 rounded-2xl bg-blue-50/40 border border-blue-100/70">
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Qulayliklar va afzalliklar
                  </label>
                  <span className="text-[11px] text-blue-600 font-semibold">{selectedFeatures.length} ta</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRESET_FEATURES.map((feat) => {
                    const isSelected = selectedFeatures.includes(feat);
                    return (
                      <button key={feat} type="button" onClick={() => handleToggleFeature(feat)} className={chipCls(isSelected, 'emerald')}>
                        {isSelected && <Check className="w-3.5 h-3.5" />} <span>{feat}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* WORK FORMAT & EXPERIENCE (services/jobs) */}
            {showEmployment && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-2">Ish / xizmat joyi</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ id: 'ONSITE', label: '🏠 Joyida' }, { id: 'REMOTE', label: '💻 Masofaviy' }, { id: 'HYBRID', label: '🔄 Gibrid' }].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setWorkFormat(f.id as WorkFormat)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                          workFormat === f.id ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-2">Tajriba darajasi</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[{ id: 'none', label: 'Yangi' }, { id: '1-3', label: '1–3 yil' }, { id: '3-5', label: '3–5 yil' }, { id: '5+', label: '5+ yil' }].map((exp) => (
                      <button
                        key={exp.id}
                        type="button"
                        onClick={() => setExperienceLevel(exp.id)}
                        className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          experienceLevel === exp.id ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {exp.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PRICING / SALARY */}
            {isJobs ? (
              <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-3">
                <h4 className="font-bold text-xs text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-purple-600" /> Ish haqi (Maosh)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select value={salaryType} onChange={(e) => setSalaryType(e.target.value as SalaryType)} className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-purple-500">
                    <option value="SALARY_FIXED">Aniq maosh</option>
                    <option value="SALARY_RANGE">Oraliq (Dan–Gacha)</option>
                    <option value="SALARY_NEGOTIABLE">Kelishiladi</option>
                  </select>
                  {salaryType !== 'SALARY_NEGOTIABLE' && (
                    <input type="number" placeholder="Boshlang'ich (UZS)" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500" />
                  )}
                  {salaryType === 'SALARY_RANGE' && (
                    <input type="number" placeholder="Maksimal (UZS)" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500" />
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-3">
                <h4 className="font-bold text-xs text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-blue-600" /> Narx
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select value={priceType} onChange={(e) => setPriceType(e.target.value as PriceType)} className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500">
                    <option value="FIXED">Aniq narx</option>
                    <option value="FROM">...dan boshlanadi</option>
                    <option value="RANGE">Narx oralig'i</option>
                    <option value="NEGOTIABLE">Kelishiladi</option>
                    <option value="FREE">Bepul / so'rov bo'yicha</option>
                  </select>
                  {priceType !== 'NEGOTIABLE' && priceType !== 'FREE' && (
                    <input type="number" placeholder="Summa (UZS)" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500" />
                  )}
                  {priceType === 'RANGE' && (
                    <input type="number" placeholder="Maksimal (UZS)" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500" />
                  )}
                </div>
              </div>
            )}

            {/* LOCATION */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1.5">Viloyat / shahar <span className="text-rose-500">*</span></label>
                <select required value={regionId} onChange={(e) => { setRegionId(e.target.value); setDistrictId(''); }} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs font-medium">
                  <option value="">Tanlang...</option>
                  {regions.map((r) => (<option key={r.id} value={r.id}>{r.name_uz}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1.5">Tuman <span className="text-rose-500">*</span></label>
                <select required disabled={!regionId} value={districtId} onChange={(e) => setDistrictId(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs font-medium disabled:opacity-50">
                  <option value="">Tanlang...</option>
                  {districts.map((d) => (<option key={d.id} value={d.id}>{d.name_uz}</option>))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs">
              <div className="flex items-center gap-2 text-gray-700">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{latitude && longitude ? 'Aniq GPS koordinatalar belgilandi' : 'Yaqin atrofdagi qidiruv uchun GPS'}</span>
              </div>
              <button type="button" onClick={handleDetectGPS} disabled={isLocating} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer">
                <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} /> <span>{isLocating ? 'Aniqlanmoqda...' : 'GPS-ni aniqlash'}</span>
              </button>
            </div>

            {/* CONTACT TIME */}
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-2">Bog'lanish qulay vaqti</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[{ id: 'ANY_TIME', label: '🕒 24/7' }, { id: 'MORNING', label: '☀️ 09–13' }, { id: 'AFTERNOON', label: '🌤️ 13–18' }, { id: 'EVENING', label: '🌙 18–21' }].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setContactTime(item.id as ContactTime)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                      contactTime === item.id ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SUMMARY */}
            <div className="p-4 rounded-2xl bg-linear-to-br from-blue-50/60 to-indigo-50/60 border border-blue-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-blue-950">E'lon tafsilotlari (avtomatik)</span>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed font-medium">{autoGeneratedDescription || "Yuqoridagi maydonlarni to'ldiring — tavsif avtomatik tuziladi."}</p>
              <div className="mt-3 pt-3 border-t border-blue-100/70">
                <button type="button" onClick={() => setIsCustomDescOpen(!isCustomDescOpen)} className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer">
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isCustomDescOpen ? 'rotate-180' : ''}`} />
                  <span>{isCustomDescOpen ? "Qo'shimcha izohni yopish" : "✏️ Qo'shimcha izoh kiritish (ixtiyoriy)"}</span>
                </button>
                {isCustomDescOpen && (
                  <textarea rows={3} value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} placeholder="Ixtiyoriy qo'shimcha shart yoki izoh..." className="mt-2.5 w-full bg-white border border-blue-200 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-blue-500" />
                )}
              </div>
            </div>

            {/* IMAGES */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-800">Rasmlar (ko'pi bilan 8 ta)</label>
                <span className="text-[11px] text-gray-400">{images.length}/8</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {images.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-gray-200">
                    <img src={url} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => handleRemoveImage(idx)} className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600 text-white shadow-md cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    {idx === 0 && <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-blue-600 text-white">Muqova</span>}
                  </div>
                ))}
                {images.length < 8 && (
                  <button type="button" disabled={isUploadingImage} onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/30 flex flex-col items-center justify-center p-3 transition-colors cursor-pointer">
                    <UploadCloud className={`w-6 h-6 text-gray-400 mb-1 ${isUploadingImage ? 'animate-bounce text-blue-600' : ''}`} />
                    <span className="text-[11px] font-bold text-gray-600">{isUploadingImage ? 'Yuklanmoqda...' : 'Rasm yuklash'}</span>
                  </button>
                )}
              </div>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" multiple className="hidden" />
            </div>

            {/* VIDEOS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-800">Video (ko'pi bilan 2 ta)</label>
                <span className="text-[11px] text-gray-400">{videos.length}/2</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {videos.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-gray-200 bg-black">
                    <video src={url} className="w-full h-full object-cover" muted playsInline />
                    <button type="button" onClick={() => handleRemoveVideo(idx)} className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600 text-white shadow-md cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-violet-600 text-white">Video</span>
                  </div>
                ))}
                {videos.length < 2 && (
                  <button type="button" disabled={isUploadingVideo} onClick={() => videoInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-gray-300 hover:border-violet-500 hover:bg-violet-50/30 flex flex-col items-center justify-center p-3 transition-colors cursor-pointer">
                    <UploadCloud className={`w-6 h-6 text-gray-400 mb-1 ${isUploadingVideo ? 'animate-bounce text-violet-600' : ''}`} />
                    <span className="text-[11px] font-bold text-gray-600">{isUploadingVideo ? 'Yuklanmoqda...' : 'Video yuklash'}</span>
                  </button>
                )}
              </div>
              <input type="file" ref={videoInputRef} onChange={handleVideoUpload} accept="video/mp4,video/webm" className="hidden" />
            </div>

            {/* MONETIZATION NOTICE */}
            {!isEditing && (() => {
              const activeDays = monetization?.active_days ?? 30;
              const isPaid = monetization?.mode === 'PAID';
              const listingPrice = monetization ? (isJobs ? monetization.prices.listing.jobs : monetization.prices.listing.services) : 0;
              return (
                <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed flex items-center gap-2 ${isPaid ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-emerald-50/70 border-emerald-100 text-emerald-900'}`}>
                  <Sparkles className="w-4 h-4 shrink-0" />
                  {isPaid ? (
                    <span>Ushbu e'lon narxi: <b>{listingPrice.toLocaleString('uz-UZ')} so'm</b> (balansdan yechiladi). E'lon {activeDays} kun faol bo'ladi.</span>
                  ) : (
                    <span><b>Test davri: bepul.</b> E'loningiz {activeDays} kun faol turadi, so'ng bepul uzaytirishingiz mumkin.</span>
                  )}
                </div>
              );
            })()}

            {/* ACTIONS */}
            <div className="pt-4 flex items-center gap-3">
              <button type="button" onClick={() => (isEditing ? onNavigate(`/listing/${editListingId}`) : setSelectedType(null))} className="py-3 px-6 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs cursor-pointer">
                {isEditing ? 'Bekor qilish' : 'Orqaga'}
              </button>
              <button type="submit" disabled={isSubmitting || !showForm} className="flex-1 py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
                {isSubmitting ? (
                  <span>{isEditing ? 'Saqlanmoqda...' : 'Chop etilmoqda...'}</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isEditing ? "O'zgarishlarni saqlash" : "E'lonni chop etish"}</span>
                    {!isSubmitting && <ArrowRight className="w-4 h-4" />}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
