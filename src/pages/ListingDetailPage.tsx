import React, { useState, useEffect } from 'react';
import { Listing } from '../types/index.ts';
import { apiRequest } from '../lib/api.ts';
import { ListingTypeBadge } from '../components/listings/ListingTypeBadge.tsx';
import { PriceDisplay } from '../components/listings/PriceDisplay.tsx';
import { getContactTimeLabel, formatDateAgo } from '../lib/utils.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  MapPin,
  Clock,
  Calendar,
  Building2,
  ShieldCheck,
  Heart,
  Share2,
  AlertTriangle,
  MessageSquare,
  Phone,
  Send,
  UserCheck,
  UserPlus,
  RefreshCw,
  ChevronLeft,
  Star,
  Trash2,
} from 'lucide-react';
import { VerifiedBadge } from '../components/common/VerifiedBadge.tsx';
import { CallModal } from '../components/modals/CallModal.tsx';
import { ReportModal } from '../components/modals/ReportModal.tsx';
import { ChatDrawer } from '../components/chat/ChatDrawer.tsx';
import { ReviewsSection } from '../components/reviews/ReviewsSection.tsx';

interface ListingDetailPageProps {
  listingId: string;
  onNavigate: (route: string) => void;
  onBack: () => void;
}

export const ListingDetailPage: React.FC<ListingDetailPageProps> = ({
  listingId,
  onNavigate,
  onBack,
}) => {
  const { user, openLoginModal } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [revealedPhone, setRevealedPhone] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Follow / Save state
  const [isSaved, setIsSaved] = useState(false);
  const [isFollowed, setIsFollowed] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);

  const fetchDetail = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<Listing>(`/api/listings/${listingId}`);
      setListing(data);
      setIsSaved(data.is_saved || false);
      setIsFollowed(data.is_followed || false);
    } catch (err: any) {
      setError(err.message || 'E’lon yuklanmadi');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    if (window.location.hash === '#reviews') {
      setTimeout(() => {
        const el = document.getElementById('reviews');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 400);
    }
  }, [listingId]);

  const handleSaveToggle = async () => {
    if (!user) {
      openLoginModal();
      return;
    }
    const next = !isSaved;
    setIsSaved(next);
    try {
      const res = await apiRequest<{ saved: boolean }>(`/api/listings/${listingId}/save`, {
        method: 'POST',
      });
      setIsSaved(res.saved);
    } catch {
      setIsSaved(!next);
    }
  };

  const handleFollowToggle = async () => {
    if (!user) {
      openLoginModal();
      return;
    }
    if (!listing || isFollowLoading) return;

    setIsFollowLoading(true);
    const next = !isFollowed;
    setIsFollowed(next);
    try {
      const res = await apiRequest<{ followed: boolean }>(`/api/users/${listing.owner_user_id}/follow`, {
        method: 'POST',
      });
      setIsFollowed(res.followed);
      if (listing) {
        setListing({
          ...listing,
          owner_followers_count: (listing.owner_followers_count || 0) + (res.followed ? 1 : -1),
        });
      }
    } catch (err: any) {
      setIsFollowed(!next);
      alert(err.message || 'Obuna bo‘lishda xatolik');
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleRevealPhone = async () => {
    if (!user) {
      openLoginModal();
      return;
    }
    if (!listing) return;

    try {
      const res = await apiRequest<{ phone: string }>(`/api/users/${listing.owner_user_id}/phone`);
      setRevealedPhone(res.phone);
      setIsCallModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Telefon raqamini ko‘rish imkoni bo‘lmadi');
    }
  };

  const handleRenew = async () => {
    if (!confirm('E’lon amal qilish muddatini yana 30 kunga uzaytirmoqchimisiz?')) return;
    setIsRenewing(true);
    try {
      const res = await apiRequest<{ listing: Listing }>(`/api/listings/${listingId}/renew`, {
        method: 'POST',
      });
      setListing(res.listing);
      alert('E’loningiz muvaffaqiyatli uzaytirildi!');
    } catch (err: any) {
      alert(err.message || 'Uzaytirishda xatolik yuz berdi');
    } finally {
      setIsRenewing(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: listing?.title,
        text: listing?.description?.slice(0, 100),
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('E’lon havolasi nusxalandi!');
    }
  };

  const [isAdminDeleting, setIsAdminDeleting] = useState(false);

  const handleAdminDeleteListing = async () => {
    const isSure = window.confirm(
      "DIQQAT! Administrator sifatida ushbu e’lonni platformadan BUTUNLAY O‘CHIRIB tashlamoqchimisiz?\n\nBu amal qaytarilmaydi va barcha bog‘liq rasmlar ham o‘chiriladi."
    );
    if (!isSure) return;

    setIsAdminDeleting(true);
    try {
      await apiRequest(`/api/listings/${listingId}?hard=true`, {
        method: 'DELETE',
      });
      alert('E’lon ma’muriyat tomonidan platformadan butunlay muvaffaqiyatli o‘chirildi!');
      onNavigate('/');
    } catch (err: any) {
      alert(err.message || 'E’lonni o‘chirishda xatolik yuz berdi');
    } finally {
      setIsAdminDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse space-y-6">
        <div className="w-32 h-6 bg-gray-200 rounded-md" />
        <div className="w-full h-96 bg-gray-200 rounded-3xl" />
        <div className="w-3/4 h-8 bg-gray-200 rounded-md" />
        <div className="w-1/2 h-4 bg-gray-200 rounded-md" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-3xl mx-auto mb-3">
          ⚠️
        </div>
        <h2 className="text-lg font-bold text-gray-900">E’lon topilmadi yoki arxivlangan</h2>
        <p className="text-xs text-gray-500 mt-1 mb-6">{error || 'Ushbu e’lon o‘chirilgan yoki muddati tugagan.'}</p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-full bg-blue-600 text-white font-bold text-xs shadow-md"
        >
          Orqaga qaytish
        </button>
      </div>
    );
  }

  const isOwner = user?.id === listing.owner_user_id;
  const isJob = listing.type === 'JOB_OPENING' || listing.type === 'JOB_SEEKER';
  const images = listing.images && listing.images.length > 0 ? listing.images : [];
  const skillsList = listing.skills
    ? typeof listing.skills === 'string'
      ? JSON.parse(listing.skills || '[]')
      : listing.skills
    : [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-blue-600 transition-colors mb-4 group"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        <span>Barcha e’lonlarga qaytish</span>
      </button>

      {/* Admin Action Banner */}
      {user?.role === 'ADMIN' && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-900 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-600 text-white shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-xs text-rose-950 block">
                👑 Platforma Administratori amallari
              </span>
              <span className="text-[11px] text-rose-700">
                Siz ushbu e’lonni istalgan vaqtda ma’lumotlar bazasidan butunlay va qaytarib bo‘lmaydigan qilib o‘chirish huquqiga egasiz.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAdminDeleteListing}
            disabled={isAdminDeleting}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isAdminDeleting ? 'O‘chirilmoqda...' : 'E’lonni butunlay o‘chirish'}</span>
          </button>
        </div>
      )}

      {/* Expiration warning banner if archived or nearing expiration */}
      {listing.status === 'ARCHIVED' && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 text-xs">
          <div>
            <p className="font-bold">Ushbu e’lonning 30 kunlik amal qilish muddati tugagan (Arxivda)</p>
            <p className="text-amber-800 text-[11px] mt-0.5">
              Hozirda qidiruvda ko‘rinmaydi. E’lon egasi uni bepul yangilashi mumkin.
            </p>
          </div>
          {isOwner && (
            <button
              onClick={handleRenew}
              disabled={isRenewing}
              className="px-4 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRenewing ? 'animate-spin' : ''}`} />
              <span>Yana 30 kunga uzaytirish</span>
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Gallery & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Image Gallery (up to 8 images) */}
          <div className="bg-white rounded-3xl border border-gray-100 p-3 shadow-xs overflow-hidden">
            {images.length > 0 ? (
              <div>
                <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-gray-50 mb-3">
                  <img
                    src={images[selectedImageIdx]}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3">
                    <ListingTypeBadge type={listing.type} size="md" />
                  </div>
                </div>

                {/* Thumbnails row */}
                {images.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImageIdx(idx)}
                        className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                          selectedImageIdx === idx
                            ? 'border-blue-600 ring-2 ring-blue-600/20'
                            : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={img} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-[16/9] w-full rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                <span className="text-4xl mb-2">📋</span>
                <span className="font-semibold text-sm text-gray-600">{listing.category_name}</span>
                <ListingTypeBadge type={listing.type} size="sm" className="mt-2" />
              </div>
            )}
          </div>

          {/* 2. Main Title & Meta */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <PriceDisplay
                priceType={listing.price_type}
                priceMin={listing.price_min}
                priceMax={listing.price_max}
                currency={listing.currency}
                salaryType={listing.salary_type}
                salaryMin={listing.salary_min}
                salaryMax={listing.salary_max}
                isJob={isJob}
                className="text-2xl text-blue-900 font-extrabold"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveToggle}
                  className={`p-2.5 rounded-full border transition-colors ${
                    isSaved
                      ? 'bg-rose-50 text-rose-600 border-rose-200'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                  title={isSaved ? 'Saqlangan' : 'Saqlash'}
                  aria-label="Saqlash"
                >
                  <Heart className={`w-4 h-4 ${isSaved ? 'fill-rose-500' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="p-2.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  title="Ulashish"
                  aria-label="Ulashish"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(true)}
                  className="p-2.5 rounded-full border border-gray-200 text-gray-400 hover:text-amber-600 hover:bg-gray-50 transition-colors"
                  title="Shikoyat qilish"
                  aria-label="Shikoyat qilish"
                >
                  <AlertTriangle className="w-4 h-4" />
                </button>

                {user?.role === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={handleAdminDeleteListing}
                    className="p-2.5 rounded-full border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-colors cursor-pointer"
                    title="Admin: E’lonni butunlay o‘chirish"
                    aria-label="Admin: E’lonni o‘chirish"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-gray-950 leading-snug tracking-tight mb-4">
              {listing.title}
            </h1>

            {/* Quick badges */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 border-t border-b border-gray-100 py-3">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>
                  {listing.district_name}, {listing.region_name}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>E’lon berildi: {formatDateAgo(listing.created_at)}</span>
              </div>

              {listing.work_format && (
                <span className="px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium">
                  {listing.work_format === 'REMOTE' ? 'Masofaviy ish' : listing.work_format === 'HYBRID' ? 'Gibrid' : 'Ofis/Joyida'}
                </span>
              )}

              {listing.experience_level && (
                <span className="px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium">
                  Tajriba: {listing.experience_level}
                </span>
              )}
            </div>

            {/* Contact Time Availability (Section 31) */}
            <div className="mt-4 p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-center gap-2.5 text-xs text-blue-900">
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="font-bold">Bog‘lanish vaqti: </span>
                <span>{getContactTimeLabel(listing.contact_time, listing.contact_custom_text)}</span>
              </div>
            </div>

            {/* Skills / Tags */}
            {skillsList.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Ko‘nikmalar va talablar
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {skillsList.map((skill: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 text-xs font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="mt-6">
              <h3 className="text-sm font-bold text-gray-900 mb-2.5">To‘liq tavsif</h3>
              <div className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-normal">
                {listing.description}
              </div>
            </div>
          </div>

          {/* 4. Dedicated Reviews & Ratings Section (Variation 23 Feature) */}
          <div id="reviews" className="mt-8 scroll-mt-28">
            <ReviewsSection
              targetUserId={listing.owner_user_id}
              employerName={listing.organization_name || listing.owner_name || 'Ish beruvchi'}
              listingId={listing.id}
              onRatingUpdated={(newAvg, total) => {
                setListing((prev) =>
                  prev
                    ? {
                        ...prev,
                        employer_rating: newAvg > 0 ? newAvg : null,
                        employer_review_count: total,
                      }
                    : null
                );
              }}
            />
          </div>
        </div>

        {/* Right Column: Owner & Contact Actions */}
        <div className="space-y-6">
          {/* Safe Contact Panel (Section 26 & 71) */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs">
            <h3 className="font-bold text-sm text-gray-900 mb-3">Aloqaga chiqish</h3>

            {/* Safety recommendation */}
            <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100 text-[11px] text-blue-900 mb-4 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                TopHand orqali yozish — xavfsizroq aloqa usuli. Begona havolalarga kirmang va ma’lumotlaringizni himoyalang.
              </span>
            </div>

            {/* Actions list */}
            <div className="space-y-2.5">
              {/* 1. TopHand Chat (Recommended Primary Contact) */}
              <button
                onClick={() => {
                  if (!user) {
                    openLoginModal(() => setIsChatOpen(true));
                  } else {
                    setIsChatOpen(true);
                  }
                }}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 group"
              >
                <MessageSquare className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>TopHand Chat orqali yozish</span>
              </button>

              {/* 2. Telegram username contact (if owner provided) */}
              {listing.owner_username && (
                <a
                  href={`https://t.me/${listing.owner_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-2xl bg-[#2AABEE]/10 hover:bg-[#2AABEE]/20 text-[#2AABEE] font-bold text-xs border border-[#2AABEE]/30 transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4 -rotate-45" />
                  <span>Telegram: @{listing.owner_username}</span>
                </a>
              )}

              {/* 3. Phone call (revealed safely) */}
              <button
                onClick={handleRevealPhone}
                className="w-full py-2.5 rounded-2xl border border-gray-200 hover:bg-gray-50 text-gray-800 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4 text-blue-600" />
                <span>Telefon raqamini ko‘rish</span>
              </button>
            </div>
          </div>

          {/* Owner Profile Card (Section 8 & 9) */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs">
            <div className="flex items-center gap-3.5 mb-4">
              <img
                src={listing.owner_photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${listing.owner_name}`}
                alt={listing.owner_name}
                className="w-14 h-14 rounded-2xl object-cover ring-2 ring-blue-500/20"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-sm text-gray-900 truncate">{listing.owner_name}</h4>
                  {listing.is_profile_complete && (
                    <VerifiedBadge size="sm" tooltip="TopHand tomonidan to‘liq tasdiqlangan mutaxassis" />
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  {listing.owner_username ? `@${listing.owner_username}` : 'TopHand a’zosi'}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {listing.owner_registered_at && `A’zo: ${formatDateAgo(listing.owner_registered_at)}`}
                </p>

                {/* Employer Rating Summary */}
                <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                  {listing.employer_review_count && listing.employer_review_count > 0 && listing.employer_rating ? (
                    <a
                      href="#reviews"
                      className="flex items-center gap-1 text-amber-600 hover:underline font-bold"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{listing.employer_rating.toFixed(1)}</span>
                      <span className="text-gray-500 font-normal text-[11px]">
                        ({listing.employer_review_count} ta sharh)
                      </span>
                    </a>
                  ) : (
                    <span className="text-gray-400 text-[11px] italic">Hali baholanmagan</span>
                  )}
                </div>
              </div>
            </div>

            {listing.owner_bio && (
              <p className="text-xs text-gray-600 line-clamp-3 mb-4 leading-relaxed bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                "{listing.owner_bio}"
              </p>
            )}

            {/* Owner Stats */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs py-3 border-t border-b border-gray-100 mb-4">
              <div>
                <span className="block font-bold text-gray-900 text-sm">
                  {listing.owner_active_listing_count || 1}
                </span>
                <span className="text-[11px] text-gray-400">Faol e’lonlar</span>
              </div>
              <div>
                <span className="block font-bold text-gray-900 text-sm">
                  {listing.owner_followers_count || 0}
                </span>
                <span className="text-[11px] text-gray-400">Obunachilar</span>
              </div>
            </div>

            {/* Follow button */}
            {!isOwner && (
              <button
                onClick={handleFollowToggle}
                disabled={isFollowLoading}
                className={`w-full py-2.5 rounded-2xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                  isFollowed
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                }`}
              >
                {isFollowed ? (
                  <>
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    <span>Obunadasiz (Bekor qilish)</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 text-blue-600" />
                    <span>Obuna bo‘lish (Ustuvor ko‘rish)</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => onNavigate(`/profile/${listing.owner_user_id}`)}
              className="w-full mt-2 py-2 text-center text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
            >
              Profilni to‘liq ko‘rish →
            </button>
          </div>

          {/* Organization Card (Section 4 & 5: if company listing) */}
          {listing.organization_id && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs">
              <div className="flex items-center gap-3 mb-3">
                {listing.organization_logo_url ? (
                  <img
                    src={listing.organization_logo_url}
                    alt={listing.organization_name}
                    className="w-12 h-12 rounded-xl object-cover border border-gray-100"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-lg">
                    <Building2 className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1">
                    <h4 className="font-bold text-sm text-gray-900">{listing.organization_name}</h4>
                    {listing.organization_verification_status === 'VERIFIED' && (
                      <VerifiedBadge size="sm" variant="emerald" tooltip="TopHand tomonidan rasmiy tasdiqlangan tashkilot" />
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400">Rasmiy tashkilot profili</span>
                </div>
              </div>

              {listing.organization_description && (
                <p className="text-xs text-gray-600 line-clamp-3 mb-3 leading-relaxed">
                  {listing.organization_description}
                </p>
              )}

              <button
                onClick={() => onNavigate(`/org/${listing.organization_id}`)}
                className="w-full py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Tashkilot sahifasi va barcha vakansiyalari
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CallModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        phone={revealedPhone}
        ownerName={listing.owner_name || 'Foydalanuvchi'}
        onOpenChat={() => setIsChatOpen(true)}
      />

      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        targetType="LISTING"
        targetId={listing.id}
        targetTitle={listing.title}
      />

      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        listingId={listing.id}
      />
    </div>
  );
};
