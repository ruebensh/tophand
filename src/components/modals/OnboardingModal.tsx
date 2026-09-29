import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { Region, District } from '../../types/index.ts';
import { apiRequest } from '../../lib/api.ts';
import { MapPin, Sparkles, Navigation } from 'lucide-react';

export const OnboardingModal: React.FC = () => {
  const { user, isOnboardingOpen, closeOnboardingModal, refreshUser } = useAuth();

  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState(user?.region_id || '');
  const [selectedDistrictId, setSelectedDistrictId] = useState(user?.district_id || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [lat, setLat] = useState<number | undefined>(user?.latitude);
  const [lng, setLng] = useState<number | undefined>(user?.longitude);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [geoLocating, setGeoLocating] = useState(false);

  useEffect(() => {
    if (isOnboardingOpen) {
      apiRequest<Region[]>('/api/locations/regions')
        .then(setRegions)
        .catch(console.error);
    }
  }, [isOnboardingOpen]);

  useEffect(() => {
    if (!selectedRegionId) {
      setDistricts([]);
      return;
    }
    apiRequest<District[]>(`/api/locations/districts?region_id=${selectedRegionId}`)
      .then(setDistricts)
      .catch(console.error);
  }, [selectedRegionId]);

  if (!isOnboardingOpen) return null;

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError('Brauzeringiz geolokatsiyani qo‘llab-quvvatlamaydi');
      return;
    }

    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGeoLocating(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setError('Joylashuvni aniqlashga ruxsat berilmadi');
        setGeoLocating(false);
      },
      { timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegionId || !selectedDistrictId) {
      setError('Iltimos, viloyat va tumanni tanlang');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await apiRequest('/api/auth/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          region_id: selectedRegionId,
          district_id: selectedDistrictId,
          phone: phone.trim() || undefined,
          bio: bio.trim() || undefined,
          latitude: lat,
          longitude: lng,
        }),
      });

      await refreshUser();
      closeOnboardingModal();
    } catch (err: any) {
      setError(err.message || 'Saqlashda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-lg text-gray-900">Xush kelibsiz, {user?.name}!</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Sizga yaqin atrofdagi eng mos e’lonlar va xizmatlarni tavsiya qilishimiz uchun asosiy hududingizni belgilang.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Region and District */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Viloyat / Shahar <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={selectedRegionId}
                onChange={(e) => {
                  setSelectedRegionId(e.target.value);
                  setSelectedDistrictId('');
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Tuman <span className="text-rose-500">*</span>
              </label>
              <select
                required
                disabled={!selectedRegionId}
                value={selectedDistrictId}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
          <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-xs">
            <div className="flex items-center gap-2 text-gray-700">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{lat && lng ? 'Aniq GPS koordinatalar belgilandi' : 'Aniq masofani hisoblash uchun GPS'}</span>
            </div>
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={geoLocating}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 shrink-0"
            >
              <Navigation className={`w-3.5 h-3.5 ${geoLocating ? 'animate-spin' : ''}`} />
              <span>{geoLocating ? 'Aniqlanmoqda...' : lat ? 'Qayta aniqlash' : 'Ruxsat berish'}</span>
            </button>
          </div>

          {/* Phone (Optional, Section 3: never publicly displayed on profile) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Telefon raqami (ixtiyoriy)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-gray-400 mt-0.5">
              Telefon raqamingiz profilingizda ochiq ko‘rinmaydi, faqat qo‘ng‘iroq tugmasi orqali xavfsiz taqdim etiladi.
            </p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              O‘zingiz haqingizda qisqacha
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Masalan: 10 yillik tajribaga ega usta yoki IT sohasida mutaxassis..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-gray-400 mt-0.5">
              Tavsif va rasm profildagi reyting va qidiruv natijalarida ustuvorlik beradi.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-md transition-colors"
            >
              {isSubmitting ? 'Saqlanmoqda...' : 'Davom etish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
