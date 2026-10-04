import React, { useState, useEffect, useRef } from 'react';
import { Listing, CategoryAttribute } from '../types/index.ts';
import { apiRequest, getPublicMonetization, promoteListingRequest, getCategoryAttributes, type PublicMonetization } from '../lib/api.ts';
import { ListingTypeBadge } from '../components/listings/ListingTypeBadge.tsx';
import { PriceDisplay } from '../components/listings/PriceDisplay.tsx';
import { getContactTimeLabel, formatDateAgo, isOfficialAccount, isStaffAccount } from '../lib/utils.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  MapPin,
  Clock,
  Rocket,
  Play,
  Calendar,
  Building2,
  ShieldCheck,
  Heart,
  Share2,
  CheckCheck,
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
  Edit3,
  Briefcase,
  Layers,
  Eye,
  CheckCircle2,
  Globe,
  ChevronRight,
} from 'lucide-react';
import { VerifiedBadge } from '../components/common/VerifiedBadge.tsx';
import { MiniMap } from '../components/common/MiniMap.tsx';
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
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdminDeleting, setIsAdminDeleting] = useState(false);

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

  // Monetization state (Faza 5)
  const [monetization, setMonetization] = useState<PublicMonetization | null>(null);
  // Kategoriya atribut sxemasi (label + birlik uchun)
  const [attrSchema, setAttrSchema] = useState<CategoryAttribute[]>([]);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promoMsg, setPromoMsg] = useState('');

  useEffect(() => {
    const catId = listing?.category_id;
    if (!catId) {
      setAttrSchema([]);
      return;
    }
    getCategoryAttributes(catId)
      .then(setAttrSchema)
      .catch(() => setAttrSchema([]));
  }, [listing?.category_id]);

  useEffect(() => {
    getPublicMonetization().then(setMonetization).catch(() => {});
  }, []);

  const activeDays = monetization?.active_days ?? 30;
  const renewPrice = monetization
    ? (listing?.catalog_id === 'jobs' ? monetization.prices.renew.jobs : monetization.prices.renew.services)
    : 0;
  const promoPrice = monetization
    ? (listing?.catalog_id === 'jobs' ? monetization.prices.promo.jobs : monetization.prices.promo.services)
    : 0;
  const daysLeft = listing?.expires_at
    ? Math.max(0, Math.ceil((new Date(listing.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;
  const isPromoActive = Boolean(listing?.promoted_until) && new Date(listing!.promoted_until as string).getTime() > Date.now();

  const fetchDetail = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<Listing>(`/api/listings/${listingId}`);
      setListing(data);
      setIsSaved(data.is_saved || false);
      setIsFollowed(data.is_followed || false);
    } catch (err: any) {
      setError(err.message || "E'lon yuklanmadi");
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
    setIsFollowLoading(true);
    const next = !isFollowed;
    setIsFollowed(next);
    try {
      await apiRequest(`/api/users/${listing?.owner_user_id}/follow`, { method: 'POST' });
    } catch {
      setIsFollowed(!next);
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleRevealPhone = async () => {
    if (!user) {
      openLoginModal();
      return;
    }
    if (revealedPhone) {
      setIsCallModalOpen(true);
      return;
    }
    try {
      const res = await apiRequest<{ phone: string }>(`/api/listings/${listingId}/contact`);
      if (res.phone) {
        setRevealedPhone(res.phone);
        setIsCallModalOpen(true);
      }
    } catch {
      // noop
    }
  };

  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/listing/${listingId}`;
    const shareData = { title: listing?.title || 'TopHand', text: listing?.title || '', url };
    // Prefer native share; always fall back to clipboard copy.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        // User cancelled — do nothing; other errors fall through to clipboard.
        if (err?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      window.prompt('Havolani nusxalang:', url);
    }
  };

  const handleRenew = async () => {
    if (!user) return;
    setIsRenewing(true);
    try {
      await apiRequest(`/api/listings/${listingId}/renew`, { method: 'POST' });
      fetchDetail();
    } finally {
      setIsRenewing(false);
    }
  };

  const handlePromote = async () => {
    if (!user) {
      openLoginModal();
      return;
    }
    setIsPromoting(true);
    setPromoMsg('');
    try {
      await promoteListingRequest(listingId);
      setPromoMsg("E'lon topga ko'tarildi!");
      fetchDetail();
    } catch (err: any) {
      setPromoMsg(err?.message || "Ko'tarishda xatolik");
    } finally {
      setIsPromoting(false);
    }
  };

  const handleAdminDeleteListing = async () => {
    if (!user || user.role !== 'ADMIN') return;
    if (!window.confirm("Haqiqatan ham bu e'lonni butunlay o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi!")) return;
    setIsAdminDeleting(true);
    try {
      await apiRequest(`/api/admin/listings/${listingId}`, { method: 'DELETE' });
      onBack();
    } finally {
      setIsAdminDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse space-y-6">
        <div className="w-32 h-5 bg-gray-200 rounded-md" />
        <div className="w-full h-72 md:h-96 bg-gray-200 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="w-3/4 h-7 bg-gray-200 rounded-md" />
            <div className="w-1/2 h-4 bg-gray-100 rounded-md" />
            <div className="w-full h-32 bg-gray-100 rounded-xl" />
          </div>
          <div className="h-60 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-3xl mx-auto mb-3">⚠️</div>
        <h2 className="text-lg font-bold text-gray-900">E'lon topilmadi yoki arxivlangan</h2>
        <p className="text-xs text-gray-500 mt-1 mb-6">{error || "Ushbu e'lon o'chirilgan yoki muddati tugagan."}</p>
        <button onClick={onBack} className="px-6 py-2.5 rounded-full bg-blue-600 text-white font-bold text-xs shadow-md">
          Orqaga qaytish
        </button>
      </div>
    );
  }

  const isOwner = user?.id === listing.owner_user_id;
  const isJob = listing.type === 'JOB_OPENING' || listing.type === 'JOB_SEEKER';
  const isCompleted = listing.status === 'COMPLETED';
  const images = listing.images && listing.images.length > 0 ? listing.images : [];
  const isVideoUrl = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);
  const currentMedia = images[selectedImageIdx] || '';
  const currentIsVideo = isVideoUrl(currentMedia);
  const skillsList = listing.skills
    ? typeof listing.skills === 'string'
      ? JSON.parse(listing.skills || '[]')
      : listing.skills
    : [];

  // Build structured "Подробности / Tafsilotlar" list
  const typeLabels: Record<string, string> = {
    SELL: 'Sotuvga',
    WANTED: "Izlayman",
    RENT_OUT: 'Ijaraga beriladi',
    RENT_WANTED: 'Ijara izlanmoqda',
    SERVICE_OFFER: "Xizmat taklifi",
    SERVICE_REQUEST: "Xizmat so'rovi (Buyurtma)",
    JOB_OPENING: "Vakansiya / Ish o'rni",
    JOB_SEEKER: "Rezyume / Mutaxassis",
  };
  const workFormatLabels: Record<string, string> = {
    ONSITE: 'Joyida (Ofis / Xonadon)',
    REMOTE: 'Masofaviy (Online)',
    HYBRID: 'Gibrid (Aralash)',
  };
  const experienceLabels: Record<string, string> = {
    none: 'Tajribasiz / Yangi boshlovchi',
    '1-3': '1–3 yil',
    '3-5': '3–5 yil',
    '5+': '5 yildan ortiq',
  };

  const details: { label: string; value: string; icon?: React.ReactNode }[] = [
    {
      label: "E'lon turi",
      value: typeLabels[listing.type] || listing.type,
      icon: <Briefcase className="w-4 h-4 text-blue-600" />,
    },
    {
      label: 'Kategoriya',
      value: listing.category_name || '—',
      icon: <Layers className="w-4 h-4 text-violet-500" />,
    },
    ...(listing.work_format
      ? [
          {
            label: 'Ish / Xizmat formati',
            value: workFormatLabels[listing.work_format] || listing.work_format,
            icon: <Globe className="w-4 h-4 text-teal-500" />,
          },
        ]
      : []),
    ...(listing.experience_level
      ? [
          {
            label: 'Tajriba darajasi',
            value: experienceLabels[listing.experience_level] || listing.experience_level,
            icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
          },
        ]
      : []),
    {
      label: "E'lon holati",
      value:
        listing.status === 'ACTIVE'
          ? 'Faol'
          : listing.status === 'ARCHIVED'
          ? 'Arxivlangan'
          : listing.status === 'HIDDEN'
          ? 'Yashirilgan'
          : "O'chirilgan",
      icon: <Eye className="w-4 h-4 text-gray-400" />,
    },
    {
      label: "E'lon joylashtirildi",
      value: formatDateAgo(listing.created_at),
      icon: <Calendar className="w-4 h-4 text-gray-400" />,
    },
    {
      label: "Bog'lanish vaqti",
      value: getContactTimeLabel(listing.contact_time, listing.contact_custom_text),
      icon: <Clock className="w-4 h-4 text-amber-500" />,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-0 sm:pb-6">
      {/* Breadcrumb / Back */}
      <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 font-medium hover:text-blue-600 transition-colors group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Barcha e'lonlar</span>
        </button>
        <ChevronRight className="w-3 h-3 text-gray-300" />
        <span className="truncate max-w-[200px] text-gray-400">{listing.category_name}</span>
        <ChevronRight className="w-3 h-3 text-gray-300" />
        <span className="truncate max-w-[160px] font-medium text-gray-700">{listing.title}</span>
      </div>

      {/* Admin Action Banner */}
      {user?.role === 'ADMIN' && (
        <div className="mb-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-600 text-white shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-xs text-rose-950 block">👑 Administrator amallari</span>
              <span className="text-[11px] text-rose-700">Ushbu e'lonni butunlay o'chirish imkoniyati.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate(`/create?edit=${listingId}`)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{"E'lonni tahrirlash"}</span>
          </button>
          <button
            type="button"
            onClick={handleAdminDeleteListing}
            disabled={isAdminDeleting}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isAdminDeleting ? "O'chirilmoqda..." : "E'lonni o'chirish"}</span>
          </button>
        </div>
      )}

      {/* Archived warning banner */}
      {listing.status === 'ARCHIVED' && (
        <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 text-xs">
          <div>
            <p className="font-bold">Ushbu e'lon arxivlangan ({activeDays} kunlik muddat tugagan)</p>
            <p className="text-amber-700 text-[11px] mt-0.5">Hozirda qidiruvda ko'rinmaydi.</p>
          </div>
          {isOwner && (
            <button
              onClick={handleRenew}
              disabled={isRenewing}
              className="px-4 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRenewing ? 'animate-spin' : ''}`} />
              <span>
                Yana {activeDays} kunga uzaytirish
                {renewPrice > 0 ? ` · ${renewPrice.toLocaleString('uz-UZ')} so'm` : ' · Bepul'}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Active countdown + promo banner (owner) */}
      {isOwner && listing.status === 'ACTIVE' && (
        <div className="mb-4 p-4 rounded-2xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-blue-900 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold block">
                {daysLeft !== null ? `⏳ ${daysLeft} kun qoldi` : "Faol e'lon"}
              </span>
              <span className="text-[11px] text-blue-700">
                {daysLeft !== null && daysLeft <= (monetization?.warning_days ?? 3)
                  ? 'Muddati tugaydi — uzatishni unutmang.'
                  : `E'lon ${activeDays} kun davomida faol bo'ladi.`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {promoMsg && (
              <span className={`text-[11px] font-semibold ${promoMsg.includes('xatolik') ? 'text-rose-600' : 'text-emerald-600'}`}>
                {promoMsg}
              </span>
            )}
            <button
              onClick={() => onNavigate(`/create?edit=${listingId}`)}
              className="px-4 py-2 rounded-full bg-white hover:bg-blue-50 border border-blue-300 text-blue-700 font-bold text-xs shadow-xs flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Tahrirlash</span>
            </button>
            <button
              onClick={handlePromote}
              disabled={isPromoting}
              className="px-4 py-2 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
            >
              <Rocket className={`w-3.5 h-3.5 ${isPromoting ? 'animate-pulse' : ''}`} />
              <span>
                {isPromoActive ? 'Promo faol' : 'Topga ko\'tarish'}
                {promoPrice > 0 ? ` · ${promoPrice.toLocaleString('uz-UZ')} so'm` : ' · Bepul'}
              </span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-8">
        {/* ── Left Column ── */}
        <div className="space-y-4">

          {/* 1. Image Gallery */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
            {images.length > 0 ? (
              <div>
                <div
                  className="relative aspect-[4/3] sm:aspect-[16/9] w-full bg-gray-50 touch-pan-y"
                  onTouchStart={(e) => {
                    if (currentIsVideo || images.length < 2) return;
                    touchStartX.current = e.touches[0].clientX;
                    touchStartY.current = e.touches[0].clientY;
                  }}
                  onTouchEnd={(e) => {
                    if (currentIsVideo || images.length < 2 || touchStartX.current === null) return;
                    const dx = e.changedTouches[0].clientX - touchStartX.current;
                    const dy = e.changedTouches[0].clientY - (touchStartY.current ?? 0);
                    touchStartX.current = null;
                    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
                      setSelectedImageIdx((i) => Math.min(Math.max(i + (dx < 0 ? 1 : -1), 0), images.length - 1));
                    }
                  }}
                >
                  {currentIsVideo ? (
                    <video
                      src={currentMedia}
                      controls
                      playsInline
                      className="w-full h-full object-cover bg-black"
                    />
                  ) : (
                    <img
                      src={currentMedia}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {/* Mobil: oldingi keyingi strelkalar */}
                  {!currentIsVideo && images.length > 1 && (
                    <>
                      {selectedImageIdx > 0 && (
                        <button
                          type="button"
                          aria-label="Oldingi rasm"
                          onClick={() => setSelectedImageIdx((i) => Math.max(i - 1, 0))}
                          className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center active:bg-black/60"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                      )}
                      {selectedImageIdx < images.length - 1 && (
                        <button
                          type="button"
                          aria-label="Keyingi rasm"
                          onClick={() => setSelectedImageIdx((i) => Math.min(i + 1, images.length - 1))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center active:bg-black/60"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      )}
                    </>
                  )}
                  {/* Type badge overlay */}
                  <div className="absolute top-3 left-3">
                    <ListingTypeBadge type={listing.type} size="md" />
                  </div>
                  {/* Image counter */}
                  {images.length > 1 && (
                    <div className="absolute bottom-3 right-3 bg-black/50 text-white text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm">
                      {selectedImageIdx + 1} / {images.length}
                    </div>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 p-3 overflow-x-auto scrollbar-none">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImageIdx(idx)}
                        className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                          selectedImageIdx === idx
                            ? 'border-blue-600 ring-2 ring-blue-600/20 opacity-100'
                            : 'border-transparent opacity-60 hover:opacity-90'
                        }`}
                      >
                        {isVideoUrl(img) ? (
                          <div className="relative w-full h-full">
                            <video src={img} muted playsInline className="w-full h-full object-cover" />
                            <span className="absolute inset-0 flex items-center justify-center text-white">
                              <Play className="w-5 h-5 drop-shadow" />
                            </span>
                          </div>
                        ) : (
                          <img src={img} alt={`Rasm ${idx + 1}`} className="w-full h-full object-cover" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-[4/3] sm:aspect-[16/9] w-full bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                <span className="text-5xl mb-3">📋</span>
                <span className="font-semibold text-sm text-gray-600">{listing.category_name}</span>
                <ListingTypeBadge type={listing.type} size="sm" className="mt-2" />
              </div>
            )}
          </div>

          {/* 2. Title & Price */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              {isCompleted ? (
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <CheckCircle2 className="w-6 h-6" />
                  <span className="text-2xl sm:text-3xl font-extrabold leading-none">Yakunlangan</span>
                </div>
              ) : (
                <PriceDisplay
                  priceType={listing.price_type}
                  priceMin={listing.price_min}
                  priceMax={listing.price_max}
                  currency={listing.currency}
                  salaryType={listing.salary_type}
                  salaryMin={listing.salary_min}
                  salaryMax={listing.salary_max}
                  isJob={isJob}
                  className="text-2xl sm:text-3xl text-[#172B4D] font-extrabold"
                />
              )}

              {/* Action icons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveToggle}
                  className={`p-2.5 rounded-full border-2 transition-all ${
                    isSaved
                      ? 'bg-rose-50 text-rose-600 border-rose-300'
                      : 'border-gray-200 text-gray-500 hover:border-rose-300 hover:text-rose-500'
                  }`}
                  title={isSaved ? 'Yoqtirilgan' : 'Yoqtirish'}
                >
                  <Heart className={`w-4 h-4 ${isSaved ? 'fill-rose-500' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="p-2.5 rounded-full border-2 border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all"
                  title={shareCopied ? 'Havola nusxalandi' : 'Ulashish'}
                >
                  {shareCopied ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Share2 className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(true)}
                  className="p-2.5 rounded-full border-2 border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-600 transition-all"
                  title="Shikoyat qilish"
                >
                  <AlertTriangle className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h1 className="text-lg sm:text-xl font-bold text-gray-950 leading-snug tracking-tight">
              {listing.title}
            </h1>

            {/* Location line */}
            <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500">
              <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
              <span>
                {[listing.district_name, listing.region_name].filter(Boolean).join(', ') || "Manzil ko'rsatilmagan"}
              </span>
            </div>

            {/* Posted date */}
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>E'lon joylashtirildi: {formatDateAgo(listing.created_at)}</span>
            </div>
          </div>

          {/* 2b. Tavsif (Описание) — Avito style */}
          {listing.description && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-xs">
              <h2 className="font-bold text-sm text-gray-900 mb-2">Tavsif</h2>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                {listing.description}
              </p>
            </div>
          )}

          {/* 3. Tafsilotlar (Подробности) — Avito style (yakunlangan e'londa ko'rsatilmaydi) */}
          {!isCompleted && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
              <h2 className="font-bold text-sm text-gray-900">Tafsilotlar</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {details.map((d, i) => (
                <div key={i} className="flex items-center justify-between px-4 sm:px-5 py-3 text-xs">
                  <div className="flex items-center gap-2.5 text-gray-500 min-w-0">
                    {d.icon}
                    <span className="truncate">{d.label}</span>
                  </div>
                  <span className="font-semibold text-gray-900 text-right ml-4 shrink-0 max-w-[55%] leading-snug">
                    {d.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* 3b. Xususiyatlar (Atributlar) — sektor uchun maxsus spec jadvali */}
          {(() => {
            const attrs = (typeof listing.attributes === 'string'
              ? (() => { try { return JSON.parse(listing.attributes || '{}'); } catch { return {}; } })()
              : (listing.attributes || {})) as Record<string, string | number | boolean>;
            const keys = Object.keys(attrs).filter((k) => attrs[k] !== undefined && attrs[k] !== '' && attrs[k] !== null);
            if (keys.length === 0) return null;
            const labelFor = (k: string) => attrSchema.find((a) => a.key === k)?.label || k.charAt(0).toUpperCase() + k.slice(1);
            const unitFor = (k: string) => attrSchema.find((a) => a.key === k)?.unit || '';
            const ordered = [
              ...attrSchema.filter((a) => keys.includes(a.key)),
              ...keys.filter((k) => !attrSchema.some((a) => a.key === k)).map((k) => ({ key: k } as CategoryAttribute)),
            ];
            return (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
                <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
                  <h2 className="font-bold text-sm text-gray-900">Xususiyatlar</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 divide-y divide-gray-50 sm:divide-y-0">
                  {ordered.map((a) => (
                    <div key={a.key} className="flex items-center justify-between px-4 sm:px-5 py-2.5 text-xs border-b border-gray-50">
                      <span className="text-gray-500">{labelFor(a.key)}</span>
                      <span className="font-semibold text-gray-900 text-right ml-4">
                        {typeof attrs[a.key] === 'boolean' ? (attrs[a.key] ? 'Ha' : "Yo'q") : String(attrs[a.key])}
                        {unitFor(a.key) ? ` ${unitFor(a.key)}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* 4. Ko'nikmalar / Skills */}
          {skillsList.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-xs">
              <h2 className="font-bold text-sm text-gray-900 mb-3">Ko'nikmalar va talablar</h2>
              <div className="flex flex-wrap gap-2">
                {skillsList.map((skill: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-800 text-xs font-semibold"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 5. Joylashuv (Расположение) — Avito style */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
              <h2 className="font-bold text-sm text-gray-900">Joylashuv</h2>
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  {listing.region_name && (
                    <p className="font-bold text-sm text-gray-900">{listing.region_name}</p>
                  )}
                  {listing.district_name && (
                    <p className="text-xs text-gray-500 mt-0.5">{listing.district_name}</p>
                  )}
                  {listing.organization_address && (
                    <p className="text-xs text-gray-500 mt-1">📍 {listing.organization_address}</p>
                  )}
                  {!listing.region_name && !listing.district_name && (
                    <p className="text-xs text-gray-400 italic">Manzil ko'rsatilmagan</p>
                  )}
                </div>
              </div>

              {/* Inline mini-map when coordinates available */}
              {listing.latitude && listing.longitude ? (
                <div className="mt-3">
                  <MiniMap
                    lat={listing.latitude}
                    lon={listing.longitude}
                    label={[listing.district_name, listing.region_name].filter(Boolean).join(', ')}
                    height={180}
                  />
                  <a
                    href={`https://www.google.com/maps?q=${listing.latitude},${listing.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Google Maps-da ochish
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          {/* 6. Bog'lanish vaqti (yakunlangan e'londa ko'rsatilmaydi) */}
          {!isCompleted && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center gap-2.5 text-sm text-gray-800">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-xs text-gray-500 uppercase tracking-wide">Bog'lanish vaqti</p>
                <p className="font-semibold text-sm text-gray-900 mt-0.5">
                  {getContactTimeLabel(listing.contact_time, listing.contact_custom_text)}
                </p>
              </div>
            </div>
          </div>
          )}

          {/* 7. Reviews */}
          <div id="reviews" className="scroll-mt-20">
            <ReviewsSection
              targetUserId={listing.owner_user_id}
              employerName={listing.organization_name || listing.owner_name || 'Ish beruvchi'}
              listingId={listing.id}
              onRatingUpdated={(newAvg, total) => {
                setListing((prev) =>
                  prev
                    ? { ...prev, employer_rating: newAvg > 0 ? newAvg : null, employer_review_count: total }
                    : null
                );
              }}
            />
          </div>
        </div>

        {/* ── Right Column: Sticky Contact & Owner ── */}
        <div className="space-y-4 lg:self-start lg:sticky lg:top-20">

          {/* Contact Panel (yakunlangan e'londa bog'lanish yopiq) */}
          {isCompleted ? (
            <div className="bg-white rounded-2xl border border-emerald-200 p-4 sm:p-5 shadow-xs flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-emerald-800">E'lon yakunlangan</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Bu e'lon bajarildi (yakunlandi) deb belgilangan — bog'lanish imkoni yopiq.
                </p>
              </div>
            </div>
          ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-xs">
            <h3 className="font-bold text-sm text-gray-900 mb-3">Aloqaga chiqish</h3>

            {/* Safety note */}
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-[11px] text-blue-900 mb-4 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                TopHand orqali yozish — xavfsizroq aloqa usuli. Begona havolalarga kirmang.
              </span>
            </div>

            <div className="space-y-2.5">
              {/* 1. Chat */}
              <button
                onClick={() => {
                  if (!user) {
                    openLoginModal(() => setIsChatOpen(true));
                  } else {
                    setIsChatOpen(true);
                  }
                }}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 group"
              >
                <MessageSquare className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>TopHand Chat orqali yozish</span>
              </button>

              {/* 2. Telegram */}
              {listing.owner_username && (
                <a
                  href={`https://t.me/${listing.owner_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-xl bg-[#2AABEE]/10 hover:bg-[#2AABEE]/20 text-[#2AABEE] font-bold text-xs border border-[#2AABEE]/30 transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4 -rotate-45" />
                  <span>Telegram: @{listing.owner_username}</span>
                </a>
              )}

              {/* 3. Phone */}
              <button
                onClick={handleRevealPhone}
                className="w-full py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4 text-blue-600" />
                <span>{revealedPhone ? revealedPhone : "Telefon raqamini ko'rish"}</span>
              </button>
            </div>
          </div>
          )}

          {/* Owner Profile Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center gap-3 mb-4">
              <img
                src={
                  listing.owner_photo_url ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(listing.owner_name || 'U')}`
                }
                alt={listing.owner_name}
                className="w-14 h-14 rounded-2xl object-cover ring-2 ring-blue-500/20 shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="font-bold text-sm text-gray-900 truncate">{listing.owner_name}</h4>
                  {isOfficialAccount(listing) ? (
                    <VerifiedBadge size="sm" variant="official" tooltip="TopHand rasmiy hisobi" />
                  ) : isStaffAccount(listing) ? (
                    <VerifiedBadge size="sm" variant="staff" tooltip="TopHand moderatori (staff)" />
                  ) : listing.is_verified ? (
                    <VerifiedBadge size="sm" tooltip="TopHand tomonidan pasport orqali tasdiqlangan mutaxassis" />
                  ) : null}
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {listing.owner_username ? `@${listing.owner_username}` : "TopHand a'zosi"}
                </p>
                {listing.owner_registered_at && (
                  <p className="text-[10px] text-gray-400">
                    A'zo: {formatDateAgo(listing.owner_registered_at)}
                  </p>
                )}
                {/* Rating */}
                {listing.employer_review_count && listing.employer_review_count > 0 && listing.employer_rating ? (
                  <a href="#reviews" className="mt-1 flex items-center gap-1 text-amber-600 hover:underline">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-bold">{listing.employer_rating.toFixed(1)}</span>
                    <span className="text-[11px] text-gray-500">({listing.employer_review_count} ta)</span>
                  </a>
                ) : (
                  <span className="text-[10px] text-gray-400 italic mt-0.5 block">Hali baholanmagan</span>
                )}
              </div>
            </div>

            {listing.owner_bio && (
              <p className="text-xs text-gray-600 line-clamp-3 mb-4 leading-relaxed bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                "{listing.owner_bio}"
              </p>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs py-3 border-t border-b border-gray-100 mb-4">
              <div>
                <span className="block font-bold text-gray-900 text-sm">
                  {listing.owner_active_listing_count || 1}
                </span>
                <span className="text-[11px] text-gray-400">Faol e'lonlar</span>
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
                className={`w-full py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 ${
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
                    <span>Obuna bo'lish</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => onNavigate(`/profile/${listing.owner_user_id}`)}
              className="w-full mt-2 py-2 text-center text-xs font-semibold text-gray-500 hover:text-blue-600 transition-colors"
            >
              Profilni to'liq ko'rish →
            </button>
          </div>

          {/* Organization Card */}
          {listing.organization_id && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-xs">
              <div className="flex items-center gap-3 mb-3">
                {listing.organization_logo_url ? (
                  <img
                    src={listing.organization_logo_url}
                    alt={listing.organization_name}
                    className="w-12 h-12 rounded-xl object-cover border border-gray-100 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-lg shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <h4 className="font-bold text-sm text-gray-900 truncate">{listing.organization_name}</h4>
                    {listing.organization_verification_status === 'VERIFIED' && (
                      <VerifiedBadge size="sm" variant="emerald" tooltip="Rasmiy tasdiqlangan tashkilot" />
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

      {/* Mobil: alohida docked amallar paneli olib tashlandi — like/ulashish
          sarlavha ostidagi ichki amallarda, bog'lanish (chat/telegram/telefon)
          esa "Aloqaga chiqish" kartasida allaqachon mavjud. */}

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

export default ListingDetailPage;
