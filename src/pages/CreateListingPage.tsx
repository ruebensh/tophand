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
import { useI18n } from '../i18n/IntlContext.tsx';
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

// select/color uchun maydon: ro'yxatdan tanlash + qo'lda (custom) qiymat kiritish.
// Ro'yxatda mavjud bo'lmagan qiymat ham kiritilishi mumkin — foydalanuvchi
// admin panelda qo'shilmagan variant uchun qulaylikka ega bo'ladi.
const SelectAttrField: React.FC<{
  attr: CategoryAttribute;
  value: string;
  onChange: (v: string | undefined) => void;
}> = ({ attr, value, onChange }) => {
  const { t } = useI18n();
  const opts = attr.options && attr.options.length ? attr.options : attr.type === 'color' ? COLOR_OPTIONS : [];
  const inList = !!value && opts.includes(value);
  const [draft, setDraft] = useState(value && !inList ? value : '');
  useEffect(() => {
    setDraft(value && !opts.includes(value) ? value : '');
  }, [value]);
  return (
    <div className="space-y-1.5">
      <select
        value={inList ? value : ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={INPUT_CLS}
      >
        <option value="">{attr.label} {t('create.selectParen')}</option>
        {opts.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
        {value && !inList && <option value={value}>{value} {t('create.manualParen')}</option>}
      </select>
      <input
        type="text"
        value={draft}
        onChange={(e) => { setDraft(e.target.value); onChange(e.target.value || undefined); }}
        placeholder={t('create.manualPlaceholder')}
        className={`${INPUT_CLS} !py-2 text-[11px]`}
      />
    </div>
  );
};

// multiselect uchun maydon: chiplar + o'z qiymatini qo'shish (custom).
const MultiselectAttrField: React.FC<{
  attr: CategoryAttribute;
  value: string;
  onChange: (v: string | undefined) => void;
}> = ({ attr, value, onChange }) => {
  const { t } = useI18n();
  const known = attr.options || [];
  const arr = value ? value.split(', ').filter(Boolean) : [];
  const [draft, setDraft] = useState('');
  const toggle = (o: string) => {
    const next = arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o];
    onChange(next.length ? next.join(', ') : undefined);
  };
  const addCustom = () => {
    const t = draft.trim();
    if (!t || arr.includes(t)) { setDraft(''); return; }
    onChange([...arr, t].join(', '));
    setDraft('');
  };
  const customSelected = arr.filter((x) => !known.includes(x));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {known.map((o) => {
          const on = arr.includes(o);
          return (
            <button key={o} type="button" onClick={() => toggle(o)} className={chipCls(on)}>
              {on && <Check className="w-3.5 h-3.5" />}
              {o}
            </button>
          );
        })}
        {customSelected.map((x) => (
          <span key={x} className={chipCls(true)}>
            {x}
            <button type="button" onClick={() => toggle(x)} className="ml-0.5 hover:opacity-70">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          placeholder={t('create.addOwnPlaceholder')}
          className={`${INPUT_CLS} !py-2 text-[11px]`}
        />
        <button type="button" onClick={addCustom} className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shrink-0 cursor-pointer">
          {t('create.add')}
        </button>
      </div>
    </div>
  );
};

export const CreateListingPage: React.FC<CreateListingPageProps> = ({ onNavigate, onCreated, editListingId }) => {
  const { user } = useAuth();
  const { t, localized, intlLocale } = useI18n();
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
        setSelectedFeatures(skillsArr);
        setCustomDescription(l.description || '');
        const attrs = typeof l.attributes === 'string' ? JSON.parse(l.attributes || '{}') : (l.attributes || {});
        setAttributes(attrs);
        const media: string[] = Array.isArray(l.images) ? l.images : [];
        const isVid = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);
        setImages(media.filter((u) => !isVid(u)));
        setVideos(media.filter((u) => isVid(u)));
      } catch (err) {
        console.error('Edit listing load error:', err);
        setError(t('create.errLoadEdit'));
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

  const selectedCategoryObj = useMemo(() => categories.find((c) => c.id === categoryId), [categories, categoryId]);
  // Tanlangan kategoriya barg (subcategory) bo'lsa, uning otasi top-select qiymati bo'ladi.
  const parentCategoryId = selectedCategoryObj?.parent_id || categoryId;
  const parentCategoryObj = useMemo(() => categories.find((c) => c.id === parentCategoryId), [categories, parentCategoryId]);
  const isLeafSelected = !!selectedCategoryObj?.parent_id;

  const parentCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);

  // Ota kategoriyaning subkategoriyalari — filtrlar shu bo'lakka qarab yuklanadi.
  const subcategoriesOfParent = useMemo(
    () => categories.filter((c) => c.parent_id === parentCategoryId),
    [categories, parentCategoryId]
  );

  const autoGeneratedDescription = useMemo(() => {
    const parts: string[] = [];
    if (title.trim()) parts.push(title.trim());
    if (parentCategoryObj) parts.push(`${t('create.descCategory')}: ${localized(parentCategoryObj)}`);
    if (isLeafSelected && selectedCategoryObj) parts.push(`${t('create.descDirection')}: ${localized(selectedCategoryObj)}`);
    const attrText = attrSchema
      .map((a) => (attributes[a.key] !== undefined && attributes[a.key] !== '' ? `${a.label}: ${attributes[a.key]}` : null))
      .filter(Boolean) as string[];
    if (attrText.length) parts.push(attrText.join(', '));
    if (showEmployment && selectedFeatures.length > 0) parts.push(`${t('create.descFeatures')}: ${selectedFeatures.join(', ')}`);
    if (customDescription.trim()) parts.push(`${t('create.descExtra')}: ${customDescription.trim()}`);
    return parts.join('. ') + (parts.length ? '.' : '');
  }, [title, parentCategoryObj, selectedCategoryObj, isLeafSelected, attrSchema, attributes, selectedFeatures, customDescription, showEmployment, t, localized]);

  // ── Handlers ──
  const chooseCatalog = (cat: Catalog) => {
    setSelectedCatalog(cat);
    setCategoryId('');
    setAttributes({});
    setAiSuggestion(null);
    const types = (cat.listing_types || '').split(',').map((t) => t.trim()).filter((t) => !!TYPE_META[t as ListingType]);
    setSelectedType(types.length === 1 ? (types[0] as ListingType) : null);
  };

  const chooseType = (t: ListingType) => {
    setSelectedType(t);
    setAttributes({});
    // Jobsda kategoriya tur (scope) ga bog'liq — tur o'zgarsa kategoriya tozalanadi.
    if (currentCatalogId === 'jobs') setCategoryId('');
  };

  const setAttr = (key: string, val: string | number | boolean | undefined) => {
    setAttributes((prev) => {
      const next = { ...prev };
      if (val === undefined || val === '') delete next[key];
      else next[key] = val;
      return next;
    });
  };

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
    // Subkategoriya aniqlansa — e'lon shu bargga joylanadi va uning filtrlari yuklanadi.
    const targetId = aiSuggestion.subcategory_id || aiSuggestion.category_id;
    if (targetId && categories.some((c) => c.id === targetId)) {
      setCategoryId(targetId);
      setAttributes({});
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (images.length + files.length > 8) {
      alert(t('create.errMaxImages'));
      return;
    }
    setIsUploadingImage(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const url = await uploadImageFile(files[i]);
        setImages((prev) => [...prev, url].slice(0, 8));
      }
    } catch (err: any) {
      alert(err.message || t('create.errImage'));
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
      alert(t('create.errMaxVideos'));
      return;
    }
    setIsUploadingVideo(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const url = await uploadVideoFile(files[i]);
        setVideos((prev) => [...prev, url].slice(0, 2));
      }
    } catch (err: any) {
      alert(err.message || t('create.errVideo'));
    } finally {
      setIsUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleRemoveVideo = (indexToRemove: number) => setVideos((prev) => prev.filter((_, idx) => idx !== indexToRemove));

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert(t('create.errGeoUnsupported'));
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
        alert(t('create.errGeoDenied'));
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatalog || !selectedType) return;

    if (!title.trim() || title.trim().length < 5) {
      setError(t('create.errTitleMin'));
      return;
    }
    if (!categoryId) {
      setError(t('create.errCategory'));
      return;
    }
    if (!regionId || !districtId) {
      setError(t('create.errRegionDistrict'));
      return;
    }
    if (subcategoriesOfParent.length > 0 && !isLeafSelected) {
      setError(t('create.errSubcat'));
      return;
    }
    const missing = attrSchema.filter((a) => a.required && (attributes[a.key] === undefined || attributes[a.key] === ''));
    if (missing.length) {
      setError(t('create.errRequiredParams', { list: missing.map((m) => m.label).join(', ') }));
      return;
    }

    setIsSubmitting(true);
    setError('');
    const combinedSkills = Array.from(new Set(showEmployment ? selectedFeatures : []));

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
      setError(err.message || (isEditing ? t('create.errEdit') : t('create.errCreate')));
      setIsSubmitting(false);
    }
  };

  // ── Dinamik atribut maydoni ──
  const renderAttrField = (attr: CategoryAttribute) => {
    const val = attributes[attr.key];
    switch (attr.type) {
      case 'select':
      case 'color': {
        return <SelectAttrField attr={attr} value={typeof val === 'string' ? val : ''} onChange={(v) => setAttr(attr.key, v)} />;
      }
      case 'bool':
        return (
          <div className="flex gap-2">
            {[{ v: true, l: t('common.yes') }, { v: false, l: t('common.no') }].map((o) => (
              <button key={o.l} type="button" onClick={() => setAttr(attr.key, o.v)} className={chipCls(val === o.v)}>
                {val === o.v && <Check className="w-3.5 h-3.5" />}
                {o.l}
              </button>
            ))}
          </div>
        );
      case 'multiselect': {
        return <MultiselectAttrField attr={attr} value={typeof val === 'string' ? val : ''} onChange={(v) => setAttr(attr.key, v)} />;
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
            placeholder={attr.unit ? t('create.rangeExampleUnit', { unit: attr.unit }) : t('create.rangeExample')}
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

  // Jobs katalogida kategoriyalar tur (scope) ga bog'liq — avval tur, keyin kategoriya.
  // Boshqa kataloglarda: katalogdan keyin darhol kategoriya tanlash.
  const needsTypeFirst = currentCatalogId === 'jobs';
  const wantCategory = !categoryId && (needsTypeFirst ? !!selectedType : true);
  const wantType = !selectedType && (needsTypeFirst ? true : !!categoryId);

  const typeStep = selectedCatalog && (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => setSelectedCatalog(null)}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> <span>{t('create.otherCatalog')}</span>
      </button>
      <div className="text-center max-w-lg mx-auto">
        <div className="flex items-center justify-center gap-2 mb-2">
          <CategoryChip name={selectedCatalog.icon} tone={CAT_TONE[selectedCatalog.id]} size="md" />
          <h1 className="text-xl sm:text-2xl font-black text-gray-900">{localized(selectedCatalog)}</h1>
        </div>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">{t('create.typeTitle')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        {catalogTypes.map((type) => {
          const meta = {
            emoji: TYPE_META[type].emoji,
            label: t(`create.typeMeta.${type}.label`),
            hint: t(`create.typeMeta.${type}.hint`),
          };
          return (
            <button
              key={type}
              type="button"
              onClick={() => chooseType(type)}
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
  );

  const categoryStep = selectedCatalog && (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => (needsTypeFirst ? setSelectedType(null) : setSelectedCatalog(null))}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> <span>{needsTypeFirst ? t('create.otherType') : t('create.otherCatalog')}</span>
      </button>
      <div className="text-center max-w-lg mx-auto">
        <div className="flex items-center justify-center gap-2 mb-2">
          <CategoryChip name={selectedCatalog.icon} tone={CAT_TONE[selectedCatalog.id]} size="md" />
          <h1 className="text-xl sm:text-2xl font-black text-gray-900">{localized(selectedCatalog)}</h1>
        </div>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">{t('create.categoryTitle')}</p>
      </div>
      {parentCategories.length === 0 ? (
        <div className="text-center text-xs text-gray-400 py-10">{t('create.categoriesLoading')}</div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white divide-y divide-gray-100 overflow-hidden">
          {parentCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setCategoryId(c.id); setAttributes({}); }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-blue-50/60 active:bg-blue-50 transition-colors group cursor-pointer"
            >
              <CategoryChip name={c.icon} tone={CAT_TONE[selectedCatalog.id]} size="sm" />
              <span className="flex-1 min-w-0 font-bold text-[13px] text-gray-900 group-hover:text-blue-700 transition-colors leading-tight">{localized(c)}</span>
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      )}
    </div>
  );

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
              {t('create.brandBadge')}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">{t('create.step1Title')}</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-2">{t('create.step1Hint')}</p>
          </div>
          {/* Kataloglar — ro'yxat ko'rinishi (card emas) */}
          <div className="rounded-2xl border border-gray-100 bg-white divide-y divide-gray-100 overflow-hidden">
            {catalogs.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => chooseCatalog(cat)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-blue-50/60 active:bg-blue-50 transition-colors group cursor-pointer"
              >
                <CategoryChip name={cat.icon} tone={CAT_TONE[cat.id]} size="sm" />
                <span className="flex-1 min-w-0 font-bold text-[13px] text-gray-900 group-hover:text-blue-700 transition-colors leading-tight">{localized(cat)}</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
        </div>
      ) : wantCategory ? (
        categoryStep
      ) : wantType ? (
        typeStep
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
                <ArrowLeft className="w-4 h-4" /> <span>{t('create.changeTypeCatalog')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(`/listing/${editListingId}`)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> <span>{t('create.backToListing')}</span>
              </button>
            )}
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100 truncate max-w-[55%]">
              {TYPE_META[selectedType!].emoji} {localized(selectedCatalog)} · {t(`create.typeMeta.${selectedType}.label`)}
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
                  <Building2 className="w-3.5 h-3.5 text-gray-500" /> {t('create.orgLabel')}
                </label>
                <select
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('create.orgSelf', { name: user?.name || '' })}</option>
                  {userOrgs.map((org) => (
                    <option key={org.id} value={org.id}>{t('create.orgPrefix', { name: org.name })}</option>
                  ))}
                </select>
              </div>
            )}

            {/* TITLE + AI */}
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <label className="text-xs font-bold text-gray-800">{t('create.name')} <span className="text-rose-500">*</span></label>
                <button
                  type="button"
                  onClick={() => requestAiSuggestion(title)}
                  disabled={isAiLoading || !title.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold transition-all border border-purple-200 cursor-pointer disabled:opacity-40"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                  <span>{isAiLoading ? t('create.aiAnalyzing') : t('create.aiDetect')}</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => { if (title.trim().length >= 5 && !categoryId && !aiSuggestion) requestAiSuggestion(title); }}
                placeholder={t('create.titlePlaceholder')}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
              />
              {aiSuggestion && (
                <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-r from-purple-50/90 via-indigo-50/80 to-blue-50/90 border border-purple-200 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">✨</div>
                      <div>
                        <span className="text-xs font-bold text-gray-900">
                          {t('create.aiSuggestion')}: {categories.find((c) => c.id === aiSuggestion.category_id) ? localized(categories.find((c) => c.id === aiSuggestion.category_id)!) : t('create.aiFound')}
                        </span>
                        <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">{aiSuggestion.reasoning_uz || t('create.aiReasonFallback')}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={applyAiSuggestion}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" /> <span>{t('create.aiApply')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* CATEGORY SELECTOR */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-800">{t('create.category')} <span className="text-rose-500">*</span></label>
                <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{localized(selectedCatalog)}</span>
              </div>
              <select
                required
                value={parentCategoryId}
                onChange={(e) => { setCategoryId(e.target.value); setAttributes({}); }}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('create.selectCategory')}</option>
                {parentCategories.map((c) => (
                  <option key={c.id} value={c.id}>{localized(c)}</option>
                ))}
              </select>
            </div>

            {/* SUBCATEGORIES (single-select: e'lon shu bargga joylanadi va filtrlari yuklanadi) */}
            {subcategoriesOfParent.length > 0 && (
              <div className="p-4 rounded-2xl bg-gray-50/70 border border-gray-100">
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-blue-600" /> {t('create.subcategory')} <span className="text-rose-500">*</span>
                  </label>
                  {isLeafSelected && selectedCategoryObj && (
                    <span className="text-[11px] font-semibold text-blue-600">{localized(selectedCategoryObj)}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {subcategoriesOfParent.map((sub) => {
                    const isSelected = categoryId === sub.id;
                    return (
                      <button key={sub.id} type="button" onClick={() => { setCategoryId(sub.id); setAttributes({}); }} className={chipCls(isSelected)}>
                        {isSelected && <Check className="w-3.5 h-3.5" />} <span>{localized(sub)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DYNAMIC ATTRIBUTES (filtrlar: tanlangan subkategoriya yoki subkategoriyasiz ota kategoriya) */}
            {attrSchema.length > 0 && (subcategoriesOfParent.length === 0 || isLeafSelected) && (
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-3">
                <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                  {t('create.paramsOf', { name: selectedCategoryObj ? localized(selectedCategoryObj) : t('create.category') })}
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
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> {t('create.features')}
                  </label>
                  <span className="text-[11px] text-blue-600 font-semibold">{t('create.countTa', { n: selectedFeatures.length })}</span>
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
                  <label className="block text-xs font-bold text-gray-800 mb-2">{t('create.workPlace')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ id: 'ONSITE', label: t('create.workOnsite') }, { id: 'REMOTE', label: t('create.workRemote') }, { id: 'HYBRID', label: t('create.workHybrid') }].map((f) => (
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
                  <label className="block text-xs font-bold text-gray-800 mb-2">{t('create.experience')}</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[{ id: 'none', label: t('create.expNew') }, { id: '1-3', label: t('create.exp13') }, { id: '3-5', label: t('create.exp35') }, { id: '5+', label: t('create.exp5plus') }].map((exp) => (
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
                  <DollarSign className="w-3.5 h-3.5 text-purple-600" /> {t('create.salaryTitle')}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select value={salaryType} onChange={(e) => setSalaryType(e.target.value as SalaryType)} className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-purple-500">
                    <option value="SALARY_FIXED">{t('create.salaryFixed')}</option>
                    <option value="SALARY_RANGE">{t('create.salaryRange')}</option>
                    <option value="SALARY_NEGOTIABLE">{t('create.salaryNegotiable')}</option>
                  </select>
                  {salaryType !== 'SALARY_NEGOTIABLE' && (
                    <input type="number" placeholder={t('create.salaryMinPh')} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500" />
                  )}
                  {salaryType === 'SALARY_RANGE' && (
                    <input type="number" placeholder={t('create.salaryMaxPh')} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500" />
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-3">
                <h4 className="font-bold text-xs text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-blue-600" /> {t('create.priceTitle')}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select value={priceType} onChange={(e) => setPriceType(e.target.value as PriceType)} className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500">
                    <option value="FIXED">{t('create.priceFixed')}</option>
                    <option value="FROM">{t('create.priceFrom')}</option>
                    <option value="RANGE">{t('create.priceRange')}</option>
                    <option value="NEGOTIABLE">{t('create.priceNegotiable')}</option>
                    <option value="FREE">{t('create.priceFree')}</option>
                  </select>
                  {priceType !== 'NEGOTIABLE' && priceType !== 'FREE' && (
                    <input type="number" placeholder={t('create.amountPh')} value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500" />
                  )}
                  {priceType === 'RANGE' && (
                    <input type="number" placeholder={t('create.salaryMaxPh')} value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500" />
                  )}
                </div>
              </div>
            )}

            {/* LOCATION */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1.5">{t('create.regionLabel')} <span className="text-rose-500">*</span></label>
                <select required value={regionId} onChange={(e) => { setRegionId(e.target.value); setDistrictId(''); }} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs font-medium">
                  <option value="">{t('create.selectPh')}</option>
                  {regions.map((r) => (<option key={r.id} value={r.id}>{localized(r)}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1.5">{t('create.districtLabel')} <span className="text-rose-500">*</span></label>
                <select required disabled={!regionId} value={districtId} onChange={(e) => setDistrictId(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs font-medium disabled:opacity-50">
                  <option value="">{t('create.selectPh')}</option>
                  {districts.map((d) => (<option key={d.id} value={d.id}>{localized(d)}</option>))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs">
              <div className="flex items-center gap-2 text-gray-700">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{latitude && longitude ? t('create.gpsSet') : t('create.gpsNearby')}</span>
              </div>
              <button type="button" onClick={handleDetectGPS} disabled={isLocating} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer">
                <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} /> <span>{isLocating ? t('create.detecting') : t('create.detectGps')}</span>
              </button>
            </div>

            {/* CONTACT TIME */}
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-2">{t('create.contactTimeLabel')}</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[{ id: 'ANY_TIME', label: t('create.ctAny') }, { id: 'MORNING', label: t('create.ctMorning') }, { id: 'AFTERNOON', label: t('create.ctAfternoon') }, { id: 'EVENING', label: t('create.ctEvening') }].map((item) => (
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
                <span className="text-xs font-bold text-blue-950">{t('create.summaryTitle')}</span>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed font-medium">{autoGeneratedDescription || t('create.summaryEmpty')}</p>
              <div className="mt-3 pt-3 border-t border-blue-100/70">
                <button type="button" onClick={() => setIsCustomDescOpen(!isCustomDescOpen)} className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer">
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isCustomDescOpen ? 'rotate-180' : ''}`} />
                  <span>{isCustomDescOpen ? t('create.closeExtra') : t('create.openExtra')}</span>
                </button>
                {isCustomDescOpen && (
                  <textarea rows={3} value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} placeholder={t('create.extraPh')} className="mt-2.5 w-full bg-white border border-blue-200 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-blue-500" />
                )}
              </div>
            </div>

            {/* IMAGES */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-800">{t('create.imagesLabel')}</label>
                <span className="text-[11px] text-gray-400">{images.length}/8</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {images.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-gray-200">
                    <img src={url} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => handleRemoveImage(idx)} className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600 text-white shadow-md cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    {idx === 0 && <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-blue-600 text-white">{t('create.cover')}</span>}
                  </div>
                ))}
                {images.length < 8 && (
                  <button type="button" disabled={isUploadingImage} onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/30 flex flex-col items-center justify-center p-3 transition-colors cursor-pointer">
                    <UploadCloud className={`w-6 h-6 text-gray-400 mb-1 ${isUploadingImage ? 'animate-bounce text-blue-600' : ''}`} />
                    <span className="text-[11px] font-bold text-gray-600">{isUploadingImage ? t('create.uploading') : t('create.uploadImage')}</span>
                  </button>
                )}
              </div>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" multiple className="hidden" />
            </div>

            {/* VIDEOS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-800">{t('create.videosLabel')}</label>
                <span className="text-[11px] text-gray-400">{videos.length}/2</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {videos.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-gray-200 bg-black">
                    <video src={url} className="w-full h-full object-cover" muted playsInline />
                    <button type="button" onClick={() => handleRemoveVideo(idx)} className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600 text-white shadow-md cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-violet-600 text-white">{t('create.videoTag')}</span>
                  </div>
                ))}
                {videos.length < 2 && (
                  <button type="button" disabled={isUploadingVideo} onClick={() => videoInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-gray-300 hover:border-violet-500 hover:bg-violet-50/30 flex flex-col items-center justify-center p-3 transition-colors cursor-pointer">
                    <UploadCloud className={`w-6 h-6 text-gray-400 mb-1 ${isUploadingVideo ? 'animate-bounce text-violet-600' : ''}`} />
                    <span className="text-[11px] font-bold text-gray-600">{isUploadingVideo ? t('create.uploading') : t('create.uploadVideo')}</span>
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
                    <span>{t('create.paidLabel')} <b>{listingPrice.toLocaleString(intlLocale)} {t('wallet.som')}</b> {t('create.paidSuffix', { n: activeDays })}</span>
                  ) : (
                    <span><b>{t('create.testTitle')}</b> {t('create.testBody', { n: activeDays })}</span>
                  )}
                </div>
              );
            })()}

            {/* ACTIONS */}
            <div className="pt-4 flex items-center gap-3">
              <button type="button" onClick={() => (isEditing ? onNavigate(`/listing/${editListingId}`) : setSelectedType(null))} className="py-3 px-6 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs cursor-pointer">
                {isEditing ? t('create.cancel') : t('create.back')}
              </button>
              <button type="submit" disabled={isSubmitting || !showForm} className="flex-1 py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
                {isSubmitting ? (
                  <span>{isEditing ? t('create.saving') : t('create.publishing')}</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isEditing ? t('create.saveChanges') : t('create.publish')}</span>
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
