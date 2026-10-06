import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { Region, District } from '../../types/index.ts';
import { apiRequest, uploadImageFile } from '../../lib/api.ts';
import { MapPin, Sparkles, Navigation, Camera, Loader2, CheckCircle2 } from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import { useI18n } from '../../i18n/IntlContext.tsx';

/**
 * Mandatory profile-completion step shown after any sign-up / first login
 * (email or Google). Collects real name, phone (required), profile photo
 * (upload locally or keep the Google photo) and location.
 */
export const ProfileCompletionModal: React.FC = () => {
  const { t, localized } = useI18n();
  const { user, isProfileModalOpen, profileCanSkip, closeProfileModal, completeProfile } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [bio, setBio] = useState('');
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [regionId, setRegionId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [geoLocating, setGeoLocating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const seeded = useRef(false);

  // Seed the form once per open from the current user.
  useEffect(() => {
    if (!isProfileModalOpen || !user || seeded.current) return;
    const nameParts = (user.name || '').trim().split(/\s+/);
    setFirstName(nameParts[0] === user.email?.split('@')[0] ? '' : nameParts[0] || '');
    setLastName(nameParts.slice(1).join(' ') || '');
    setPhone(user.phone || '');
    setPhotoUrl(user.profile_photo_url || '');
    setBio(user.bio || '');
    setRegionId(user.region_id || '');
    setDistrictId(user.district_id || '');
    setLat(user.latitude);
    setLng(user.longitude);
    seeded.current = true;
  }, [isProfileModalOpen, user]);

  useEffect(() => {
    if (!isProfileModalOpen) {
      seeded.current = false;
      setError('');
      return;
    }
    apiRequest<Region[]>('/api/locations/regions').then(setRegions).catch(console.error);
  }, [isProfileModalOpen]);

  useEffect(() => {
    if (!regionId) {
      setDistricts([]);
      return;
    }
    apiRequest<District[]>(`/api/locations/districts?region_id=${regionId}`)
      .then(setDistricts)
      .catch(console.error);
  }, [regionId]);

  if (!isProfileModalOpen) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadImageFile(file, 'avatars');
      setPhotoUrl(url);
    } catch (err: any) {
      setError(err.message || t('profile.errPhoto'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError(t('profile.pcErrGeo'));
      return;
    }
    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        setLat(latitude);
        setLng(longitude);
        try {
          const detected = await apiRequest<{ region_id: string; district_id: string }>(
            `/api/locations/detect?lat=${latitude}&lon=${longitude}`
          );
          if (detected?.region_id) {
            setRegionId(detected.region_id);
            const dists = await apiRequest<District[]>(`/api/locations/districts?region_id=${detected.region_id}`);
            setDistricts(dists);
            if (detected.district_id) setDistrictId(detected.district_id);
          }
        } catch (err) {
          console.warn('Avtomatik tuman aniqlashda xatolik:', err);
        } finally {
          setGeoLocating(false);
        }
      },
      () => {
        setError(t('home.gpsDenied'));
        setGeoLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (firstName.trim().split(/\s+/).length < 1 || !lastName.trim()) {
      setError(t('profile.pcErrName'));
      return;
    }
    if (phone.replace(/\D/g, '').length < 9) {
      setError(t('profile.pcErrPhone'));
      return;
    }
    if (!regionId || !districtId) {
      setError(t('create.errRegionDistrict'));
      return;
    }

    setIsSubmitting(true);
    try {
      await completeProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        profile_photo_url: photoUrl,
        region_id: regionId,
        district_id: districtId,
        bio: bio.trim() || undefined,
        latitude: lat,
        longitude: lng,
      });
    } catch (err: any) {
      setError(err.message || t('profile.errSave'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isProfileModalOpen}
      onClose={closeProfileModal}
      size="lg"
      dismissable={profileCanSkip}
      hideClose={!profileCanSkip}
    >
      <div className="text-center mb-5">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-6 h-6" />
        </div>
        <h3 className="font-extrabold text-lg text-gray-900">{t('profile.pcTitle')}</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
          {t('profile.pcSub')}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photo */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <img
              src={photoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(firstName + lastName || 'TopHand')}`}
              alt={t('profile.pcAvatarAlt')}
              className="w-20 h-20 rounded-2xl object-cover ring-2 ring-gray-100 bg-gray-50"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm hover:bg-blue-700 cursor-pointer disabled:opacity-50"
              aria-label={t('profile.pcUploadAria')}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800">{t('profile.pcPhotoLabel')} <span className="text-gray-400 font-medium">({t('common.optional')})</span></p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {user?.has_google ? t('profile.pcPhotoGoogle') : t('profile.pcPhotoSelf')}
            </p>
            {photoUrl && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 mt-1 cursor-pointer"
              >
                {uploading ? t('home.loading') : t('profile.pcChangePhoto')}
              </button>
            )}
          </div>
        </div>

        {/* Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {t('profile.pcFirst')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jaloliddin"
              required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {t('profile.pcLast')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Xalimov"
              required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Phone (required) */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {t('profile.pcPhone')} <span className="text-rose-500">*</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
            required
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-[11px] text-gray-400 mt-0.5">
            {t('profile.pcPhoneHint')}
          </p>
        </div>

        {/* Region + District */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {t('create.regionLabel')} <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={regionId}
              onChange={(e) => {
                setRegionId(e.target.value);
                setDistrictId('');
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('create.selectPh')}</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{localized(r)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {t('profile.pcDistrict')} <span className="text-rose-500">*</span>
            </label>
            <select
              required
              disabled={!regionId}
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">{t('create.selectPh')}</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{localized(d)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* GPS Auto Detect */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-xs">
          <div className="flex items-center gap-2 text-gray-700">
            <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{lat && lng ? t('create.gpsSet') : t('create.gpsNearby')}</span>
          </div>
          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={geoLocating}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Navigation className={`w-3.5 h-3.5 ${geoLocating ? 'animate-spin' : ''}`} />
            <span>{geoLocating ? t('home.detecting') : lat ? t('profile.pcRedetect') : t('profile.pcAllow')}</span>
          </button>
        </div>

        {/* Bio (optional) */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{t('profile.pcBio')} ({t('common.optional')})</label>
          <textarea
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t('profile.pcBioPh')}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="pt-1 flex flex-col gap-2">
          <button
            type="submit"
            disabled={isSubmitting || uploading}
            className="w-full h-[48px] rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{isSubmitting ? t('profile.pcSaving') : t('profile.pcSaveBtn')}</span>
          </button>
          {profileCanSkip && (
            <button
              type="button"
              onClick={closeProfileModal}
              className="w-full text-center text-xs font-semibold text-gray-500 hover:text-gray-800 py-1 cursor-pointer"
            >
              {t('profile.pcSkip')}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default ProfileCompletionModal;
