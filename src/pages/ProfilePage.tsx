import React, { useState, useEffect, useRef } from 'react';
import { User, Listing, Region, District } from '../types/index.ts';
import { apiRequest, uploadImageFile, getPublicMonetization, type PublicMonetization } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { ListingCard } from '../components/listings/ListingCard.tsx';
import { AccountLinkingCard } from '../components/modals/AccountLinkingCard.tsx';
import { PushNotificationsCard } from '../components/profile/PushNotificationsCard.tsx';
import {
  MapPin,
  Calendar,
  ShieldCheck,
  UserCheck,
  UserPlus,
  RefreshCw,
  Archive,
  Clock,
  List,
  Edit3,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  ShieldQuestion,
  Camera,
  Loader2,
  MessageSquare,
  Settings,
  Lock,
  Phone,
  Sparkles,
  Palette,
  Check,
  X,
  ImageOff,
} from 'lucide-react';
import { formatDateAgo, isOfficialAccount, isStaffAccount } from '../lib/utils.ts';
import { VerifiedBadge } from '../components/common/VerifiedBadge.tsx';
import { FollowListModal } from '../components/modals/FollowListModal.tsx';
import { VerifyRequestModal } from '../components/modals/VerifyRequestModal.tsx';

interface ProfilePageProps {
  userId: string;
  onNavigate: (route: string) => void;
  onOpenListing: (id: string) => void;
}

// 10 xil tayyor ranglar aralashmasi (Preset cover gradients) — och, sayt stilliga mos
export const COVER_GRADIENTS = [
  {
    id: 'sky-bliss',
    name: 'Sky Bliss',
    style: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 40%, #C7D2FE 100%)',
  },
  {
    id: 'peach-glow',
    name: 'Peach Glow',
    style: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 40%, #FED7AA 100%)',
  },
  {
    id: 'rose-blush',
    name: 'Rose Blush',
    style: 'linear-gradient(135deg, #FCE7F3 0%, #FBCFE8 40%, #FDE8D8 100%)',
  },
  {
    id: 'mint-fresh',
    name: 'Mint Fresh',
    style: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 40%, #CFFAFE 100%)',
  },
  {
    id: 'lavender-soft',
    name: 'Lavender Soft',
    style: 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 45%, #E0E7FF 100%)',
  },
  {
    id: 'tophand-light',
    name: 'TopHand Light',
    style: 'linear-gradient(135deg, #DBEAFE 0%, #E0F2FE 50%, #F0F9FF 100%)',
  },
  {
    id: 'sunrise-peach',
    name: 'Sunrise Peach',
    style: 'linear-gradient(135deg, #FEF9C3 0%, #FED7AA 50%, #FECACA 100%)',
  },
  {
    id: 'soft-lilac',
    name: 'Soft Lilac',
    style: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 45%, #FCE7F3 100%)',
  },
  {
    id: 'cool-mist',
    name: 'Cool Mist',
    style: 'linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 45%, #CFFAFE 100%)',
  },
  {
    id: 'cream-cloud',
    name: 'Cream Cloud',
    style: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 45%, #E2E8F0 100%)',
  },
];

// Tasdiq nishoni holati kartasi
const VerifyStatusCard: React.FC<{
  status: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectionReason?: string | null;
  onRequest: () => void;
}> = ({ status, rejectionReason, onRequest }) => {
  if (status === 'VERIFIED') {
    return (
      <div className="flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl bg-emerald-50/80 border-2 border-emerald-200">
        <VerifiedBadge size="md" />
        <div className="min-w-0">
          <p className="font-bold text-sm text-emerald-900">Tasdiqlangan profil</p>
          <p className="text-xs text-emerald-700 mt-0.5">Shaxsingiz pasport orqali rasman tekshirilgan.</p>
        </div>
      </div>
    );
  }

  if (status === 'PENDING') {
    return (
      <div className="flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl bg-amber-50/80 border-2 border-amber-200">
        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-amber-900">Arizangiz ko‘rib chiqilmoqda</p>
          <p className="text-xs text-amber-700 mt-0.5">Ma’muriyat ma’lumotlaringizni tekshirmoqda. Natija haqida xabar beramiz.</p>
        </div>
      </div>
    );
  }

  if (status === 'REJECTED') {
    return (
      <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl bg-rose-50/80 border-2 border-rose-200">
        <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-rose-900">Arizangiz rad etildi</p>
          <p className="text-xs text-rose-700 mt-0.5">
            Sabab: {rejectionReason || 'Hujjatlarda noaniqliklar mavjud'}
          </p>
          <button
            type="button"
            onClick={onRequest}
            className="mt-2.5 h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Qayta yuborish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 sm:p-4 rounded-2xl bg-blue-50/80 border-2 border-blue-200">
      <div className="w-9 h-9 rounded-full bg-blue-100 text-[#1673E6] flex items-center justify-center shrink-0">
        <ShieldQuestion className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-sm text-gray-900">Tasdiq nishonini oling</p>
        <p className="text-xs text-gray-600 mt-0.5">
          Pasportingizni tasdiqlab, profil va e’lonlaringizga ishonchni oshiring.
        </p>
      </div>
      <button
        type="button"
        onClick={onRequest}
        className="shrink-0 h-9 px-4 rounded-xl bg-[#1673E6] hover:bg-[#125FD0] text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
      >
        <CheckCircle2 className="w-4 h-4" />
        <span>Tasdiqlash</span>
      </button>
    </div>
  );
};

export const ProfilePage: React.FC<ProfilePageProps> = ({
  userId,
  onNavigate,
  onOpenListing,
}) => {
  const { user: currentUser, logout, openLoginModal, refreshUser } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [archivedListings, setArchivedListings] = useState<Listing[]>([]);
  const [activeTab, setActiveTab] = useState<'feed' | 'archive' | 'settings'>('feed');
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isFollowed, setIsFollowed] = useState(false);
  const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
  const [followModalTab, setFollowModalTab] = useState<'followers' | 'following'>('followers');
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [editCover, setEditCover] = useState('');
  const [editCoverGradient, setEditCoverGradient] = useState('');
  const [editRegionId, setEditRegionId] = useState('');
  const [editDistrictId, setEditDistrictId] = useState('');
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const isOwner = currentUser?.id === userId;

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const u = await apiRequest<User>(`/api/users/${userId}`);
      setProfileUser(u);
      setIsFollowed(u.is_followed || false);
      setEditName(u.name || '');
      setEditBio(u.bio || '');
      setEditPhone(u.phone || '');
      setEditPhoto(u.profile_photo_url || '');
      setEditCover(u.cover_photo_url || '');
      setEditCoverGradient(u.cover_gradient || '');
      setEditRegionId(u.region_id || '');
      setEditDistrictId(u.district_id || '');

      // Load active listings
      const activeList = await apiRequest<Listing[]>(`/api/users/${userId}/listings?status=ACTIVE`);
      setListings(activeList);

      // Load archived listings if owner
      if (isOwner) {
        const archivedList = await apiRequest<Listing[]>(`/api/users/${userId}/listings?status=ARCHIVED`);
        setArchivedListings(archivedList);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId, isOwner]);

  // Load locations for edit form
  useEffect(() => {
    if (!isOwner || regions.length) return;
    apiRequest<Region[]>('/api/locations/regions').then(setRegions).catch(console.error);
  }, [isOwner, regions.length]);

  useEffect(() => {
    if (!editRegionId) {
      setDistricts([]);
      return;
    }
    apiRequest<District[]>(`/api/locations/districts?region_id=${editRegionId}`)
      .then(setDistricts)
      .catch(console.error);
  }, [editRegionId]);

  // Avatar upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const url = await uploadImageFile(file, 'avatars');
      setEditPhoto(url);
      await apiRequest('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({ profile_photo_url: url }),
      });
      fetchProfile();
      refreshUser().catch(() => {});
    } catch (err: any) {
      alert(err.message || 'Rasm yuklashda xatolik');
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  // Mobile cover photo upload (faqat smartfon versiyada)
  const handleMobileCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCover(true);
    try {
      const url = await uploadImageFile(file, 'listings');
      setEditCover(url);
      await apiRequest('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({ cover_photo_url: url }),
      });
      fetchProfile();
      refreshUser().catch(() => {});
    } catch (err: any) {
      alert(err.message || 'Muqova rasmini yuklashda xatolik');
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  // Shared gradient selection — saves to cover_gradient (used by both mobile and desktop)
  const handleSelectCoverGradient = async (gradientStyle: string) => {
    setEditCoverGradient(gradientStyle);
    try {
      await apiRequest('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({ cover_gradient: gradientStyle }),
      });
      if (profileUser) {
        setProfileUser({ ...profileUser, cover_gradient: gradientStyle });
      }
      setIsThemePickerOpen(false);
    } catch (err: any) {
      alert(err.message || 'Muqova rangini saqlashda xatolik');
    }
  };

  // Remove mobile cover image — falls back to cover_gradient
  const handleRemoveMobileCover = async () => {
    setIsUploadingCover(true);
    try {
      await apiRequest('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({ cover_photo_url: '' }),
      });
      setEditCover('');
      if (profileUser) {
        setProfileUser({ ...profileUser, cover_photo_url: '' });
      }
      refreshUser().catch(() => {});
    } catch (err: any) {
      alert(err.message || 'Rasmni o\'chirishda xatolik');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser) {
      openLoginModal();
      return;
    }

    setIsFollowLoading(true);
    const next = !isFollowed;
    setIsFollowed(next);
    try {
      const res = await apiRequest<{ followed: boolean }>(`/api/users/${userId}/follow`, {
        method: 'POST',
      });
      setIsFollowed(res.followed);
      if (profileUser) {
        setProfileUser({
          ...profileUser,
          follower_count: (profileUser.follower_count || 0) + (res.followed ? 1 : -1),
        });
      }
    } catch (err: any) {
      setIsFollowed(!next);
      alert(err.message || 'Obuna bo‘lishda xatolik');
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleRenewListing = async (listingId: string) => {
    try {
      await apiRequest(`/api/listings/${listingId}/renew`, { method: 'POST' });
      alert('E’lon muvaffaqiyatli uzaytirildi!');
      fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Uzaytirishda xatolik');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await apiRequest('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({
          name: editName,
          bio: editBio,
          phone: editPhone || undefined,
          profile_photo_url: editPhoto || undefined,
          cover_photo_url: editCover || undefined,
          region_id: editRegionId || undefined,
          district_id: editDistrictId || undefined,
        }),
      });
      alert('Profil ma’lumotlari muvaffaqiyatli saqlandi');
      fetchProfile();
      refreshUser().catch(() => {});
    } catch (err: any) {
      alert(err.message || 'Saqlashda xatolik');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('Yangi parollar mos kelmadi');
      return;
    }
    if (newPassword.length < 6) {
      alert('Parol kamida 6 belgidan iborat bo‘lishi kerak');
      return;
    }
    setIsChangingPassword(true);
    try {
      await apiRequest('/api/users/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      alert('Parol muvaffaqiyatli o‘zgartirildi');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      alert(err.message || 'Parolni o‘zgartirishda xatolik');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-28">
        <div className="h-56 sm:h-64 w-full rounded-3xl bg-slate-200 animate-pulse mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-40 bg-slate-100 rounded-3xl animate-pulse" />
          <div className="h-40 bg-slate-100 rounded-3xl animate-pulse" />
          <div className="h-40 bg-slate-100 rounded-3xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="max-w-sm mx-auto my-20 px-4 text-center">
        <p className="text-5xl mb-3">👤</p>
        <h3 className="font-bold text-gray-900 text-lg mb-2">Foydalanuvchi topilmadi</h3>
        <button
          onClick={() => onNavigate('/')}
          className="px-6 py-2.5 rounded-2xl bg-[#1673E6] text-white font-bold text-sm cursor-pointer shadow-sm hover:bg-[#125FD0] transition"
        >
          Bosh sahifaga qaytish
        </button>
      </div>
    );
  }

  // Separate cover backgrounds for mobile (image) and desktop (gradient)
  const defaultGradient = COVER_GRADIENTS[0].style;
  // Mobile: shows uploaded cover image, falls back to gradient or default
  const mobileActiveCoverBg = profileUser.cover_photo_url || profileUser.cover_gradient || defaultGradient;
  // Desktop: shows selected gradient preset, falls back to default (never shows uploaded image)
  const desktopActiveCoverBg = profileUser.cover_gradient || defaultGradient;

  return (
    <>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoUpload}
        className="hidden"
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        onChange={handleMobileCoverUpload}
        className="hidden"
      />

      {/* ══════════════════════════════════════════════════════════════════════
          MOBILE VERSION (md:hidden) — 100% TO'LIQ O'ZGARMAGAN VA DAXSIZ
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden max-w-xl mx-auto px-4 pt-2 pb-28">
        {/* 1. Top Cover Banner */}
        <div
          className="h-48 sm:h-56 w-full rounded-3xl overflow-hidden relative shadow-sm"
          style={{ background: mobileActiveCoverBg.startsWith('linear-gradient') ? mobileActiveCoverBg : undefined }}
        >
          {!mobileActiveCoverBg.startsWith('linear-gradient') && (
            <img
              src={mobileActiveCoverBg}
              alt="Muqova"
              className="w-full h-full object-cover opacity-85"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />

          {/* Upload cover photo button for mobile owner */}
          {isOwner && (
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={isUploadingCover}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 px-3.5 py-1.5 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 transition border border-white/20 shadow-md cursor-pointer"
              title="Muqova rasmini yuklash"
            >
              {isUploadingCover ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
              <span>{isUploadingCover ? 'Yuklanmoqda...' : 'Muqova rasmi'}</span>
            </button>
          )}
        </div>

        {/* 2. Centered Avatar */}
        <div className="relative -mt-16 sm:-mt-18 flex justify-center mb-3">
          <div className="relative p-1.5 bg-white rounded-full shadow-xl">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-slate-900 flex items-center justify-center border-2 border-slate-100">
              {profileUser.profile_photo_url ? (
                <img
                  src={profileUser.profile_photo_url}
                  alt={profileUser.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-[#1673E6] to-[#6C3FD1] flex items-center justify-center text-white font-black text-3xl">
                  {profileUser.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Edit avatar button (for owner) */}
            {isOwner && (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="absolute bottom-1 right-1 z-20 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-md text-[#1673E6] flex items-center justify-center hover:bg-blue-50 transition cursor-pointer"
                title="Profil rasmini almashtirish"
              >
                {isUploadingPhoto ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#1673E6]" />
                ) : (
                  <Edit3 className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* 3. Centered Name, Badges, Phone & Bio */}
        <div className="text-center px-2">
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center justify-center gap-1.5 flex-wrap">
            <span>{profileUser.name}</span>
            {isOfficialAccount(profileUser) ? (
              <VerifiedBadge size="md" variant="official" tooltip="TopHand rasmiy hisobi" />
            ) : isStaffAccount(profileUser) ? (
              <VerifiedBadge size="md" variant="staff" tooltip="TopHand moderatori" />
            ) : profileUser.verification_status === 'VERIFIED' ? (
              <VerifiedBadge size="md" tooltip="Pasport orqali tasdiqlangan" />
            ) : null}
            {isOfficialAccount(profileUser) && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                👑 Rasmiy
              </span>
            )}
          </h1>

          {/* Bio */}
          {profileUser.bio ? (
            <p className="text-sm font-semibold text-gray-700 mt-1.5 max-w-md mx-auto leading-relaxed">
              {profileUser.bio}
            </p>
          ) : (
            <p className="text-sm font-medium text-gray-400 mt-1">
              {profileUser.telegram_username ? `@${profileUser.telegram_username}` : "TopHand a'zosi"}
            </p>
          )}

          {/* Telefon raqami */}
          {profileUser.phone && (
            <div className="mt-2.5 flex items-center justify-center">
              <a
                href={`tel:${profileUser.phone}`}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition shadow-xs"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>{profileUser.phone}</span>
              </a>
            </div>
          )}

          {/* Joylashuv va Sana */}
          <div className="flex items-center justify-center gap-3 text-xs text-gray-400 mt-2 flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#1673E6]" />
              {profileUser.district_name || 'Toshkent'}, {profileUser.region_name || "O'zbekiston"}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              A'zo: {formatDateAgo(profileUser.created_at)}
            </span>
          </div>
        </div>

        {/* 4. Action Buttons */}
        <div className="flex items-center justify-center gap-3 mt-4">
          {isOwner ? (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="px-7 py-2.5 rounded-2xl bg-[#1673E6] hover:bg-[#125FD0] text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition cursor-pointer min-w-[130px]"
              >
                <Settings className="w-4 h-4" />
                <span>Sozlamalar</span>
              </button>
              <button
                type="button"
                onClick={logout}
                className="px-7 py-2.5 rounded-2xl bg-[#F1F5F9] hover:bg-rose-50 text-gray-700 hover:text-rose-600 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer min-w-[130px]"
              >
                <LogOut className="w-4 h-4" />
                <span>Chiqish</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleFollowToggle}
                disabled={isFollowLoading}
                className={`px-7 py-2.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer min-w-[130px] ${
                  isFollowed
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-[#1673E6] hover:bg-[#125FD0] text-white'
                }`}
              >
                {isFollowed ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                <span>{isFollowed ? "Obunadasiz" : "Obuna bo'lish"}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate(`/chat?user=${profileUser.id}`)}
                className="px-7 py-2.5 rounded-2xl bg-[#EAF2FE] hover:bg-[#D3E5FD] text-[#1673E6] font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer min-w-[130px]"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Xabar</span>
              </button>
              {profileUser.phone && (
                <a
                  href={`tel:${profileUser.phone}`}
                  className="w-10 h-10 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition shadow-sm"
                  title="Qo'ng'iroq qilish"
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}
            </>
          )}
        </div>

        {/* 5. Three Stat Cards */}
        <div className="grid grid-cols-3 gap-3 my-5">
          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className="border-2 border-[#D3E5FD] rounded-2xl bg-white p-3 sm:p-4 text-center shadow-xs cursor-pointer hover:border-[#1673E6] hover:bg-blue-50/20 transition"
          >
            <div className="text-xl sm:text-2xl font-black text-gray-900">
              {profileUser.active_listing_count || listings.length}
            </div>
            <div className="text-xs font-semibold text-gray-500 mt-1">E'lonlar</div>
          </button>

          <button
            type="button"
            onClick={() => {
              setFollowModalTab('followers');
              setIsFollowModalOpen(true);
            }}
            className="border-2 border-[#D3E5FD] rounded-2xl bg-white p-3 sm:p-4 text-center shadow-xs cursor-pointer hover:border-[#1673E6] hover:bg-blue-50/20 transition"
          >
            <div className="text-xl sm:text-2xl font-black text-gray-900">
              {profileUser.follower_count || 0}
            </div>
            <div className="text-xs font-semibold text-gray-500 mt-1">Obunachilar</div>
          </button>

          <button
            type="button"
            onClick={() => {
              setFollowModalTab('following');
              setIsFollowModalOpen(true);
            }}
            className="border-2 border-[#D3E5FD] rounded-2xl bg-white p-3 sm:p-4 text-center shadow-xs cursor-pointer hover:border-[#1673E6] hover:bg-blue-50/20 transition"
          >
            <div className="text-xl sm:text-2xl font-black text-gray-900">
              {profileUser.following_count || 0}
            </div>
            <div className="text-xs font-semibold text-gray-500 mt-1">Obunalar</div>
          </button>
        </div>

        {/* 6. Segmented Tabs Bar */}
        <div className="border-2 border-[#D3E5FD] rounded-2xl p-1 bg-white flex items-center gap-1 shadow-xs mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm text-center transition cursor-pointer ${
              activeTab === 'feed'
                ? 'bg-[#F1F5F9] text-[#0F172A] shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            E'lonlar ({listings.length})
          </button>

          {isOwner && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('archive')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm text-center transition cursor-pointer ${
                  activeTab === 'archive'
                    ? 'bg-[#F1F5F9] text-[#0F172A] shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Arxiv ({archivedListings.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm text-center transition cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-[#F1F5F9] text-[#0F172A] shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Sozlamalar
              </button>
            </>
          )}
        </div>

        {/* 7. Tab Contents */}
        {activeTab === 'feed' && (
          <div>
            {listings.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border-2 border-[#D3E5FD] shadow-xs">
                <List className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-bold text-gray-800 text-sm">Hozircha faol e'lonlar mavjud emas</p>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => onNavigate('/create')}
                    className="mt-4 px-6 py-2.5 rounded-2xl bg-[#1673E6] hover:bg-[#125FD0] text-white text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    Yangi e'lon berish
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {listings.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    onClick={() => onOpenListing(l.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {isOwner && activeTab === 'archive' && (
          <div>
            {archivedListings.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border-2 border-[#D3E5FD] shadow-xs">
                <Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-bold text-gray-800 text-sm">Arxivda e'lonlar yo'q</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {archivedListings.map((l) => {
                  const isCompleted = l.status === 'COMPLETED';
                  return (
                    <ListingCard
                      key={l.id}
                      listing={l}
                      dimmed
                      hideSave
                      onClick={() => onOpenListing(l.id)}
                      statusBadge={
                        isCompleted ? undefined : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold text-[10px] border border-amber-300">
                            Arxivda
                          </span>
                        )
                      }
                      footer={
                        isCompleted ? (
                          <p className="text-[10px] text-gray-400 text-center">
                            Yakunlangan e'lon
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenewListing(l.id);
                            }}
                            className="w-full py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Qayta faollashtirish</span>
                          </button>
                        )
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {isOwner && activeTab === 'settings' && (
          <div className="space-y-4">
            {/* Mobile Muqova: Gibrid — Ham rasm, ham gradient */}
            <div className="bg-white rounded-3xl border-2 border-[#D3E5FD] p-4 sm:p-5 shadow-xs">
              <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#1673E6]" />
                <span>Muqova (rasm yoki rang)</span>
              </h3>

              {/* Cover image section */}
              <div className="mb-3.5">
                <p className="text-[11px] font-semibold text-gray-500 mb-2">📸 Muqova rasmi (1-darajali)</p>
                {profileUser.cover_photo_url ? (
                  <div className="flex items-center gap-3">
                    <div className="relative w-24 h-14 rounded-xl overflow-hidden border-2 border-[#1673E6] shrink-0">
                      <img src={profileUser.cover_photo_url} alt="Muqova" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        disabled={isUploadingCover}
                        className="h-8 px-3 rounded-xl bg-[#EAF2FE] hover:bg-[#D3E5FD] text-[#1673E6] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Almashtirish</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveMobileCover}
                        disabled={isUploadingCover}
                        className="h-8 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {isUploadingCover ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageOff className="w-3.5 h-3.5" />}
                        <span>Rasmni o'chirish</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={isUploadingCover}
                    className="w-full h-11 rounded-2xl border-2 border-dashed border-[#D3E5FD] hover:border-[#1673E6] bg-[#F8FBFF] hover:bg-[#EAF2FE] text-[#1673E6] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    {isUploadingCover ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /><span>Yuklanmoqda...</span></>
                    ) : (
                      <><Camera className="w-4 h-4" /><span>Muqova rasmi yuklash</span></>
                    )}
                  </button>
                )}
              </div>

              {/* Gradient divider */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-[#D3E5FD]" />
                <span className="text-[11px] font-semibold text-gray-400">🎨 Fon rangi (2-darajali)</span>
                <div className="flex-1 h-px bg-[#D3E5FD]" />
              </div>

              {/* Gradient picker — shared with desktop (cover_gradient) */}
              <div className="grid grid-cols-5 gap-2 sm:gap-3">
                {COVER_GRADIENTS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSelectCoverGradient(g.style)}
                    className="h-11 rounded-2xl relative shadow-xs border-2 transition transform hover:scale-105 cursor-pointer flex items-center justify-center"
                    style={{
                      background: g.style,
                      borderColor: desktopActiveCoverBg === g.style ? '#1673E6' : 'transparent',
                    }}
                    title={g.name}
                  >
                    {desktopActiveCoverBg === g.style && (
                      <div className="w-5 h-5 rounded-full bg-white text-[#1673E6] flex items-center justify-center shadow-xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Helper hint */}
              {profileUser.cover_photo_url && (
                <p className="text-[11px] text-gray-400 mt-2.5 text-center">
                  💡 Rasm mavjud — fon rangi yashirilgan. Rasmni o'chirsangiz rang ko'rinadi.
                </p>
              )}
            </div>

            {/* Verification status card */}
            {isOfficialAccount(profileUser) ? (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-50/80 border-2 border-amber-200">
                <VerifiedBadge size="md" variant="official" />
                <div>
                  <p className="font-bold text-sm text-amber-900">TopHand rasmiy (premium) hisobi</p>
                  <p className="text-xs text-amber-700 mt-0.5">Avtomatik rasmiy tasdiq nishoni bilan ta'minlangan.</p>
                </div>
              </div>
            ) : isStaffAccount(profileUser) ? (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-purple-50/80 border-2 border-purple-200">
                <VerifiedBadge size="md" variant="staff" />
                <div>
                  <p className="font-bold text-sm text-purple-900">TopHand moderatori hisobi</p>
                  <p className="text-xs text-purple-700 mt-0.5">Siz moderatortsiz. Alohida tasdiq so'rashingiz shart emas.</p>
                </div>
              </div>
            ) : (
              <VerifyStatusCard
                status={profileUser.verification_status || 'UNVERIFIED'}
                rejectionReason={profileUser.verification_rejection_reason}
                onRequest={() => setIsVerifyModalOpen(true)}
              />
            )}

            {/* Edit form */}
            <div className="bg-white rounded-3xl border-2 border-[#D3E5FD] p-4 sm:p-5 shadow-xs">
              <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#1673E6]" />
                <span>Profil ma'lumotlarini to'liq tahrirlash</span>
              </h3>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-gray-200">
                  <div className="flex flex-col items-center text-center">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[#1673E6] bg-slate-200 shrink-0 mb-1.5">
                      <img
                        src={editPhoto || profileUser.profile_photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(editName || 'T')}`}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                      className="text-xs text-[#1673E6] font-bold hover:underline cursor-pointer"
                    >
                      {isUploadingPhoto ? 'Yuklanmoqda...' : 'Profil rasmi'}
                    </button>
                  </div>

                  <div className="flex flex-col items-center text-center">
                    <div
                      className="relative w-24 h-16 rounded-xl overflow-hidden border-2 border-slate-300 bg-slate-800 shrink-0 mb-1.5"
                      style={{ background: mobileActiveCoverBg.startsWith('linear-gradient') ? mobileActiveCoverBg : undefined }}
                    >
                      {!mobileActiveCoverBg.startsWith('linear-gradient') && (
                        <img
                          src={editCover || mobileActiveCoverBg}
                          alt="Cover"
                          className="w-full h-full object-cover opacity-80"
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={isUploadingCover}
                      className="text-xs text-[#1673E6] font-bold hover:underline cursor-pointer"
                    >
                      {isUploadingCover ? 'Yuklanmoqda...' : 'Muqova rasmi'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Ismingiz</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-gray-200 text-sm font-medium focus:border-[#1673E6] focus:bg-white outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Kasbingiz / Bio (Tavsif)</label>
                  <textarea
                    rows={2}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Masalan: Professional usta elektrik, santexnik yoki fotograf"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-gray-200 text-sm font-medium focus:border-[#1673E6] focus:bg-white outline-none transition resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Telefon raqam</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+998 90 123 45 67"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-gray-200 text-sm font-medium focus:border-[#1673E6] focus:bg-white outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Viloyat</label>
                    <select
                      value={editRegionId}
                      onChange={(e) => {
                        setEditRegionId(e.target.value);
                        setEditDistrictId('');
                      }}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-gray-200 text-xs sm:text-sm font-medium focus:border-[#1673E6] focus:bg-white outline-none transition"
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
                    <label className="block text-xs font-bold text-gray-600 mb-1">Tuman</label>
                    <select
                      disabled={!editRegionId}
                      value={editDistrictId}
                      onChange={(e) => setEditDistrictId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-gray-200 text-xs sm:text-sm font-medium focus:border-[#1673E6] focus:bg-white outline-none transition disabled:opacity-50"
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

                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="w-full mt-2 py-2.5 rounded-xl bg-[#1673E6] hover:bg-[#125FD0] text-white font-bold text-xs sm:text-sm shadow-sm transition cursor-pointer"
                >
                  {isSavingProfile ? 'Saqlanmoqda...' : 'O‘zgarishlarni saqlash'}
                </button>
              </form>
            </div>

            <AccountLinkingCard />
            <PushNotificationsCard />

            <div className="bg-white rounded-3xl border-2 border-[#D3E5FD] p-4 sm:p-5 shadow-xs">
              <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#1673E6]" />
                <span>Parolni o'zgartirish</span>
              </h3>

              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Joriy parol</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-gray-200 text-sm font-medium focus:border-[#1673E6] focus:bg-white outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Yangi parol</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-gray-200 text-sm font-medium focus:border-[#1673E6] focus:bg-white outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Qayta kiriting</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-gray-200 text-sm font-medium focus:border-[#1673E6] focus:bg-white outline-none transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-xs sm:text-sm shadow-sm transition cursor-pointer"
                >
                  {isChangingPassword ? 'O‘zgartirilmoqda...' : 'Parolni yangilash'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DESKTOP VERSION (hidden md:block) — PORTFOLIA AESTHETIC DESIGN
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:block max-w-6xl mx-auto px-6 pt-6 pb-28">
        {/* 1. Pure Gradient Banner (Zero text inside! Clean aesthetic mesh gradient) — uses cover_gradient only */}
        <div
          className="h-48 lg:h-56 w-full rounded-[32px] overflow-hidden relative shadow-sm transition-all duration-500"
          style={{
            background: desktopActiveCoverBg,
          }}
        >
          {/* Quick theme picker button for owner */}
          {isOwner && (
            <button
              type="button"
              onClick={() => setIsThemePickerOpen(!isThemePickerOpen)}
              className="absolute top-5 right-5 z-10 px-4 py-2 rounded-2xl bg-white/75 hover:bg-white text-slate-800 text-xs font-bold flex items-center gap-2 transition border border-white/50 shadow-xs backdrop-blur-md cursor-pointer"
              title="Muqova rangini tanlash"
            >
              <Palette className="w-4 h-4 text-[#1673E6]" />
              <span>Muqova rangi</span>
            </button>
          )}

          {/* Theme picker floating dropdown on desktop */}
          {isOwner && isThemePickerOpen && (
            <div className="absolute top-16 right-5 z-30 p-3 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/80 w-72 animate-in fade-in zoom-in duration-150">
              <div className="flex items-center justify-between mb-2.5 px-1">
                <span className="text-xs font-bold text-slate-800">Muqova rangini tanlang</span>
                <button
                  type="button"
                  onClick={() => setIsThemePickerOpen(false)}
                  className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {COVER_GRADIENTS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSelectCoverGradient(g.style)}
                    className="h-10 rounded-xl relative shadow-xs border-2 transition transform hover:scale-105 cursor-pointer flex items-center justify-center"
                    style={{
                      background: g.style,
                      borderColor: desktopActiveCoverBg === g.style ? '#1673E6' : 'transparent',
                    }}
                    title={g.name}
                  >
                    {desktopActiveCoverBg === g.style && (
                      <div className="w-4 h-4 rounded-full bg-white text-[#1673E6] flex items-center justify-center shadow-xs">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2. Overlapping Profile Section: Squircle Avatar (left) + Info (middle) + Stats (right) */}
        <div className="flex items-start justify-between gap-8 px-4 mb-8">
          {/* Left: Squircle Avatar hanging over the bottom of banner */}
          <div className="relative -mt-20 lg:-mt-24 shrink-0 z-20">
            <div className="w-44 h-44 lg:w-48 lg:h-48 rounded-[40px] overflow-hidden bg-slate-900 border-[6px] border-white shadow-xl flex items-center justify-center relative">
              {profileUser.profile_photo_url ? (
                <img
                  src={profileUser.profile_photo_url}
                  alt={profileUser.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-[#1673E6] via-[#125FD0] to-[#6C3FD1] flex items-center justify-center text-white font-black text-5xl">
                  {profileUser.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {isOwner && (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="absolute bottom-2 right-2 z-20 w-9 h-9 rounded-2xl bg-white border border-slate-200 shadow-md text-[#1673E6] flex items-center justify-center hover:bg-blue-50 transition cursor-pointer"
                title="Profil rasmini almashtirish"
              >
                {isUploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* Middle: Name, Bio, Phone, Location & Action Buttons (Sitting on clean white page background) */}
          <div className="flex-1 pt-3.5 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                {profileUser.name}
              </h1>

              {isOfficialAccount(profileUser) ? (
                <VerifiedBadge size="md" variant="official" tooltip="TopHand rasmiy hisobi" />
              ) : isStaffAccount(profileUser) ? (
                <VerifiedBadge size="md" variant="staff" tooltip="TopHand moderatori" />
              ) : profileUser.verification_status === 'VERIFIED' ? (
                <VerifiedBadge size="md" tooltip="Pasport orqali tasdiqlangan" />
              ) : null}

              {isOfficialAccount(profileUser) && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  👑 Rasmiy
                </span>
              )}

              {isStaffAccount(profileUser) && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300">
                  Staff
                </span>
              )}
            </div>

            {/* Subtitle / Bio */}
            <p className="text-sm lg:text-base text-slate-600 font-medium mt-1 line-clamp-2 max-w-xl">
              {profileUser.bio || (profileUser.telegram_username ? `@${profileUser.telegram_username}` : "TopHand platformasi a'zosi")}
            </p>

            {/* Location & Phone & Join Date */}
            <div className="flex items-center gap-3.5 text-xs font-semibold text-slate-400 mt-2.5 flex-wrap">
              <span className="flex items-center gap-1 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-[#1673E6]" />
                {profileUser.district_name || 'Toshkent'}, {profileUser.region_name || "O'zbekiston"}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                A'zo: {formatDateAgo(profileUser.created_at)}
              </span>
              {profileUser.phone && (
                <>
                  <span>•</span>
                  <a
                    href={`tel:${profileUser.phone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition text-xs font-bold"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{profileUser.phone}</span>
                  </a>
                </>
              )}
            </div>

            {/* Action Buttons Row */}
            <div className="flex items-center gap-3 mt-4">
              {isOwner ? (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="px-6 py-2.5 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-sm shadow-sm flex items-center gap-2 transition cursor-pointer"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Sozlamalar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/create')}
                    className="px-6 py-2.5 rounded-2xl bg-[#1673E6] hover:bg-[#125FD0] text-white font-bold text-sm shadow-sm flex items-center gap-2 transition cursor-pointer"
                  >
                    <List className="w-4 h-4" />
                    <span>Yangi e'lon berish</span>
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    className="px-5 py-2.5 rounded-2xl bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 font-bold text-sm flex items-center gap-2 transition cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Chiqish</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleFollowToggle}
                    disabled={isFollowLoading}
                    className={`px-7 py-2.5 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-sm transition cursor-pointer ${
                      isFollowed
                        ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                        : 'bg-slate-900 hover:bg-black text-white'
                    }`}
                  >
                    {isFollowed ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    <span>{isFollowed ? "Obunadasiz" : "Follow"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate(`/chat?user=${profileUser.id}`)}
                    className="px-6 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-sm flex items-center gap-2 transition cursor-pointer shadow-xs"
                  >
                    <MessageSquare className="w-4 h-4 text-[#1673E6]" />
                    <span>Get in touch</span>
                  </button>
                  {profileUser.phone && (
                    <a
                      href={`tel:${profileUser.phone}`}
                      className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2 transition shadow-xs"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Qo'ng'iroq</span>
                    </a>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right: Big Numeric Stats (Portfolia style: Followers, Following, E'lonlar) */}
          <div className="shrink-0 flex items-center gap-7 pt-3.5">
            <button
              type="button"
              onClick={() => {
                setFollowModalTab('followers');
                setIsFollowModalOpen(true);
              }}
              className="text-left group cursor-pointer"
            >
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-[#1673E6] transition">
                Followers
              </p>
              <p className="text-2xl lg:text-3xl font-black text-slate-900 mt-0.5 group-hover:text-[#1673E6] transition">
                {profileUser.follower_count || 0}
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setFollowModalTab('following');
                setIsFollowModalOpen(true);
              }}
              className="text-left group cursor-pointer"
            >
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-[#1673E6] transition">
                Following
              </p>
              <p className="text-2xl lg:text-3xl font-black text-slate-900 mt-0.5 group-hover:text-[#1673E6] transition">
                {profileUser.following_count || 0}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('feed')}
              className="text-left group cursor-pointer"
            >
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-[#1673E6] transition">
                E'lonlar
              </p>
              <p className="text-2xl lg:text-3xl font-black text-slate-900 mt-0.5 group-hover:text-[#1673E6] transition">
                {profileUser.active_listing_count || listings.length}
              </p>
            </button>
          </div>
        </div>

        {/* 3. Desktop Tabs Bar (Portfolia style: Work, Moodboards/Archive, Settings) */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-px mb-8">
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => setActiveTab('feed')}
              className={`pb-3.5 font-extrabold text-sm flex items-center gap-2 transition relative cursor-pointer ${
                activeTab === 'feed'
                  ? 'text-slate-900'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <span>E'lonlar</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'feed' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {listings.length}
              </span>
              {activeTab === 'feed' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 rounded-full" />
              )}
            </button>

            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('archive')}
                  className={`pb-3.5 font-extrabold text-sm flex items-center gap-2 transition relative cursor-pointer ${
                    activeTab === 'archive'
                      ? 'text-slate-900'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <span>Arxiv</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === 'archive' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {archivedListings.length}
                  </span>
                  {activeTab === 'archive' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 rounded-full" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className={`pb-3.5 font-extrabold text-sm flex items-center gap-2 transition relative cursor-pointer ${
                    activeTab === 'settings'
                      ? 'text-slate-900'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>Sozlamalar va Tahrirlash</span>
                  {activeTab === 'settings' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 rounded-full" />
                  )}
                </button>
              </>
            )}
          </div>

          <div className="pb-3 text-xs font-semibold text-slate-400">
            {profileUser.region_name ? `${profileUser.district_name || ''}, ${profileUser.region_name}` : "O'zbekiston"}
          </div>
        </div>

        {/* 4. Desktop Tab Contents */}
        {activeTab === 'feed' && (
          <div>
            {listings.length === 0 ? (
              <div className="p-16 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs max-w-lg mx-auto">
                <List className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="font-extrabold text-slate-800 text-lg">Faol e'lonlar mavjud emas</h3>
                <p className="text-slate-500 text-sm mt-1">Ushbu foydalanuvchi hozircha e'lon joylashtirmagan.</p>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => onNavigate('/create')}
                    className="mt-6 px-7 py-3 rounded-2xl bg-[#1673E6] hover:bg-[#125FD0] text-white text-sm font-bold transition shadow-sm cursor-pointer"
                  >
                    Yangi e'lon berish
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    onClick={() => onOpenListing(l.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {isOwner && activeTab === 'archive' && (
          <div>
            {archivedListings.length === 0 ? (
              <div className="p-16 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs max-w-lg mx-auto">
                <Archive className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="font-extrabold text-slate-800 text-lg">Arxivda e'lonlar yo'q</h3>
                <p className="text-slate-500 text-sm mt-1">Muddati tugagan yoki yakunlangan e'lonlar shu yerda saqlanadi.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {archivedListings.map((l) => {
                  const isCompleted = l.status === 'COMPLETED';
                  return (
                    <ListingCard
                      key={l.id}
                      listing={l}
                      dimmed
                      hideSave
                      onClick={() => onOpenListing(l.id)}
                      statusBadge={
                        isCompleted ? undefined : (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold text-xs border border-amber-300">
                            Arxivda
                          </span>
                        )
                      }
                      footer={
                        isCompleted ? (
                          <p className="text-xs text-slate-400 text-center">
                            Yakunlangan e'lon
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenewListing(l.id);
                            }}
                            className="w-full py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>Qayta faollashtirish</span>
                          </button>
                        )
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {isOwner && activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Muqova rangi tanlash (10 xil variant) */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
                <h3 className="font-bold text-slate-900 text-base mb-3 flex items-center gap-2">
                  <Palette className="w-5 h-5 text-[#1673E6]" />
                  <span>Muqova rangi (10 xil mavzuli variant)</span>
                </h3>
              <div className="grid grid-cols-5 gap-3">
                  {COVER_GRADIENTS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleSelectCoverGradient(g.style)}
                      className="h-12 rounded-2xl relative shadow-xs border-2 transition transform hover:scale-105 cursor-pointer flex items-center justify-center"
                      style={{
                        background: g.style,
                        borderColor: desktopActiveCoverBg === g.style ? '#1673E6' : 'transparent',
                      }}
                      title={g.name}
                    >
                      {desktopActiveCoverBg === g.style && (
                        <div className="w-5 h-5 rounded-full bg-white text-[#1673E6] flex items-center justify-center shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Verification status card */}
              {isOfficialAccount(profileUser) ? (
                <div className="flex items-center gap-4 p-4 rounded-3xl bg-amber-50/90 border border-amber-200">
                  <VerifiedBadge size="md" variant="official" />
                  <div>
                    <p className="font-bold text-sm text-amber-900">TopHand rasmiy (premium) hisobi</p>
                    <p className="text-xs text-amber-700 mt-0.5">Avtomatik rasmiy tasdiq nishoni bilan ta'minlangan.</p>
                  </div>
                </div>
              ) : isStaffAccount(profileUser) ? (
                <div className="flex items-center gap-4 p-4 rounded-3xl bg-purple-50/90 border border-purple-200">
                  <VerifiedBadge size="md" variant="staff" />
                  <div>
                    <p className="font-bold text-sm text-purple-900">TopHand moderatori hisobi</p>
                    <p className="text-xs text-purple-700 mt-0.5">Siz moderatortsiz. Alohida tasdiq so'rashingiz shart emas.</p>
                  </div>
                </div>
              ) : (
                <VerifyStatusCard
                  status={profileUser.verification_status || 'UNVERIFIED'}
                  rejectionReason={profileUser.verification_rejection_reason}
                  onRequest={() => setIsVerifyModalOpen(true)}
                />
              )}

              {/* Full Profile Edit Form */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
                <h3 className="font-bold text-slate-900 text-base mb-5 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-[#1673E6]" />
                  <span>Profil ma'lumotlarini tahrirlash</span>
                </h3>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-[#1673E6] bg-slate-200 shrink-0">
                      <img
                        src={editPhoto || profileUser.profile_photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(editName || 'T')}`}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Profil rasmi</p>
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                        className="text-xs text-[#1673E6] font-bold hover:underline cursor-pointer mt-0.5"
                      >
                        {isUploadingPhoto ? 'Yuklanmoqda...' : 'Rasmni almashtirish'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Ismingiz</label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:border-[#1673E6] focus:bg-white outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Telefon raqam</label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="+998 90 123 45 67"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:border-[#1673E6] focus:bg-white outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Kasbingiz / Bio (Tavsif)</label>
                    <textarea
                      rows={3}
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="Masalan: Professional usta elektrik, santexnik yoki fotograf"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:border-[#1673E6] focus:bg-white outline-none transition resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Viloyat</label>
                      <select
                        value={editRegionId}
                        onChange={(e) => {
                          setEditRegionId(e.target.value);
                          setEditDistrictId('');
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:border-[#1673E6] focus:bg-white outline-none transition"
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
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Tuman</label>
                      <select
                        disabled={!editRegionId}
                        value={editDistrictId}
                        onChange={(e) => setEditDistrictId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:border-[#1673E6] focus:bg-white outline-none transition disabled:opacity-50"
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

                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="w-full mt-2 py-3 rounded-2xl bg-[#1673E6] hover:bg-[#125FD0] text-white font-bold text-sm shadow-sm transition cursor-pointer"
                  >
                    {isSavingProfile ? 'Saqlanmoqda...' : 'O‘zgarishlarni saqlash'}
                  </button>
                </form>
              </div>
            </div>

            <div className="space-y-6">
              <AccountLinkingCard />
              <PushNotificationsCard />

              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
                <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-[#1673E6]" />
                  <span>Parolni o'zgartirish</span>
                </h3>

                <form onSubmit={handleChangePassword} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Joriy parol</label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:border-[#1673E6] focus:bg-white outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Yangi parol</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:border-[#1673E6] focus:bg-white outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Qayta kiriting</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:border-[#1673E6] focus:bg-white outline-none transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-sm shadow-sm transition cursor-pointer mt-2"
                  >
                    {isChangingPassword ? 'O‘zgartirilmoqda...' : 'Parolni yangilash'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {profileUser && (
        <FollowListModal
          isOpen={isFollowModalOpen}
          onClose={() => {
            setIsFollowModalOpen(false);
            fetchProfile();
          }}
          userId={profileUser.id}
          userName={profileUser.name}
          initialTab={followModalTab}
          onOpenProfile={(targetId) => onNavigate(`/profile/${targetId}`)}
        />
      )}

      <VerifyRequestModal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        onSubmitted={() => fetchProfile()}
      />
    </>
  );
};

export default ProfilePage;
