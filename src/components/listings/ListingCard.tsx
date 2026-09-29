import React, { useState } from 'react';
import { Listing } from '../../types/index.ts';
import { ListingTypeBadge } from './ListingTypeBadge.tsx';
import { PriceDisplay } from './PriceDisplay.tsx';
import { formatDateAgo } from '../../lib/utils.ts';
import {
  MapPin,
  Bookmark,
  Building2,
  UserCheck,
  Briefcase,
  Calendar,
  CheckCircle,
  Heart,
  Star,
} from 'lucide-react';
import { apiRequest } from '../../lib/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { VerifiedBadge } from '../common/VerifiedBadge.tsx';

interface ListingCardProps {
  listing: Listing;
  onClick: () => void;
  onSaveToggle?: (saved: boolean) => void;
  variant?: 'row' | 'grid';
}

export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  onClick,
  onSaveToggle,
  variant = 'row',
}) => {
  const { user, openLoginModal } = useAuth();
  const [isSaved, setIsSaved] = useState(listing.is_saved || false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      openLoginModal();
      return;
    }

    if (isSaving) return;
    setIsSaving(true);
    const nextSavedState = !isSaved;
    setIsSaved(nextSavedState);

    try {
      const res = await apiRequest<{ saved: boolean }>(`/api/listings/${listing.id}/save`, {
        method: 'POST',
      });
      setIsSaved(res.saved);
      if (onSaveToggle) onSaveToggle(res.saved);
    } catch (err) {
      setIsSaved(!nextSavedState);
      console.error('Failed to toggle save:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const coverImage = listing.images && listing.images.length > 0 ? listing.images[0] : null;
  const isJob = listing.type === 'JOB_OPENING' || listing.type === 'JOB_SEEKER';

  // Variation 23: Clean Row/Split Card Layout
  if (variant === 'row') {
    return (
      <div
        onClick={onClick}
        className="group relative border border-[#EBECF0] rounded-xl hover:border-[#1673E6] hover:shadow-md transition-all bg-white overflow-hidden cursor-pointer grid grid-cols-1 md:grid-cols-[1fr_260px] w-full max-w-full"
      >
        {/* Main Section */}
        <div className="p-3.5 sm:p-5 lg:p-6 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              {/* Salary / Price (Variation 23 Accent Warm) */}
              <div className="text-base sm:text-lg font-bold text-[#F59E0B]">
                <PriceDisplay
                  priceType={listing.price_type}
                  priceMin={listing.price_min}
                  priceMax={listing.price_max}
                  currency={listing.currency}
                  salaryType={listing.salary_type}
                  salaryMin={listing.salary_min}
                  salaryMax={listing.salary_max}
                  isJob={isJob}
                  className="text-[#F59E0B] font-bold"
                />
              </div>

              {/* Bookmark Button (For the Listing, moved away from author profile) */}
              <button
                type="button"
                onClick={handleSave}
                className="p-1.5 text-[#5E6C84] hover:text-[#1673E6] hover:bg-gray-50 rounded-lg transition-colors cursor-pointer shrink-0"
                aria-label="E'lonni saqlash"
                title="E'lonni saqlash"
              >
                <Bookmark
                  className={`w-5 h-5 transition-transform active:scale-125 ${
                    isSaved ? 'fill-[#EF4444] text-[#EF4444]' : ''
                  }`}
                />
              </button>
            </div>

            {/* Title */}
            <h3 className="text-lg sm:text-xl font-bold text-[#172B4D] group-hover:text-[#1673E6] transition-colors line-clamp-2 leading-snug mb-3">
              {listing.title}
            </h3>

            {/* Tags */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-medium text-[#5E6C84] mb-3">
              <div className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#5E6C84]" />
                <span>{listing.category_name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#5E6C84]" />
                <span>
                  {listing.district_name}, {listing.region_name}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#5E6C84]" />
                <span>{formatDateAgo(listing.renewed_at || listing.created_at)}</span>
              </div>
            </div>

            {/* Description Snippet */}
            <p className="text-sm text-[#5E6C84] line-clamp-2 leading-relaxed mb-4">
              {listing.description}
            </p>
          </div>

          {/* Skill / Category Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-[#F9FAFB] border border-[#EBECF0] text-[#5E6C84] px-2.5 py-1 rounded text-[11px] font-semibold tracking-wide uppercase">
              {listing.category_name}
            </span>
            <ListingTypeBadge type={listing.type} size="sm" />
            {listing.distance_km !== null && listing.distance_km !== undefined && (
              <span className="bg-blue-50 text-[#1673E6] px-2.5 py-1 rounded text-[11px] font-semibold">
                {listing.distance_km} km masofa
              </span>
            )}
            {listing.is_followed && (
              <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                Obuna
              </span>
            )}
          </div>
        </div>

        {/* Side Section */}
        <div className="p-3.5 sm:p-5 lg:p-6 bg-[#FAFBFC] border-t md:border-t-0 md:border-l border-[#EBECF0] flex flex-col justify-between min-w-0">
          <div className="flex items-start gap-3">
            <img
              src={
                coverImage ||
                listing.organization_logo_url ||
                listing.owner_photo_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  listing.organization_name || listing.owner_name || 'User'
                )}&background=1673E6&color=fff`
              }
              alt={listing.organization_name || listing.owner_name || 'TopHand'}
              className="w-10 h-10 rounded-lg object-cover border border-[#EBECF0] shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-[#172B4D] flex items-center gap-1.5 overflow-visible">
                <span className="truncate max-w-[130px] sm:max-w-[155px]">{listing.organization_name || listing.owner_name}</span>
                {(listing.organization_verification_status === 'VERIFIED' ||
                  listing.is_profile_complete) && (
                  <VerifiedBadge
                    size="sm"
                    tooltip={
                      listing.organization_verification_status === 'VERIFIED'
                        ? 'Tasdiqlangan tashkilot'
                        : 'Tasdiqlangan profil'
                    }
                  />
                )}
              </div>
              <div className="text-xs text-[#5E6C84] mt-0.5 truncate flex items-center gap-1.5">
                <span className="truncate">{listing.organization_name ? 'Tashkilot' : 'Mutaxassis'} • {listing.region_name}</span>
                {listing.is_followed && (
                  <span className="px-1.5 py-0.5 rounded-sm bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200 shrink-0">
                    Kuzatmoqdasiz
                  </span>
                )}
              </div>

              {/* Employer Rating Summary (Variation 23 Requirement) */}
              <div className="mt-2 flex items-center justify-between gap-1.5 text-xs">
                {listing.employer_review_count && listing.employer_review_count > 0 && listing.employer_rating ? (
                  <div className="flex items-center gap-1">
                    <span className="text-amber-500 font-bold flex items-center gap-0.5">
                      <Star className="w-3.5 h-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                      <span>{listing.employer_rating.toFixed(1)}</span>
                    </span>
                    <span className="text-[#5E6C84] text-[11px]">
                      ({listing.employer_review_count} ta sharh)
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-400 text-[11px] italic">Hali baholanmagan</span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                  }}
                  className="text-[#1673E6] hover:underline font-semibold text-[11px] shrink-0 ml-auto cursor-pointer"
                >
                  Sharhlar
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 pt-2">
            <button
              type="button"
              onClick={onClick}
              className="flex-1 py-2 px-3 rounded-lg bg-[#1673E6] hover:bg-blue-700 text-white font-semibold text-xs transition-colors text-center cursor-pointer"
            >
              Batafsil
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="flex-1 py-2 px-3 rounded-lg border border-[#EBECF0] bg-white hover:bg-gray-50 text-[#172B4D] font-semibold text-xs transition-colors text-center cursor-pointer"
            >
              Bog‘lanish
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Classic Grid Card Layout
  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col bg-white rounded-2xl border border-gray-100 hover:border-blue-200 shadow-xs hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* Cover Image & Badges */}
      <div className="relative aspect-[16/10] w-full bg-gray-50 overflow-hidden">
        {coverImage ? (
          <img
            src={coverImage}
            alt={listing.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 p-4 text-center">
            <span className="text-3xl mb-1">📋</span>
            <span className="text-xs font-medium text-gray-500">{listing.category_name}</span>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between pointer-events-none">
          <div className="flex flex-col gap-1 items-start">
            <ListingTypeBadge type={listing.type} size="sm" />
            {listing.is_followed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-semibold shadow-xs">
                <UserCheck className="w-2.5 h-2.5" />
                Obuna
              </span>
            )}
          </div>

          {/* Heart Save Button */}
          <button
            type="button"
            onClick={handleSave}
            className={`pointer-events-auto p-2 rounded-full backdrop-blur-md transition-colors ${
              isSaved
                ? 'bg-rose-50 text-rose-600 border border-rose-200'
                : 'bg-white/80 hover:bg-white text-gray-600 hover:text-rose-600 shadow-xs'
            }`}
            aria-label="Saqlash"
          >
            <Heart
              className={`w-4 h-4 transition-transform active:scale-125 ${
                isSaved ? 'fill-rose-500 text-rose-500' : ''
              }`}
            />
          </button>
        </div>

        {/* Distance Indicator if GPS provided */}
        {listing.distance_km !== null && listing.distance_km !== undefined && (
          <div className="absolute bottom-2 left-2 bg-gray-900/80 backdrop-blur-xs text-white text-[11px] px-2 py-0.5 rounded-md font-medium">
            📍 {listing.distance_km} km masofa
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Price / Salary */}
          <div className="mb-1.5 flex items-baseline justify-between">
            <PriceDisplay
              priceType={listing.price_type}
              priceMin={listing.price_min}
              priceMax={listing.price_max}
              currency={listing.currency}
              salaryType={listing.salary_type}
              salaryMin={listing.salary_min}
              salaryMax={listing.salary_max}
              isJob={isJob}
              className="text-base text-blue-900 font-bold"
            />
          </div>

          {/* Title */}
          <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
            {listing.title}
          </h3>

          {/* Location */}
          <div className="mt-2 flex items-center text-xs text-gray-500 gap-1">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-400" />
            <span className="truncate">
              {listing.district_name}, {listing.region_name}
            </span>
          </div>

          {/* Employer Rating in Grid */}
          <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
            {listing.employer_review_count && listing.employer_review_count > 0 && listing.employer_rating ? (
              <div className="flex items-center gap-1">
                <span className="text-amber-500 font-bold flex items-center gap-0.5">
                  <Star className="w-3.5 h-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                  <span>{listing.employer_rating.toFixed(1)}</span>
                </span>
                <span className="text-[#5E6C84] text-[11px]">
                  ({listing.employer_review_count} ta sharh)
                </span>
              </div>
            ) : (
              <span className="text-gray-400 text-[11px] italic">Hali baholanmagan</span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="text-[#1673E6] hover:underline font-semibold text-[11px] cursor-pointer"
            >
              Sharhlar
            </button>
          </div>
        </div>

        {/* Card Footer: Owner/Org & Time */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1.5 min-w-0 overflow-visible">
            {listing.organization_name ? (
              <div className="flex items-center gap-1 overflow-visible text-gray-700 font-medium">
                <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate max-w-[120px]">{listing.organization_name}</span>
                {listing.organization_verification_status === 'VERIFIED' && (
                  <VerifiedBadge size="xs" tooltip="Tasdiqlangan tashkilot" />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 overflow-visible text-gray-700 font-medium">
                <span className="truncate max-w-[120px]">{listing.owner_name}</span>
                {listing.is_profile_complete && (
                  <VerifiedBadge size="xs" tooltip="To‘liq tasdiqlangan profil" />
                )}
              </div>
            )}
          </div>
          <span className="shrink-0 text-gray-400 text-[11px]">
            {formatDateAgo(listing.renewed_at || listing.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ListingCard;
