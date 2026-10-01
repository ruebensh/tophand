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
} from '../types/index.ts';
import { apiRequest, uploadImageFile, uploadVideoFile, getPublicMonetization, type PublicMonetization } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Wrench,
  HelpCircle,
  Briefcase,
  UserCheck,
  UploadCloud,
  X,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Navigation,
  Check,
  CheckCircle2,
  ChevronRight,
  Layers,
  Tag,
  ShieldCheck,
  FileText,
  DollarSign,
  Building2,
  ChevronDown,
} from 'lucide-react';

interface CreateListingPageProps {
  onNavigate: (route: string) => void;
  onCreated: (listingId: string) => void;
  editListingId?: string;
}

// Subcategory & service items dictionary per category slug
const SUBCATEGORIES_BY_SLUG: Record<string, string[]> = {
  santexnika: [
    "Kran va smesitel almashtirish",
    "Tyopliy pol (Issiq pol) montaji",
    "Kanalizatsiya tozalash va ochish",
    "Quvurlar montaji (Polipropilen)",
    "Ariston va suv isitgich o'rnatish",
    "Dush kabina va vanna montaji",
    "Unitaz va rakovina o'rnatish",
    "Suv nasoslari sozlash",
    "Suv filtri o'rnatish",
  ],
  elektrik: [
    "Simlar tortish (Razvodka)",
    "Avtomat va shit yig'ish",
    "Lyustra va chiroqlar montaji",
    "Rozetka va viklyuchatel almashtirish",
    "Generator va stabilizator ulash",
    "Qisqa tutashuvni bartaraf qilish",
    "LED yoritgichlar montaji",
    "Uch fazali (380V) elektr ishlari",
  ],
  qurilish: [
    "Kafel va terakota terish",
    "Malyar va shpaklyovka ishlari",
    "Gipsokarton shift va devorlar",
    "Laminat va parket yotqizish",
    "Eshik va romlar o'rnatish",
    "Suvoqchilik va styajka",
    "Tom yopish va tunukasozlik",
    "Fasad va dekorativ ishlar",
    "Naves va temirchilik ishlari",
  ],
  'it-dasturlash': [
    "Veb-sayt yaratish (React / Next.js)",
    "Telegram bot ishlab chiqish",
    "Mobil ilova (Flutter / iOS / Android)",
    "Kompyuter sozlash va Windows o'rnatish",
    "Backend API va ma'lumotlar bazasi",
    "WordPress va Tilda saytlar",
    "SEO va qidiruv tizimi optimallashtirish",
  ],
  dizayn: [
    "Logotip va brending",
    "UI/UX veb va mobil dizayn",
    "Banner va SMM postlar dizayni",
    "Interer va eksterer dizayn (3ds Max)",
    "Poligrafiya va kataloglar",
    "3D modellashtirish",
  ],
  talim: [
    "Ingliz tili (IELTS / CEFR / General)",
    "Matematika va mental arifmetika",
    "Rus tili so'zlashuv",
    "Dasturlash asoslari darslari",
    "Abituriyentlar tayyorlovi",
    "Arab tili va tajvid",
    "Fizika va kimyo fanlari",
  ],
  transport: [
    "Kuryerlik xizmati (Shahar bo'ylab)",
    "Yuk tashish (Labo / Gazel / Porter)",
    "Taksi va shaharlararo qatnov",
    "Shaxsiy haydovchilik xizmati",
    "Uy va ofis ko'chirish (Yuk ortuvchilar bilan)",
    "Evakuator xizmati",
  ],
  tozalash: [
    "Kvartira va uylarni tozalash",
    "Ta'mirdan keyingi klining",
    "Gilam va yumshoq mebel yuvish",
    "Deraza va vitrina yuvish",
    "Ofis va tijorat joylarini tozalash",
    "Hovli va fasadni bosim ostida yuvish",
  ],
  gozallik: [
    "Erkaklar sartaroshi (Barber)",
    "Ayollar soch turmagi va buyash",
    "Makiyaj va visaj",
    "Manikyur va pedikyur",
    "Davolash va relaks massaji",
    "Kosmetologiya va yuz tozalash",
  ],
  media: [
    "To'y va marosimlar fotosessiyasi",
    "Video montaj va Reels/Shorts",
    "Dron orqali tasvirga olish",
    "Ovoz yozish va diktorlik",
    "SMM video kontent tayyorlash",
  ],
  savdo: [
    "Do'kon sotuvchisi va maslahatchi",
    "Kassir (1C bilimi bilan)",
    "Savdo vakili (Savdo agenti)",
    "Call-center operatori",
    "Omborchi (Skladchi)",
  ],
  oshpazlik: [
    "Marosim va to'ylar uchun osh pishirish",
    "Uyga oshpaz (Banket / ziyofat)",
    "Pishiriqlar, shirinliklar va tortlar",
    "Ofitsiantlar brigadasi",
    "Fast-food ustasi (Pitsa, lavash, burger)",
  ],
  avto: [
    "Avtoelektrik va kompyuter diagnostika",
    "Xodovoy (Shassi) qismini tuzatish",
    "Dvigatel (Motor) ta'mirlash",
    "Kuzov va bo'yash (Malyarka)",
    "Vulkanizatsiya va balansirovka",
    "Moy va filtrlar almashtirish",
    "Konditsioner to'ldirish va tuzatish",
  ],
  boshqa: [
    "Yuk tushiruvchi (Gruzchik)",
    "Hovli va bog'bonlik xizmati",
    "Tikuvchi va kiyim to'g'rilash",
    "Qorovul va xavfsizlik",
    "Tezkor usta (Har xil mayda ishlar)",
  ],
};

// Preset quick-select feature chips
const PRESET_FEATURES = [
  "Kafolat beriladi (100%)",
  "Tezkor yetib borish (30–60 daqiqa)",
  "O'z professional asboblari bor",
  "Rasmiy shartnoma va chek",
  "Bepul maslahat va o'lchash",
  "24/7 xizmat ko'rsatish",
  "Tajribali mutaxassis (5+ yil)",
  "Hamyonbop va kelishilgan narx",
  "Ish joyi tozalab, saranjomlab ketiladi",
  "Shahar bo'ylab yetib boriladi",
  "Sifatli original ehtiyot qismlar",
];

// Keyword → category slug mapping for Uzbek terms
const KEYWORD_MAP: Record<string, string[]> = {
  santexnik: ['santexnika'],
  suv: ['santexnika'],
  kran: ['santexnika'],
  ariston: ['santexnika'],
  quvur: ['santexnika'],
  truba: ['santexnika'],
  kanalizatsiya: ['santexnika'],
  tyopliy: ['santexnika'],
  isitish: ['santexnika'],

  elektr: ['elektrik'],
  tok: ['elektrik'],
  rozetka: ['elektrik'],
  lyustra: ['elektrik'],
  sim: ['elektrik'],
  generator: ['elektrik'],

  remont: ['qurilish'],
  kafel: ['qurilish'],
  malyar: ['qurilish'],
  shpaklyovka: ['qurilish'],
  gipsokarton: ['qurilish'],
  laminat: ['qurilish'],
  eshik: ['qurilish'],
  rom: ['qurilish'],
  quruvchi: ['qurilish'],
  suvoq: ['qurilish'],

  dastur: ['it-dasturlash'],
  sayt: ['it-dasturlash'],
  veb: ['it-dasturlash'],
  bot: ['it-dasturlash'],
  react: ['it-dasturlash'],
  python: ['it-dasturlash'],
  kompyuter: ['it-dasturlash'],
  tizim: ['it-dasturlash'],

  dizayn: ['dizayn'],
  logo: ['dizayn'],
  banner: ['dizayn'],
  interer: ['dizayn'],
  figma: ['dizayn'],

  ingliz: ['talim'],
  rus: ['talim'],
  matematika: ['talim'],
  repetitor: ['talim'],
  dars: ['talim'],
  arab: ['talim'],
  ielts: ['talim'],

  taksi: ['transport'],
  kuryer: ['transport'],
  yuk: ['transport'],
  haydovchi: ['transport'],
  labo: ['transport'],
  gazel: ['transport'],
  yetkazib: ['transport'],

  tozalash: ['tozalash'],
  klining: ['tozalash'],
  gilam: ['tozalash'],
  ximchistka: ['tozalash'],
  uborka: ['tozalash'],

  soch: ['gozallik'],
  sartarosh: ['gozallik'],
  barber: ['gozallik'],
  makiyaj: ['gozallik'],
  manikyur: ['gozallik'],
  massaj: ['gozallik'],

  foto: ['media'],
  video: ['media'],
  reels: ['media'],
  montaj: ['media'],
  dron: ['media'],
  surat: ['media'],

  sotuvchi: ['savdo'],
  kassa: ['savdo'],
  kassir: ['savdo'],
  magazin: ['savdo'],
  ombor: ['savdo'],

  oshpaz: ['oshpazlik'],
  tort: ['oshpazlik'],
  shirinlik: ['oshpazlik'],
  somsa: ['oshpazlik'],
  osh: ['oshpazlik'],
  ovqat: ['oshpazlik'],

  avto: ['avto'],
  mashina: ['avto'],
  motor: ['avto'],
  xodovoy: ['avto'],
  moy: ['avto'],
  balansirovka: ['avto'],
};

export const CreateListingPage: React.FC<CreateListingPageProps> = ({ onNavigate, onCreated, editListingId }) => {
  const { user } = useAuth();
  const isEditing = !!editListingId;

  // Step 1: Listing type selection
  const [selectedType, setSelectedType] = useState<ListingType | null>(null);

  // Reference data
  const [categories, setCategories] = useState<Category[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [userOrgs, setUserOrgs] = useState<Organization[]>([]);

  // Form Fields
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [regionId, setRegionId] = useState(user?.region_id || '');
  const [districtId, setDistrictId] = useState(user?.district_id || '');
  const [latitude, setLatitude] = useState<number | undefined>(user?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(user?.longitude);

  // Clickable Subcategory / Service items (1-tap selection)
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);

  // Clickable Feature Chips (1-tap selection)
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
    "Kafolat beriladi (100%)",
    "Tezkor yetib borish (30–60 daqiqa)",
    "O'z professional asboblari bor",
  ]);

  // Optional manual description (user only expands if they want)
  const [customDescription, setCustomDescription] = useState('');
  const [isCustomDescOpen, setIsCustomDescOpen] = useState(false);

  // Pricing
  const [priceType, setPriceType] = useState<PriceType>('FIXED');
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');

  // Employment
  const [salaryType, setSalaryType] = useState<SalaryType>('SALARY_FIXED');
  const [salaryMin, setSalaryMin] = useState<string>('');
  const [salaryMax, setSalaryMax] = useState<string>('');
  const [workFormat, setWorkFormat] = useState<WorkFormat>('ONSITE');
  const [experienceLevel, setExperienceLevel] = useState('1-3');

  // Contact time
  const [contactTime, setContactTime] = useState<ContactTime>('ANY_TIME');
  const [contactCustomText, setContactCustomText] = useState('');
  const [organizationId, setOrganizationId] = useState<string>('');

  // Images (up to 8 images)
  const [images, setImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Videos (Faza 13 — up to 2 short clips)
  const [videos, setVideos] = useState<string[]>([]);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  // Monetization config (Faza 5)
  const [monetization, setMonetization] = useState<PublicMonetization | null>(null);
  useEffect(() => {
    getPublicMonetization().then(setMonetization).catch(() => {});
  }, []);

  // Edit mode (Faza 15): load existing listing and prefill the form
  const [isLoadingEdit, setIsLoadingEdit] = useState(!!editListingId);
  useEffect(() => {
    if (!editListingId) return;
    (async () => {
      try {
        const l = await apiRequest<any>(`/api/listings/${editListingId}`);
        if (!l) return;
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
        const skillsArr: string[] = Array.isArray(l.skills)
          ? l.skills
          : (() => { try { return JSON.parse(l.skills || '[]'); } catch { return []; } })();
        setSelectedSubcategories(skillsArr);
        setSelectedFeatures([]);
        setCustomDescription(l.description || '');
        const media: string[] = Array.isArray(l.images) ? l.images : [];
        const isVid = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);
        setImages(media.filter((u) => !isVid(u)));
        setVideos(media.filter((u) => isVid(u)));
        if (l.district_id && l.region_id) {
          apiRequest<District[]>(`/api/locations/districts?region_id=${l.region_id}`).then(setDistricts).catch(() => {});
        }
      } catch (err) {
        console.error('Edit listing load error:', err);
        setError("E'lonni yuklashda xatolik");
      } finally {
        setIsLoadingEdit(false);
      }
    })();
  }, [editListingId]);

  // Smart suggestions derived from Title
  const [suggestedCategories, setSuggestedCategories] = useState<Category[]>([]);
  const [aiSuggestion, setAiSuggestion] = useState<{
    catalog_id?: string;
    category_id?: string;
    subcategory_id?: string;
    type?: ListingType;
    confidence?: number;
    reasoning_uz?: string;
  } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Target catalog for current selectedType
  const currentCatalogId = useMemo(() => {
    if (selectedType === 'JOB_OPENING' || selectedType === 'JOB_SEEKER') return 'jobs';
    return 'services';
  }, [selectedType]);

  // Find currently active category object
  const activeCategory = useMemo(() => {
    return categories.find((c) => c.id === categoryId);
  }, [categories, categoryId]);

  // Only root/parent categories for current catalog
  const parentCategories = useMemo(() => {
    return categories.filter((c) => !c.parent_id && (!c.catalog_id || c.catalog_id === currentCatalogId));
  }, [categories, currentCatalogId]);

  // Available subcategories dynamically resolved from DB subcategories + keyword dictionary
  const availableSubcategories = useMemo(() => {
    if (!activeCategory) return [];
    const dbSubs = categories
      .filter((c) => c.parent_id === activeCategory.id)
      .map((c) => c.name_uz);
    const staticSubs = SUBCATEGORIES_BY_SLUG[activeCategory.slug] || [];
    return Array.from(new Set([...dbSubs, ...staticSubs]));
  }, [activeCategory, categories]);

  // Auto-compose structured description from all selections
  const autoGeneratedDescription = useMemo(() => {
    const parts: string[] = [];
    if (title.trim()) {
      parts.push(title.trim());
    }
    if (activeCategory) {
      parts.push(`Kategoriya: ${activeCategory.name_uz}`);
    }
    if (selectedSubcategories.length > 0) {
      parts.push(`Ko'rsatiladigan xizmatlar: ${selectedSubcategories.join(', ')}`);
    }
    if (selectedFeatures.length > 0) {
      parts.push(`Afzalliklar va shartlar: ${selectedFeatures.join(', ')}`);
    }

    const formatLabels: Record<string, string> = {
      ONSITE: "Joyida (Mijoz xonadonida yoki ob'ektda)",
      REMOTE: "Masofaviy (Online)",
      HYBRID: "Gibrid (Aralash)",
    };
    parts.push(`Ish / xizmat shakli: ${formatLabels[workFormat] || 'Joyida'}`);

    const expLabels: Record<string, string> = {
      none: "Yangi boshlovchi (Tajribasiz)",
      '1-3': "1–3 yil tajriba",
      '3-5': "3–5 yil tajriba",
      '5+': "5 yildan ortiq professional tajriba",
    };
    if (experienceLevel) {
      parts.push(`Tajriba: ${expLabels[experienceLevel] || experienceLevel}`);
    }

    const contactLabels: Record<string, string> = {
      ANY_TIME: "Istalgan vaqtda (24/7 aloqa)",
      MORNING: "Ertalab (09:00 – 13:00)",
      AFTERNOON: "Kunduzi (13:00 – 18:00)",
      EVENING: "Kechqurun (18:00 – 21:00)",
      CUSTOM: contactCustomText || "Kelishilgan vaqtda",
    };
    parts.push(`Bog'lanish: ${contactLabels[contactTime]}`);

    if (customDescription.trim()) {
      parts.push(`Qo'shimcha izoh: ${customDescription.trim()}`);
    }

    return parts.join('. ') + '.';
  }, [
    title,
    activeCategory,
    selectedSubcategories,
    selectedFeatures,
    workFormat,
    experienceLevel,
    contactTime,
    contactCustomText,
    customDescription,
  ]);

  // Compute smart category suggestions when title changes
  useEffect(() => {
    const words = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (words.length === 0 || title.length < 3) {
      setSuggestedCategories([]);
      return;
    }

    const scored = parentCategories.map((cat) => {
      const catName = cat.name_uz.toLowerCase();
      const catSlug = (cat.slug || '').toLowerCase();
      const childSubs = categories.filter((c) => c.parent_id === cat.id);
      let score = 0;
      const matchedSubs: string[] = [];

      for (const word of words) {
        if (catName.includes(word) || catSlug.includes(word)) score += 5;
        for (const sub of childSubs) {
          if (sub.name_uz.toLowerCase().includes(word) || sub.slug.toLowerCase().includes(word)) {
            score += 12;
            if (!matchedSubs.includes(sub.name_uz)) matchedSubs.push(sub.name_uz);
          }
        }
        const mapped = KEYWORD_MAP[word] || [];
        for (const m of mapped) {
          if (catSlug.includes(m) || catName.includes(m)) score += 6;
          for (const sub of childSubs) {
            if (sub.slug.toLowerCase().includes(m) || sub.name_uz.toLowerCase().includes(m)) {
              score += 10;
              if (!matchedSubs.includes(sub.name_uz)) matchedSubs.push(sub.name_uz);
            }
          }
        }
      }
      return { cat, score, matchedSubs };
    });

    const top = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    setSuggestedCategories(top.map((s) => s.cat));

    // If user hasn't chosen category yet and top suggestion has a strong score, auto-highlight
    if (!categoryId && top.length === 1) {
      setCategoryId(top[0].cat.id);
      if (top[0].matchedSubs.length > 0) {
        setSelectedSubcategories((prev) => Array.from(new Set([...prev, ...top[0].matchedSubs])));
      }
    }
  }, [title, categories, parentCategories, categoryId]);

  const requestAiSuggestion = async (searchTitle?: string) => {
    const text = (searchTitle !== undefined ? searchTitle : title).trim();
    if (!text || text.length < 3) return;
    setIsAiLoading(true);
    try {
      const res = await apiRequest<{
        catalog_id: string;
        category_id: string;
        subcategory_id: string;
        type: ListingType;
        confidence: number;
        reasoning_uz: string;
      }>('/api/ai/suggest-category', {
        method: 'POST',
        body: JSON.stringify({ title: text, description: customDescription }),
      });
      if (res && res.category_id) {
        setAiSuggestion(res);
      }
    } catch (err) {
      console.warn('AI suggestion error:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const applyAiSuggestion = () => {
    if (!aiSuggestion) return;
    if (aiSuggestion.type && !selectedType) {
      setSelectedType(aiSuggestion.type);
    }
    if (aiSuggestion.category_id) {
      setCategoryId(aiSuggestion.category_id);
    }
    if (aiSuggestion.subcategory_id) {
      const sub = categories.find((c) => c.id === aiSuggestion.subcategory_id);
      if (sub) {
        setSelectedSubcategories((prev) => Array.from(new Set([...prev, sub.name_uz])));
      }
    }
  };

  // Load initial data
  useEffect(() => {
    apiRequest<Category[]>('/api/categories').then(setCategories).catch(console.error);
    apiRequest<Region[]>('/api/locations/regions').then(setRegions).catch(console.error);
    apiRequest<Organization[]>('/api/organizations/my/list').then(setUserOrgs).catch(console.error);
  }, []);

  // Load districts on region change
  useEffect(() => {
    if (!regionId) {
      setDistricts([]);
      return;
    }
    apiRequest<District[]>(`/api/locations/districts?region_id=${regionId}`)
      .then(setDistricts)
      .catch(console.error);
  }, [regionId]);

  const handleToggleSubcategory = (item: string) => {
    setSelectedSubcategories((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleToggleFeature = (feat: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(feat) ? prev.filter((f) => f !== feat) : [...prev, feat]
    );
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

  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

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

  const handleRemoveVideo = (indexToRemove: number) => {
    setVideos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

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
          const detected = await apiRequest<{
            region_id: string;
            region_name: string;
            district_id: string;
            district_name: string;
          }>(`/api/locations/detect?lat=${lat}&lon=${lon}`);

          if (detected?.region_id) {
            setRegionId(detected.region_id);
            const dists = await apiRequest<District[]>(
              `/api/locations/districts?region_id=${detected.region_id}`
            );
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
    if (!selectedType) return;

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

    setIsSubmitting(true);
    setError('');

    // Combine selected subcategories + selected features into the skills array
    const combinedSkills = Array.from(new Set([...selectedSubcategories, ...selectedFeatures]));

    // Auto description ensures the user never fails validation without writing long essays
    const finalDescription = autoGeneratedDescription;

    try {
      const payload = {
        catalog_id: currentCatalogId,
        type: selectedType,
        title: title.trim(),
        description: finalDescription,
        category_id: categoryId,
        region_id: regionId,
        district_id: districtId,
        latitude,
        longitude,
        price_type: priceType,
        price_min: priceMin ? parseFloat(priceMin) : undefined,
        price_max: priceMax ? parseFloat(priceMax) : undefined,
        salary_type:
          selectedType === 'JOB_OPENING' || selectedType === 'JOB_SEEKER' ? salaryType : undefined,
        salary_min: salaryMin ? parseFloat(salaryMin) : undefined,
        salary_max: salaryMax ? parseFloat(salaryMax) : undefined,
        work_format: workFormat,
        experience_level: experienceLevel || undefined,
        skills: combinedSkills,
        contact_time: contactTime,
        contact_custom_text: contactCustomText || undefined,
        organization_id: organizationId || undefined,
        images,
        videos,
      };

      if (isEditing && editListingId) {
        const updated = await apiRequest<any>(`/api/listings/${editListingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onCreated(updated?.id || editListingId);
      } else {
        const res = await apiRequest<any>('/api/listings', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onCreated(res.id);
      }
    } catch (err: any) {
      setError(err.message || (isEditing ? "E'lonni tahrirlashda xatolik" : "E'lon joylashda xatolik yuz berdi"));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 pb-28">
      {isLoadingEdit ? (
        <div className="space-y-4 animate-pulse">
          <div className="w-48 h-8 bg-gray-200 rounded-lg" />
          <div className="h-96 bg-gray-100 rounded-3xl" />
        </div>
      ) : (
      /* ── STEP 1: Select Type ── */
      !selectedType ? (
        <div className="space-y-6">
          <div className="text-center max-w-lg mx-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-3 border border-blue-100">
              <Sparkles className="w-3.5 h-3.5" />
              Tezkor va qulay e'lon joylash
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Qanday e'lon bermoqchisiz?
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-2">
              Kerakli bo'limni tanlang. Barcha parametrlar taklif qilinadi, qo'lda uzun matn yozishingiz shart emas!
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* SERVICE_OFFER */}
            <button
              type="button"
              onClick={() => setSelectedType('SERVICE_OFFER')}
              className="p-5 rounded-2xl border-2 border-gray-100 bg-white hover:border-blue-500 hover:shadow-lg transition-all text-left group flex items-start gap-4 cursor-pointer"
            >
              <div className="p-3.5 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                <Wrench className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-sm text-gray-900 block group-hover:text-blue-600 transition-colors">
                  O'z xizmatlaringizni taklif qilish
                </span>
                <span className="text-xs text-gray-500 mt-1 block leading-relaxed">
                  Santexnika, ta'mirlash, klining, repetitorlik kabi o'z xizmatlaringizni taklif qiling.
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 mt-3 group-hover:translate-x-1 transition-transform">
                  Tanlash <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>

            {/* SERVICE_REQUEST */}
            <button
              type="button"
              onClick={() => setSelectedType('SERVICE_REQUEST')}
              className="p-5 rounded-2xl border-2 border-gray-100 bg-white hover:border-amber-500 hover:shadow-lg transition-all text-left group flex items-start gap-4 cursor-pointer"
            >
              <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all shrink-0">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-sm text-gray-900 block group-hover:text-amber-600 transition-colors">
                  Usta yoki xizmat qidirish
                </span>
                <span className="text-xs text-gray-500 mt-1 block leading-relaxed">
                  Muammo yoki vazifani belgilang, mohir ustalar darhol siz bilan bog'lanishadi.
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 mt-3 group-hover:translate-x-1 transition-transform">
                  Tanlash <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>

            {/* JOB_OPENING */}
            <button
              type="button"
              onClick={() => setSelectedType('JOB_OPENING')}
              className="p-5 rounded-2xl border-2 border-gray-100 bg-white hover:border-emerald-500 hover:shadow-lg transition-all text-left group flex items-start gap-4 cursor-pointer"
            >
              <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all shrink-0">
                <Briefcase className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-sm text-gray-900 block group-hover:text-emerald-600 transition-colors">
                  Vakansiya / Ish o'rni joylash
                </span>
                <span className="text-xs text-gray-500 mt-1 block leading-relaxed">
                  Kompaniya yoki shaxsiy biznes uchun rasmiy xodim yollash (Vakansiya joylash).
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-3 group-hover:translate-x-1 transition-transform">
                  Tanlash <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>

            {/* JOB_SEEKER */}
            <button
              type="button"
              onClick={() => setSelectedType('JOB_SEEKER')}
              className="p-5 rounded-2xl border-2 border-gray-100 bg-white hover:border-purple-500 hover:shadow-lg transition-all text-left group flex items-start gap-4 cursor-pointer"
            >
              <div className="p-3.5 rounded-2xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-sm text-gray-900 block group-hover:text-purple-600 transition-colors">
                  Ish qidiryapman (Rezyume)
                </span>
                <span className="text-xs text-gray-500 mt-1 block leading-relaxed">
                  O'z rezyumengizni joylab, qiziqarli takliflar va doimiy ish o'rniga ega bo'ling.
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 mt-3 group-hover:translate-x-1 transition-transform">
                  Tanlash <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          </div>
        </div>
      ) : (
        /* ── STEP 2: The Smart Form ── */
        <div className="bg-white rounded-3xl border border-gray-100 p-5 sm:p-8 shadow-xs">
          <div className="flex items-center justify-between pb-5 border-b border-gray-100 mb-6">
            {isEditing ? (
              <button
                type="button"
                onClick={() => onNavigate(`/listing/${editListingId}`)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>E'longa qaytish</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedType(null)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Boshqa turga o'zgartirish</span>
              </button>
            )}
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
              {selectedType === 'SERVICE_OFFER' && '🔧 Xizmat taklifi'}
              {selectedType === 'SERVICE_REQUEST' && "🔍 Xizmat so'rovi"}
              {selectedType === 'JOB_OPENING' && '💼 Ish o‘rni (Vakansiya)'}
              {selectedType === 'JOB_SEEKER' && '👤 Ish qidiruvchi (Rezyume)'}
            </span>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <X className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* If user owns organizations and is posting a job opening or service offer */}
            {userOrgs.length > 0 &&
              (selectedType === 'JOB_OPENING' || selectedType === 'SERVICE_OFFER') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-gray-500" />
                    Qaysi nomdan e'lon bermoqchisiz?
                  </label>
                  <select
                    value={organizationId}
                    onChange={(e) => setOrganizationId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">O'zim nomimdan ({user?.name})</option>
                    {userOrgs.map((org) => (
                      <option key={org.id} value={org.id}>
                        Tashkilot: {org.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            {/* 1. TITLE INPUT WITH REAL-TIME AI SUGGESTIONS */}
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <label className="text-xs font-bold text-gray-800">
                  Xizmat yoki ish nomi <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => requestAiSuggestion(title)}
                    disabled={isAiLoading || !title.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold transition-all border border-purple-200 cursor-pointer disabled:opacity-40"
                    title="Gemini AI orqali eng mos kategoriya va parametrni aniqlash"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin text-purple-600' : 'text-purple-600'}`} />
                    <span>{isAiLoading ? 'AI tahlil qilmoqda...' : '✨ AI orqali aniqlash'}</span>
                  </button>
                  <span className="hidden sm:inline text-[11px] text-gray-400">Masalan: Santexnik, Dasturchi</span>
                </div>
              </div>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  if (title.trim().length >= 5 && !categoryId && !aiSuggestion) {
                    requestAiSuggestion(title);
                  }
                }}
                placeholder={
                  selectedType === 'SERVICE_OFFER'
                    ? "Masalan: Professional santexnika va tyopliy pol ustasi"
                    : selectedType === 'SERVICE_REQUEST'
                    ? "Masalan: Kran almashtirish va quvur montaji uchun santexnik kerak"
                    : selectedType === 'JOB_OPENING'
                    ? "Masalan: Restoranga tajribali oshpaz va kassa operatori"
                    : "Masalan: Frontend dasturchi (React / Next.js) ish qidiryapman"
                }
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
              />

              {/* AI Suggestion Card */}
              {aiSuggestion && (
                <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-r from-purple-50/90 via-indigo-50/80 to-blue-50/90 border border-purple-200 shadow-xs animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0 mt-0.5">
                        ✨
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-gray-900">
                            AI Tavsiyasi: {categories.find((c) => c.id === aiSuggestion.category_id)?.name_uz || 'Topildi'}
                          </span>
                          {aiSuggestion.subcategory_id && (
                            <span className="text-xs font-semibold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-md">
                              → {categories.find((c) => c.id === aiSuggestion.subcategory_id)?.name_uz || ''}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">
                          {aiSuggestion.reasoning_uz || 'E’loningiz sarlavhasi tahlili asosida tanlandi'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={applyAiSuggestion}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-bold transition-all shrink-0 shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Tavsiyani qo‘llash</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Smart Category suggestion chips right under the title */}
              {suggestedCategories.length > 0 && (
                <div className="mt-2.5 p-3 rounded-2xl bg-blue-50/70 border border-blue-100 animate-fadeIn">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-900 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Nomingizga mos topilgan kategoriyalar:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestedCategories.map((cat) => {
                      const isSelected = categoryId === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategoryId(cat.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-50'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                          <span>{cat.name_uz}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. CATEGORY SELECTOR */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-800">
                  {currentCatalogId === 'jobs' ? 'Ish sohasi' : 'Kategoriya'} <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                  {currentCatalogId === 'jobs' ? '💼 Ish e’lonlari katalogi' : '🛠 Xizmatlar katalogi'}
                </span>
              </div>
              <select
                required
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setSelectedSubcategories([]);
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">
                  {currentCatalogId === 'jobs' ? 'Ish sohasini tanlang...' : 'Kategoriyani tanlang...'}
                </option>
                {parentCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_uz}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. SUBCATEGORIES / SERVICE ITEMS (Bir-bir.uz / Avito style 1-tap select) */}
            {availableSubcategories.length > 0 && (
              <div className="p-4 rounded-2xl bg-gray-50/70 border border-gray-100">
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-blue-600" />
                    Yo'nalish va xizmat turlari (bir bosishda tanlang)
                  </label>
                  <span className="text-[11px] text-gray-400">
                    {selectedSubcategories.length} ta tanlandi
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableSubcategories.map((item) => {
                    const isSelected = selectedSubcategories.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => handleToggleSubcategory(item)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold shadow-xs'
                            : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-700'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                        <span>{item}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. PRESET FEATURES & ADVANTAGES (Taklif qilingan parametrlar) */}
            <div className="p-4 rounded-2xl bg-blue-50/40 border border-blue-100/70">
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Qulayliklar va afzalliklar (qo'lda yozmasdan belgilang)
                </label>
                <span className="text-[11px] text-blue-600 font-semibold">
                  {selectedFeatures.length} ta afzallik
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESET_FEATURES.map((feat) => {
                  const isSelected = selectedFeatures.includes(feat);
                  return (
                    <button
                      key={feat}
                      type="button"
                      onClick={() => handleToggleFeature(feat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white font-bold shadow-xs'
                          : 'bg-white border border-gray-200 text-gray-700 hover:border-emerald-300 hover:text-emerald-700'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                      <span>{feat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. WORK FORMAT & EXPERIENCE (Avito style segmented buttons) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Work format */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-2">
                  Ish / Xizmat joyi (Formati)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'ONSITE', label: '🏠 Joyida' },
                    { id: 'REMOTE', label: '💻 Masofaviy' },
                    { id: 'HYBRID', label: '🔄 Gibrid' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setWorkFormat(f.id as WorkFormat)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                        workFormat === f.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Experience level */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-2">
                  Kerakli tajriba darajasi
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'none', label: 'Yangi' },
                    { id: '1-3', label: '1–3 yil' },
                    { id: '3-5', label: '3–5 yil' },
                    { id: '5+', label: '5+ yil' },
                  ].map((exp) => (
                    <button
                      key={exp.id}
                      type="button"
                      onClick={() => setExperienceLevel(exp.id)}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        experienceLevel === exp.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {exp.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 6. PRICING / SALARY BLOCK */}
            {selectedType === 'JOB_OPENING' || selectedType === 'JOB_SEEKER' ? (
              <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-purple-600" />
                    Ish haqi (Maosh)
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={salaryType}
                    onChange={(e) => setSalaryType(e.target.value as SalaryType)}
                    className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="SALARY_FIXED">Aniq maosh</option>
                    <option value="SALARY_RANGE">Oraliq (Dan - Gacha)</option>
                    <option value="SALARY_NEGOTIABLE">Kelishiladi</option>
                  </select>

                  {salaryType !== 'SALARY_NEGOTIABLE' && (
                    <input
                      type="number"
                      placeholder="Boshlang‘ich summa (UZS)"
                      value={salaryMin}
                      onChange={(e) => setSalaryMin(e.target.value)}
                      className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500"
                    />
                  )}

                  {salaryType === 'SALARY_RANGE' && (
                    <input
                      type="number"
                      placeholder="Maksimal summa (UZS)"
                      value={salaryMax}
                      onChange={(e) => setSalaryMax(e.target.value)}
                      className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500"
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                    Narx / Byudjet
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={priceType}
                    onChange={(e) => setPriceType(e.target.value as PriceType)}
                    className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="FIXED">Aniq narx</option>
                    <option value="FROM">...dan boshlanadi</option>
                    <option value="RANGE">Narx oralig'i</option>
                    <option value="NEGOTIABLE">Kelishiladi</option>
                    <option value="FREE">Bepul</option>
                  </select>

                  {priceType !== 'NEGOTIABLE' && priceType !== 'FREE' && (
                    <input
                      type="number"
                      placeholder="Minimal summa (UZS)"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  )}

                  {priceType === 'RANGE' && (
                    <input
                      type="number"
                      placeholder="Maksimal summa (UZS)"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>
            )}

            {/* 7. LOCATION (Viloyat & Tuman) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1.5">
                  Viloyat / Shahar <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={regionId}
                  onChange={(e) => {
                    setRegionId(e.target.value);
                    setDistrictId('');
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs font-medium"
                >
                  <option value="">Tanlang...</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name_uz}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1.5">
                  Tuman <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  disabled={!regionId}
                  value={districtId}
                  onChange={(e) => setDistrictId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs font-medium disabled:opacity-50"
                >
                  <option value="">Tanlang...</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name_uz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* GPS Auto Detect */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs">
              <div className="flex items-center gap-2 text-gray-700">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  {latitude && longitude
                    ? 'Aniq GPS koordinatalar belgilandi'
                    : 'Yaqin atrofdagi qidiruv reytingi uchun GPS'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleDetectGPS}
                disabled={isLocating}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? 'Aniqlanmoqda...' : 'GPS-ni aniqlash'}</span>
              </button>
            </div>

            {/* 8. CONTACT TIME PREFERENCE */}
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-2">
                Bog'lanish qulay vaqti
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'ANY_TIME', label: '🕒 24/7 (Istalgan)' },
                  { id: 'MORNING', label: '☀️ 09:00 - 13:00' },
                  { id: 'AFTERNOON', label: '🌤️ 13:00 - 18:00' },
                  { id: 'EVENING', label: '🌙 18:00 - 21:00' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setContactTime(item.id as ContactTime)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                      contactTime === item.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 9. SMART AUTO-GENERATED SUMMARY (No manual typing required) */}
            <div className="p-4 rounded-2xl bg-linear-to-br from-blue-50/60 to-indigo-50/60 border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-blue-950">
                    E'lon tafsilotlari (Avtomatik tuzildi)
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  Qo'lda yozish shart emas
                </span>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed font-medium">
                {autoGeneratedDescription}
              </p>

              {/* Optional custom text expander */}
              <div className="mt-3 pt-3 border-t border-blue-100/70">
                <button
                  type="button"
                  onClick={() => setIsCustomDescOpen(!isCustomDescOpen)}
                  className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${isCustomDescOpen ? 'rotate-180' : ''}`}
                  />
                  <span>
                    {isCustomDescOpen
                      ? "Qo'shimcha izoh maydonini yopish"
                      : "✏️ O'z qo'lim bilan qo'shimcha izoh kiritish (ixtiyoriy)"}
                  </span>
                </button>

                {isCustomDescOpen && (
                  <div className="mt-2.5 animate-fadeIn">
                    <textarea
                      rows={3}
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      placeholder="Ixtiyoriy: Agar alohida qo'shimcha shart yoki eslatmangiz bo'lsa bu yerga yozishingiz mumkin..."
                      className="w-full bg-white border border-blue-200 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 10. IMAGES UPLOAD (Up to 8 images) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-800">
                  Rasmlar (Ko'pi bilan 8 ta)
                </label>
                <span className="text-[11px] text-gray-400">{images.length}/8 ta rasm</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {images.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-2xl overflow-hidden border border-gray-200 group"
                  >
                    <img src={url} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-700 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    {idx === 0 && (
                      <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-blue-600 text-white">
                        Asosiy muqova
                      </span>
                    )}
                  </div>
                ))}

                {images.length < 8 && (
                  <button
                    type="button"
                    disabled={isUploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-2xl border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/30 flex flex-col items-center justify-center p-3 text-center transition-colors cursor-pointer"
                  >
                    <UploadCloud
                      className={`w-6 h-6 text-gray-400 mb-1 ${
                        isUploadingImage ? 'animate-bounce text-blue-600' : ''
                      }`}
                    />
                    <span className="text-[11px] font-bold text-gray-600">
                      {isUploadingImage ? 'Yuklanmoqda...' : 'Rasm yuklash'}
                    </span>
                  </button>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                multiple
                className="hidden"
              />
            </div>

            {/* 10b. VIDEO UPLOAD (Faza 13 — up to 2 clips) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-800">
                  Video (Ko'pi bilan 2 ta, MP4/WebM)
                </label>
                <span className="text-[11px] text-gray-400">{videos.length}/2 ta video</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {videos.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-2xl overflow-hidden border border-gray-200 group bg-black"
                  >
                    <video src={url} className="w-full h-full object-cover" muted playsInline />
                    <button
                      type="button"
                      onClick={() => handleRemoveVideo(idx)}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-700 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-violet-600 text-white">
                      Video
                    </span>
                  </div>
                ))}

                {videos.length < 2 && (
                  <button
                    type="button"
                    disabled={isUploadingVideo}
                    onClick={() => videoInputRef.current?.click()}
                    className="aspect-square rounded-2xl border-2 border-dashed border-gray-300 hover:border-violet-500 hover:bg-violet-50/30 flex flex-col items-center justify-center p-3 text-center transition-colors cursor-pointer"
                  >
                    <UploadCloud
                      className={`w-6 h-6 text-gray-400 mb-1 ${
                        isUploadingVideo ? 'animate-bounce text-violet-600' : ''
                      }`}
                    />
                    <span className="text-[11px] font-bold text-gray-600">
                      {isUploadingVideo ? 'Yuklanmoqda...' : 'Video yuklash'}
                    </span>
                  </button>
                )}
              </div>
              <input
                type="file"
                ref={videoInputRef}
                onChange={handleVideoUpload}
                accept="video/mp4,video/webm"
                className="hidden"
              />
            </div>

            {/* Immediate lifecycle notification notice (monetization-aware, Faza 5) — hidden while editing */}
            {!isEditing && (() => {
              const activeDays = monetization?.active_days ?? 30;
              const isPaid = monetization?.mode === 'PAID';
              const listingPrice = monetization
                ? currentCatalogId === 'jobs'
                  ? monetization.prices.listing.jobs
                  : monetization.prices.listing.services
                : 0;
              return (
                <div
                  className={`p-3.5 rounded-2xl border text-xs leading-relaxed flex items-center gap-2 ${
                    isPaid
                      ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                      : 'bg-emerald-50/70 border-emerald-100 text-emerald-900'
                  }`}
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  {isPaid ? (
                    <span>
                      Ushbu e'lon narxi: <b>{listingPrice.toLocaleString('uz-UZ')} so'm</b> (balansdan
                      yechiladi). E'lon {activeDays} kun davomida faol bo'ladi, so'ng uni uzaytirishingiz
                      mumkin.
                    </span>
                  ) : (
                    <span>
                      <b>Test davri: bepul.</b> E'loningiz {activeDays} kun davomida faol turadi, so'ng
                      arxivga o'tadi va uni bepul uzaytirishingiz mumkin.
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Action buttons */}
            <div className="pt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => (isEditing ? onNavigate(`/listing/${editListingId}`) : setSelectedType(null))}
                className="py-3 px-6 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs cursor-pointer"
              >
                {isEditing ? 'Bekor qilish' : 'Orqaga'}
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>{isEditing ? 'Saqlanmoqda...' : 'Chop etilmoqda...'}</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isEditing ? "O'zgarishlarni saqlash" : "E'lonni darhol chop etish"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )
      )}
    </div>
  );
};
