import React, { useState, useEffect } from 'react';
import { User, Listing } from '../types/index.ts';
import { apiRequest, getPublicMonetization, type PublicMonetization } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { ListingTypeBadge } from '../components/listings/ListingTypeBadge.tsx';
import { PriceDisplay } from '../components/listings/PriceDisplay.tsx';
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
  ChevronRight,
  Edit3,
  LogOut,
} from 'lucide-react';
import { formatDateAgo } from '../lib/utils.ts';
import { VerifiedBadge } from '../components/common/VerifiedBadge.tsx';
import { FollowListModal } from '../components/modals/FollowListModal.tsx';

interface ProfilePageProps {
  userId: string;
  onNavigate: (route: string) => void;
  onOpenListing: (id: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  userId,
  onNavigate,
  onOpenListing,
}) => {
  const { user: currentUser, logout, openLoginModal } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [archivedListings, setArchivedListings] = useState<Listing[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isFollowed, setIsFollowed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
  const [followModalTab, setFollowModalTab] = useState<'followers' | 'following'>('followers');

  // Monetization config (Faza 5)
  const [monetization, setMonetization] = useState<PublicMonetization | null>(null);
  useEffect(() => {
    getPublicMonetization().then(setMonetization).catch(() => {});
  }, []);
  const activeDays = monetization?.active_days ?? 30;

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

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
        }),
      });
      setIsEditing(false);
      fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Saqlashda xatolik');
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse space-y-4">
        <div className="w-full h-48 bg-gray-200 rounded-3xl" />
        <div className="w-1/3 h-6 bg-gray-200 rounded-md" />
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h3 className="text-base font-bold text-gray-900">Foydalanuvchi topilmadi</h3>
        <button
          onClick={() => onNavigate('/')}
          className="mt-4 px-5 py-2 rounded-full bg-blue-600 text-white text-xs font-bold"
        >
          Bosh sahifaga qaytish
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Header Card */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4 sm:gap-6">
            <img
              src={profileUser.profile_photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profileUser.name}`}
              alt={profileUser.name}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-cover ring-4 ring-blue-500/10 shadow-sm"
            />
            <div>
              <div className="flex items-center gap-2 overflow-visible">
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
                  {profileUser.name}
                </h1>
                {profileUser.is_profile_complete && (
                  <VerifiedBadge
                    size="md"
                    tooltip="TopHand tomonidan to‘liq tasdiqlangan profil"
                  />
                )}
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold">
                  {profileUser.role}
                </span>
              </div>

              <p className="text-xs text-gray-400 mt-0.5">
                {profileUser.telegram_username ? `@${profileUser.telegram_username}` : 'TopHand a’zosi'}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>
                    {profileUser.district_name || 'Toshkent'}, {profileUser.region_name || 'O‘zbekiston'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-gray-400">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>A’zo: {formatDateAgo(profileUser.created_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isOwner ? (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Tahrirlash</span>
                </button>
                <button
                  onClick={logout}
                  className="p-2 rounded-full text-rose-500 hover:bg-rose-50 border border-rose-200"
                  title="Chiqish"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleFollowToggle}
                disabled={isFollowLoading}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs ${
                  isFollowed
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isFollowed ? (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>Obuna bo‘lingan</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Obuna bo‘lish</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Bio */}
        {profileUser.bio && !isEditing && (
          <div className="mt-6 pt-6 border-t border-gray-100 text-xs sm:text-sm text-gray-700 leading-relaxed max-w-2xl whitespace-pre-wrap">
            {profileUser.bio}
          </div>
        )}

        {/* Edit profile form if owner */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="mt-6 pt-6 border-t border-gray-100 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Ismingiz</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Telefon raqamingiz (Profilida yashirin saqlanadi)
              </label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Bio / Tavsif</label>
              <textarea
                rows={3}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-full border border-gray-200 text-xs font-semibold"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-6 py-2 rounded-full bg-blue-600 text-white text-xs font-bold shadow-md"
              >
                {isSavingProfile ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </form>
        )}

        {/* Stats bar */}
        <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-2 rounded-xl bg-gray-50/50">
            <span className="block font-extrabold text-base text-gray-900">
              {profileUser.active_listing_count || listings.length}
            </span>
            <span className="text-[11px] text-gray-500 font-medium">Faol e’lonlar</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setFollowModalTab('followers');
              setIsFollowModalOpen(true);
            }}
            className="p-2 rounded-xl bg-gray-50/70 hover:bg-blue-50/70 transition-all text-center cursor-pointer group"
          >
            <span className="block font-extrabold text-base text-gray-900 group-hover:text-blue-600 transition-colors">
              {profileUser.follower_count || 0}
            </span>
            <span className="text-[11px] text-gray-500 font-medium group-hover:text-blue-600 flex items-center justify-center gap-1">
              <span>Obunachilar</span>
              <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFollowModalTab('following');
              setIsFollowModalOpen(true);
            }}
            className="p-2 rounded-xl bg-gray-50/70 hover:bg-blue-50/70 transition-all text-center cursor-pointer group"
          >
            <span className="block font-extrabold text-base text-gray-900 group-hover:text-blue-600 transition-colors">
              {profileUser.following_count || 0}
            </span>
            <span className="text-[11px] text-gray-500 font-medium group-hover:text-blue-600 flex items-center justify-center gap-1">
              <span>Obunalar</span>
              <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
            </span>
          </button>

          <div className="p-2 rounded-xl bg-gray-50/50">
            <span className="block font-extrabold text-base text-gray-900">
              {profileUser.is_profile_complete ? '100%' : '50%'}
            </span>
            <span className="text-[11px] text-gray-500 font-medium">Profil to‘liqligi</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'active'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <List className="w-4 h-4" />
          <span>Faol e’lonlar ({listings.length})</span>
        </button>

        {isOwner && (
          <button
            onClick={() => setActiveTab('archived')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'archived'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Arxiv ({archivedListings.length})</span>
          </button>
        )}
      </div>

      {/* Tab content - Tasteful List View */}
      {activeTab === 'active' && (
        listings.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center max-w-sm mx-auto shadow-2xs">
            <span className="text-3xl mb-2 block">📭</span>
            <h4 className="font-bold text-sm text-gray-900">Hozircha faol e’lonlar yo‘q</h4>
            <p className="text-xs text-gray-500 mt-1">Ushbu foydalanuvchida hozircha faol e’lonlar mavjud emas.</p>
            {isOwner && (
              <button
                onClick={() => onNavigate('/create')}
                className="mt-4 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Yangi e’lon joylash
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {listings.map((l) => {
              const isJob = l.type === 'JOB_OPENING' || l.type === 'JOB_SEEKER';
              const daysLeft = l.expires_at
                ? Math.max(0, Math.ceil((new Date(l.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
                : null;
              return (
                <div
                  key={l.id}
                  onClick={() => onOpenListing(l.id)}
                  className="group bg-white rounded-2xl sm:rounded-3xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all duration-200 p-3 sm:p-4.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 cursor-pointer"
                >
                  {/* Left: Thumbnail & Details */}
                  <div className="flex items-start sm:items-center gap-3.5 sm:gap-4.5 min-w-0 flex-1">
                    {/* Photo / Thumbnail */}
                    <div className="relative w-20 h-20 sm:w-28 sm:h-24 rounded-xl sm:rounded-2xl overflow-hidden shrink-0 bg-gray-50 border border-gray-100 shadow-2xs">
                      {l.images && l.images.length > 0 ? (
                        <img
                          src={l.images[0]}
                          alt={l.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50/70 via-indigo-50/50 to-slate-100 text-gray-400 p-1">
                          <span className="text-2xl sm:text-3xl mb-0.5">{l.category_icon || '📋'}</span>
                          <span className="text-[10px] text-gray-500 font-medium text-center truncate max-w-full px-1">
                            {l.category_name || 'E’lon'}
                          </span>
                        </div>
                      )}
                      {/* Mobile type badge */}
                      <div className="absolute top-1 left-1 sm:hidden">
                        <ListingTypeBadge type={l.type} size="sm" />
                      </div>
                    </div>

                    {/* Text Content */}
                    <div className="min-w-0 flex-1">
                      {/* Category, Type & Location tag row */}
                      <div className="hidden sm:flex items-center gap-2 mb-1.5 flex-wrap">
                        <ListingTypeBadge type={l.type} size="sm" />
                        {l.category_name && (
                          <span className="text-[11px] font-semibold text-gray-700 bg-gray-100/80 px-2 py-0.5 rounded-md">
                            {l.category_name}
                          </span>
                        )}
                        {(l.district_name || l.region_name) && (
                          <span className="text-[11px] text-gray-500 flex items-center gap-1 font-medium">
                            <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                            <span>{l.district_name ? `${l.district_name}, ` : ''}{l.region_name}</span>
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-sm sm:text-base text-gray-950 group-hover:text-blue-600 transition-colors line-clamp-1 sm:line-clamp-2 leading-snug mb-1">
                        {l.title}
                      </h3>

                      {/* Description snippet */}
                      {l.description && (
                        <p className="text-xs text-gray-500 line-clamp-1 mb-2 leading-relaxed">
                          {l.description}
                        </p>
                      )}

                      {/* Meta bottom row */}
                      <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                          <span>{formatDateAgo(l.renewed_at || l.created_at)}</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                          Faol
                        </span>
                        {isOwner && daysLeft !== null && (
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border flex items-center gap-1 ${
                            daysLeft <= 3
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-gray-50 text-gray-600 border-gray-200'
                          }`}>
                            <Clock className="w-3 h-3" /> {daysLeft} kun qoldi
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Price & Action */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-gray-100 gap-2 sm:gap-3">
                    <PriceDisplay
                      priceType={l.price_type}
                      priceMin={l.price_min}
                      priceMax={l.price_max}
                      currency={l.currency}
                      salaryType={l.salary_type}
                      salaryMin={l.salary_min}
                      salaryMax={l.salary_max}
                      isJob={isJob}
                      className="text-base sm:text-lg font-black text-gray-950"
                    />

                    <div className="inline-flex items-center gap-2">
                      {isOwner && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate(`/create?edit=${l.id}`);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-600 hover:text-blue-700 text-xs font-bold transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Tahrirlash</span>
                        </button>
                      )}
                      <div className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white text-xs font-bold transition-all shadow-2xs">
                        <span>Batafsil ko‘rish</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {activeTab === 'archived' && isOwner && (
        archivedListings.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center max-w-sm mx-auto text-xs text-gray-500 shadow-2xs">
            <span className="text-3xl mb-2 block">📁</span>
            <h4 className="font-bold text-sm text-gray-900">Arxivlangan e’lonlar mavjud emas</h4>
          </div>
        ) : (
          <div className="space-y-3">
            {archivedListings.map((l) => {
              const isJob = l.type === 'JOB_OPENING' || l.type === 'JOB_SEEKER';
              return (
                <div
                  key={l.id}
                  onClick={() => onOpenListing(l.id)}
                  className="group bg-white rounded-2xl sm:rounded-3xl border border-gray-100 hover:border-amber-200 hover:shadow-md transition-all duration-200 p-3 sm:p-4.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 cursor-pointer"
                >
                  {/* Left: Thumbnail & Details */}
                  <div className="flex items-start sm:items-center gap-3.5 sm:gap-4.5 min-w-0 flex-1">
                    <div className="relative w-20 h-20 sm:w-28 sm:h-24 rounded-xl sm:rounded-2xl overflow-hidden shrink-0 bg-gray-50 border border-gray-100 shadow-2xs opacity-85">
                      {l.images && l.images.length > 0 ? (
                        <img
                          src={l.images[0]}
                          alt={l.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-slate-100 text-gray-400 p-1">
                          <span className="text-2xl sm:text-3xl mb-0.5">{l.category_icon || '📋'}</span>
                          <span className="text-[10px] text-gray-500 font-medium text-center truncate max-w-full px-1">
                            {l.category_name || 'E’lon'}
                          </span>
                        </div>
                      )}
                      <div className="absolute top-1 left-1 sm:hidden">
                        <ListingTypeBadge type={l.type} size="sm" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="hidden sm:flex items-center gap-2 mb-1.5 flex-wrap">
                        <ListingTypeBadge type={l.type} size="sm" />
                        {l.category_name && (
                          <span className="text-[11px] font-semibold text-gray-600 bg-gray-100/80 px-2 py-0.5 rounded-md">
                            {l.category_name}
                          </span>
                        )}
                        {(l.district_name || l.region_name) && (
                          <span className="text-[11px] text-gray-500 flex items-center gap-1 font-medium">
                            <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                            <span>{l.district_name ? `${l.district_name}, ` : ''}{l.region_name}</span>
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-sm sm:text-base text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1 sm:line-clamp-2 leading-snug mb-1">
                        {l.title}
                      </h3>

                      {l.description && (
                        <p className="text-xs text-gray-500 line-clamp-1 mb-2 leading-relaxed">
                          {l.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                          <span>{formatDateAgo(l.renewed_at || l.created_at)}</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-200">
                          Arxivda (Muddati tugagan)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Price & Renew Button */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-gray-100 gap-2 sm:gap-3">
                    <PriceDisplay
                      priceType={l.price_type}
                      priceMin={l.price_min}
                      priceMax={l.price_max}
                      currency={l.currency}
                      salaryType={l.salary_type}
                      salaryMin={l.salary_min}
                      salaryMax={l.salary_max}
                      isJob={isJob}
                      className="text-base sm:text-lg font-black text-gray-950"
                    />

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenewListing(l.id);
                      }}
                      className="px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-gray-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Qayta uzaytirish ({activeDays} kunga)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Follow List Modal */}
      {profileUser && (
        <FollowListModal
          isOpen={isFollowModalOpen}
          onClose={() => {
            setIsFollowModalOpen(false);
            fetchProfile(); // Refresh counts in case viewer followed/unfollowed
          }}
          userId={profileUser.id}
          userName={profileUser.name}
          initialTab={followModalTab}
          onOpenProfile={(targetId) => {
            onNavigate(`/profile/${targetId}`);
          }}
        />
      )}
    </div>
  );
};
