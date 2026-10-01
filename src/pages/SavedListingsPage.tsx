import React, { useState, useEffect } from 'react';
import { Listing } from '../types/index.ts';
import { apiRequest } from '../lib/api.ts';
import { ListingTypeBadge } from '../components/listings/ListingTypeBadge.tsx';
import { PriceDisplay } from '../components/listings/PriceDisplay.tsx';
import { VerifiedBadge } from '../components/common/VerifiedBadge.tsx';
import {
  Bookmark,
  ChevronLeft,
  Heart,
  LogIn,
  MapPin,
  Calendar,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { formatDateAgo, isOfficialAccount, isStaffAccount } from '../lib/utils.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface SavedListingsPageProps {
  onNavigate: (route: string) => void;
  onOpenListing: (id: string) => void;
}

export const SavedListingsPage: React.FC<SavedListingsPageProps> = ({
  onNavigate,
  onOpenListing,
}) => {
  const { user, openLoginModal } = useAuth();
  const [savedListings, setSavedListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSaved = async () => {
    if (!user) {
      setSavedListings([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const list = await apiRequest<Listing[]>('/api/saved-listings');
      setSavedListings(list || []);
    } catch (err) {
      console.error('Failed to load saved listings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSaved();
  }, [user]);

  const handleRemoveSaved = async (e: React.MouseEvent, listingId: string) => {
    e.stopPropagation();
    // Optimistic removal
    setSavedListings((prev) => prev.filter((item) => item.id !== listingId));
    try {
      await apiRequest(`/api/listings/${listingId}/save`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to remove from saved:', err);
      fetchSaved();
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 sm:pb-16 min-h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/')}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
            title="Asosiy sahifaga qaytish"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 flex items-center gap-2 tracking-tight">
              <Bookmark className="w-5 h-5 text-blue-600 fill-blue-600" />
              <span>Saqlangan e’lonlar</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Siz yoqtirgan va saqlab qo‘ygan barcha e’lonlar
            </p>
          </div>
        </div>

        {savedListings.length > 0 && (
          <span className="text-xs font-bold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full">
            {savedListings.length} ta saqlangan
          </span>
        )}
      </div>

      {/* Guest / Not logged in state */}
      {!user ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-8 sm:p-12 text-center max-w-md mx-auto my-8 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-base text-gray-900">
            Saqlangan e’lonlarni ko‘rish uchun tizimga kiring
          </h3>
          <p className="text-xs text-gray-500 mt-2 mb-6 leading-relaxed">
            Yoqqan xizmat yoki ish e’lonlarini saqlab borish va ularga istalgan qurilmadan kirish uchun hisobingizga kiring.
          </p>
          <button
            onClick={() => openLoginModal()}
            className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-colors shadow-xs flex items-center justify-center gap-2 mx-auto cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Tizimga kirish</span>
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-4 sm:p-5 animate-pulse flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="w-20 h-20 sm:w-28 sm:h-24 bg-gray-200 rounded-xl sm:rounded-2xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-28 h-3.5 bg-gray-200 rounded-md" />
                  <div className="w-3/4 h-4 bg-gray-200 rounded-md" />
                  <div className="w-1/2 h-3 bg-gray-100 rounded-md" />
                </div>
              </div>
              <div className="w-24 h-6 bg-gray-200 rounded-md self-end sm:self-center" />
            </div>
          ))}
        </div>
      ) : savedListings.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-8 sm:p-12 text-center max-w-md mx-auto my-8 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto mb-3">
            <Bookmark className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-base text-gray-900">
            Hozircha saqlangan e’lonlar yo‘q
          </h3>
          <p className="text-xs text-gray-500 mt-1.5 mb-6 leading-relaxed">
            Sizga ma’qul kelgan ish yoki xizmat e’lonlaridagi xatcho‘p tugmasini bosib, ularni bu yerda to‘plashingiz mumkin.
          </p>
          <button
            onClick={() => onNavigate('/')}
            className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-colors shadow-xs cursor-pointer inline-flex items-center gap-2"
          >
            <span>E’lonlarni ko‘rish</span>
          </button>
        </div>
      ) : (
        /* Tasteful, elegant List View */
        <div className="space-y-3">
          {savedListings.map((l) => {
            const isJob = l.type === 'JOB_OPENING' || l.type === 'JOB_SEEKER';

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

                    {/* Author & Date Bottom Row */}
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
                      {/* Author */}
                      <div className="flex items-center gap-1.5 font-medium text-gray-700 truncate max-w-[200px]">
                        <img
                          src={
                            l.organization_logo_url ||
                            l.owner_photo_url ||
                            `https://api.dicebear.com/7.x/initials/svg?seed=${l.owner_name}`
                          }
                          alt={l.owner_name || 'Muallif'}
                          className="w-4 h-4 rounded-full object-cover shrink-0 ring-1 ring-gray-200"
                        />
                        <span className="truncate">{l.organization_name || l.owner_name}</span>
                        {isOfficialAccount(l) ? (
                          <VerifiedBadge size="xs" variant="official" tooltip="TopHand rasmiy hisobi" />
                        ) : isStaffAccount(l) ? (
                          <VerifiedBadge size="xs" variant="staff" tooltip="TopHand moderatori (staff)" />
                        ) : l.is_verified ? (
                          <VerifiedBadge size="xs" />
                        ) : null}
                      </div>

                      <span className="text-gray-300">•</span>

                      {/* Date */}
                      <span className="flex items-center gap-1 text-gray-400">
                        <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                        <span>{formatDateAgo(l.renewed_at || l.created_at)}</span>
                      </span>

                      {l.is_followed && (
                        <span className="px-1.5 py-0.5 rounded-sm bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200 shrink-0">
                          Kuzatmoqdasiz
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Price & Actions */}
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

                  <div className="flex items-center gap-2">
                    {/* Remove from Saved Button */}
                    <button
                      type="button"
                      onClick={(e) => handleRemoveSaved(e, l.id)}
                      title="Saqlanganlardan o‘chirish"
                      className="p-2 rounded-full text-gray-400 hover:text-rose-500 hover:bg-rose-50 border border-gray-200 hover:border-rose-200 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

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
      )}
    </div>
  );
};

export default SavedListingsPage;
