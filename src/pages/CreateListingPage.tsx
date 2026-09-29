import React, { useState, useEffect, useRef } from 'react';
import { ListingType, PriceType, SalaryType, ContactTime, WorkFormat, Category, Region, District, Organization } from '../types/index.ts';
import { apiRequest, uploadImageFile } from '../lib/api.ts';
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
} from 'lucide-react';

interface CreateListingPageProps {
  onNavigate: (route: string) => void;
  onCreated: (listingId: string) => void;
}

export const CreateListingPage: React.FC<CreateListingPageProps> = ({ onNavigate, onCreated }) => {
  const { user } = useAuth();

  // Step 1: Listing type selection
  const [selectedType, setSelectedType] = useState<ListingType | null>(null);

  // Reference data
  const [categories, setCategories] = useState<Category[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [userOrgs, setUserOrgs] = useState<Organization[]>([]);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [regionId, setRegionId] = useState(user?.region_id || '');
  const [districtId, setDistrictId] = useState(user?.district_id || '');
  const [latitude, setLatitude] = useState<number | undefined>(user?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(user?.longitude);

  // Pricing
  const [priceType, setPriceType] = useState<PriceType>('FIXED');
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');

  // Employment
  const [salaryType, setSalaryType] = useState<SalaryType>('SALARY_FIXED');
  const [salaryMin, setSalaryMin] = useState<string>('');
  const [salaryMax, setSalaryMax] = useState<string>('');
  const [workFormat, setWorkFormat] = useState<WorkFormat>('ONSITE');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [skillsText, setSkillsText] = useState('');

  // Contact time
  const [contactTime, setContactTime] = useState<ContactTime>('ANY_TIME');
  const [contactCustomText, setContactCustomText] = useState('');
  const [organizationId, setOrganizationId] = useState<string>('');

  // Images (up to 8 images)
  const [images, setImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isLocating, setIsLocating] = useState(false);

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

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert('Brauzeringiz geolokatsiyani qo‘llab-quvvatlamaydi');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setIsLocating(false);
        alert('Aniq koordinatalar muvaffaqiyatli belgilandi');
      },
      () => {
        setIsLocating(false);
        alert('Joylashuvni aniqlashga ruxsat berilmadi');
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) return;

    if (!title.trim() || title.trim().length < 5) {
      setError('Sarlavha kamida 5 ta belgidan iborat bo‘lishi kerak');
      return;
    }

    if (!description.trim() || description.trim().length < 15) {
      setError('Tavsif kamida 15 ta belgidan iborat bo‘lishi kerak');
      return;
    }

    if (!categoryId) {
      setError('Kategoriyani tanlang');
      return;
    }

    if (!regionId || !districtId) {
      setError('Viloyat va tumanni belgilang');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const parsedSkills = skillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await apiRequest<any>('/api/listings', {
        method: 'POST',
        body: JSON.stringify({
          type: selectedType,
          title: title.trim(),
          description: description.trim(),
          category_id: categoryId,
          region_id: regionId,
          district_id: districtId,
          latitude,
          longitude,
          price_type: priceType,
          price_min: priceMin ? parseFloat(priceMin) : undefined,
          price_max: priceMax ? parseFloat(priceMax) : undefined,
          salary_type: selectedType === 'JOB_OPENING' || selectedType === 'JOB_SEEKER' ? salaryType : undefined,
          salary_min: salaryMin ? parseFloat(salaryMin) : undefined,
          salary_max: salaryMax ? parseFloat(salaryMax) : undefined,
          work_format: workFormat,
          experience_level: experienceLevel || undefined,
          skills: parsedSkills,
          contact_time: contactTime,
          contact_custom_text: contactCustomText || undefined,
          organization_id: organizationId || undefined,
          images,
        }),
      });

      onCreated(res.id);
    } catch (err: any) {
      setError(err.message || 'E’lon joylashda xatolik yuz berdi');
      setIsSubmitting(false);
    }
  };

  const TYPE_OPTIONS = [
    {
      type: 'SERVICE_OFFER' as ListingType,
      label: 'Xizmat taklif qilaman',
      desc: 'Siz ustasiz, mutaxassis yoki xizmat ko‘rsatuvchisiz. O‘z xizmatlaringizni reklama qiling.',
      icon: Wrench,
      color: 'border-blue-500 bg-blue-50/40 text-blue-700',
      badgeColor: 'bg-blue-600',
    },
    {
      type: 'SERVICE_REQUEST' as ListingType,
      label: 'Xizmat kerak',
      desc: 'Sizga usta, ta’mirlovchi yoki biror ishni bajarib beradigan mutaxassis zarur.',
      icon: HelpCircle,
      color: 'border-amber-500 bg-amber-50/40 text-amber-700',
      badgeColor: 'bg-amber-600',
    },
    {
      type: 'JOB_OPENING' as ListingType,
      label: 'Ishchi qidiraman',
      desc: 'Kompaniya, do‘kon yoki loyihangiz uchun yangi xodimlarni ishga taklif eting.',
      icon: Briefcase,
      color: 'border-purple-500 bg-purple-50/40 text-purple-700',
      badgeColor: 'bg-purple-600',
    },
    {
      type: 'JOB_SEEKER' as ListingType,
      label: 'Ish qidiraman',
      desc: 'Siz o‘z sohangizda yangi ish o‘rni yoki qulay vakansiya qidirayotgan mutaxassisiz.',
      icon: UserCheck,
      color: 'border-emerald-500 bg-emerald-50/40 text-emerald-700',
      badgeColor: 'bg-emerald-600',
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Step 1: Type Selection (Section 40) */}
      {!selectedType ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-10 shadow-xs">
          <div className="text-center mb-8">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              1-qadam / 2
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950 mt-1">
              Qanday e’lon bermoqchisiz?
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-2 max-w-md mx-auto">
              E’lon turiga qarab sizga mos maydonlar va qidiruv filtrlari avtomatik moslashadi.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TYPE_OPTIONS.map((opt) => {
              const IconComp = opt.icon;
              return (
                <button
                  key={opt.type}
                  onClick={() => setSelectedType(opt.type)}
                  className="flex flex-col items-start p-5 rounded-2xl border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50/20 text-left transition-all group shadow-2xs hover:shadow-md"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white mb-3 ${opt.badgeColor}`}>
                    <IconComp className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-gray-900 group-hover:text-blue-600 transition-colors">
                    {opt.label}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {opt.desc}
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                    <span>Tanlash</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Step 2: Form with contextual dynamic fields */
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-10 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
            <button
              onClick={() => setSelectedType(null)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>E’lon turini o‘zgartirish</span>
            </button>

            <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {TYPE_OPTIONS.find((t) => t.type === selectedType)?.label}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 mb-6">
            E’lon ma’lumotlarini to‘ldiring
          </h1>

          {error && (
            <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* If user owns organizations and is posting a job opening or service offer, allow posting as org */}
            {userOrgs.length > 0 && (selectedType === 'JOB_OPENING' || selectedType === 'SERVICE_OFFER') && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Qaysi nomdan e’lon bermoqchisiz?
                </label>
                <select
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">O‘zim nomimdan ({user?.name})</option>
                  {userOrgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      Tashkilot: {org.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Sarlavha <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  selectedType === 'SERVICE_OFFER'
                    ? "Masalan: Professional santexnika va tyopliy pol ustasi (10 yillik tajriba)"
                    : selectedType === 'SERVICE_REQUEST'
                    ? "Masalan: Suv quvuri yorildi, shoshilinch santexnik kerak"
                    : selectedType === 'JOB_OPENING'
                    ? "Masalan: Iqtisodiyot mavzulari bo‘yicha tahlilchi jurnalist"
                    : "Masalan: Frontend dasturchi (React, TypeScript) ish qidiryapman"
                }
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Kategoriya <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Kategoriyani tanlang...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_uz}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Batafsil tavsif <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Xizmat tafsilotlari, tajriba, shartlar yoki muammoni batafsil bayon qiling..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 leading-relaxed"
              />
            </div>

            {/* Pricing / Salary Contextual Block */}
            {selectedType === 'JOB_OPENING' || selectedType === 'JOB_SEEKER' ? (
              <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-3">
                <h4 className="font-bold text-xs text-purple-900 uppercase tracking-wider">
                  Ish haqi (Maosh)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={salaryType}
                    onChange={(e) => setSalaryType(e.target.value as SalaryType)}
                    className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500"
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Ish formati
                    </label>
                    <select
                      value={workFormat}
                      onChange={(e) => setWorkFormat(e.target.value as WorkFormat)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium"
                    >
                      <option value="ONSITE">Joyida (Ofis / Korxona)</option>
                      <option value="REMOTE">Masofaviy (Remote)</option>
                      <option value="HYBRID">Gibrid (Aralash)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Kerakli tajriba
                    </label>
                    <input
                      type="text"
                      placeholder="Masalan: 2+ yil yoki Tajribasiz"
                      value={experienceLevel}
                      onChange={(e) => setExperienceLevel(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-3">
                <h4 className="font-bold text-xs text-blue-900 uppercase tracking-wider">
                  Narx / Byudjet
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={priceType}
                    onChange={(e) => setPriceType(e.target.value as PriceType)}
                    className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="FIXED">Aniq narx</option>
                    <option value="FROM">...dan boshlanadi</option>
                    <option value="RANGE">Narx oralig‘i</option>
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

            {/* Skills & Experience */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Asosiy ko‘nikmalar yoki teglarni kiriting (vergul bilan ajrating)
              </label>
              <input
                type="text"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder="Santexnika, Ekoplast, Montaj, Isitish tizimlari..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium"
              />
            </div>

            {/* Location block */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Viloyat / Shahar <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={regionId}
                  onChange={(e) => {
                    setRegionId(e.target.value);
                    setDistrictId('');
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium"
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
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Tuman <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  disabled={!regionId}
                  value={districtId}
                  onChange={(e) => setDistrictId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium disabled:opacity-50"
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
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? 'Aniqlanmoqda...' : 'GPS-ni aniqlash'}</span>
              </button>
            </div>

            {/* Contact time preference (Section 31) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Bog‘lanish vaqti
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={contactTime}
                  onChange={(e) => setContactTime(e.target.value as ContactTime)}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium"
                >
                  <option value="ANY_TIME">Istalgan vaqtda</option>
                  <option value="MORNING">Ertalab (09:00 – 13:00)</option>
                  <option value="AFTERNOON">Kunduzi (13:00 – 18:00)</option>
                  <option value="EVENING">Kechqurun (18:00 – 21:00)</option>
                  <option value="CUSTOM">Boshqa vaqt</option>
                </select>

                {contactTime === 'CUSTOM' && (
                  <input
                    type="text"
                    placeholder="Masalan: Dushanba-Juma 10:00 dan 17:00 gacha"
                    value={contactCustomText}
                    onChange={(e) => setContactCustomText(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium"
                  />
                )}
              </div>
            </div>

            {/* Images upload (Section 15: Up to 8 images, real uploads) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-700">
                  Rasmlar (Ko‘pi bilan 8 ta)
                </label>
                <span className="text-[11px] text-gray-400">{images.length}/8 ta rasm</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {images.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-gray-200 group">
                    <img src={url} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-700 transition-colors"
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
                    className="aspect-square rounded-2xl border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/30 flex flex-col items-center justify-center p-3 text-center transition-colors"
                  >
                    <UploadCloud className={`w-6 h-6 text-gray-400 mb-1 ${isUploadingImage ? 'animate-bounce text-blue-600' : ''}`} />
                    <span className="text-[11px] font-semibold text-gray-600">
                      {isUploadingImage ? 'Yuklanmoqda...' : 'Rasm qo‘shish'}
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

            {/* Immediate 30-day lifecycle notification notice */}
            <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 text-xs text-blue-900 leading-relaxed flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                E’lon joylangach, darhol faol holatga o‘tadi va 30 kun davomida amal qiladi. 30 kundan so‘ng uni bepul uzaytirishingiz mumkin.
              </span>
            </div>

            {/* Action buttons */}
            <div className="pt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedType(null)}
                className="py-3 px-6 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs"
              >
                Orqaga
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-sm shadow-md transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Chop etilmoqda...' : 'E’lonni darhol chop etish'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
