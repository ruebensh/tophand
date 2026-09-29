import React, { useState } from 'react';
import { Listing } from '../../types/index.ts';
import { ListingTypeBadge } from './ListingTypeBadge.tsx';
import { PriceDisplay } from './PriceDisplay.tsx';
import { formatDateAgo } from '../../lib/utils.ts';
import {
  MapPin,
  Heart,
  CheckCircle2,
} from 'lucide-react';
import { apiRequest } from '../../lib/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';

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
  variant = 'grid',
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

  // ── ROW VARIANT (legacy, kept for potential use) ──
  if (variant === 'row') {
    return (
      <div
        onClick={onClick}
        className="group relative border border-gray-100 rounded-2xl hover:border-blue-300 hover:shadow-lg transition-all bg-white overflow-hidden cursor-pointer flex gap-0 w-full"
      >
        {/* Left: Image */}
        <div className="relative w-40 sm:w-48 shrink-0 bg-gray-100 overflow-hidden">
          {coverImage ? (
            <img
              src={coverImage}
              alt={listing.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 absolute inset-0"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50">
              📋
            </div>
          )}
          {/* Type badge */}
          <div className="absolute top-2 left-2 pointer-events-none">
            <ListingTypeBadge type={listing.type} size="sm" />
          </div>
        </div>

        {/* Right: Content */}
        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="font-bold text-base text-blue-700 mb-1">
              <PriceDisplay
                priceType={listing.price_type}
                priceMin={listing.price_min}
                priceMax={listing.price_max}
                currency={listing.currency}
                salaryType={listing.salary_type}
                salaryMin={listing.salary_min}
                salaryMax={listing.salary_max}
                isJob={isJob}
                className="text-blue-700 font-bold text-base"
              />
            </div>
            <h3 className="font-medium text-sm text-gray-800 line-clamp-2 group-hover:text-blue-600 transition-colors leading-snug">
              {listing.title}
            </h3>
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {[listing.district_name, listing.region_name].filter(Boolean).join(', ')}
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-gray-400">
              {formatDateAgo(listing.renewed_at || listing.created_at)}
            </span>
            <button
              type="button"
              onClick={handleSave}
              className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
            >
              <Heart className={`w-4 h-4 ${isSaved ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── AVITO-STYLE GRID CARD ──
  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col bg-white rounded-xl border border-gray-100 hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* ── PHOTO ── */}
      <div className="relative w-full overflow-hidden bg-gray-100" style={{ paddingBottom: '75%' }}>
        {coverImage ? (
          <img
            src={coverImage}
            alt={listing.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 text-gray-400">
            {/* Placeholder: show category icon emoji */}
            <span className="text-4xl mb-1">
              {listing.category_name?.includes('Santex') ? '🔧'
                : listing.category_name?.includes('Elektr') ? '⚡'
                : listing.category_name?.includes('IT') ? '💻'
                : listing.category_name?.includes('Dizayn') ? '🎨'
                : listing.category_name?.includes("Ta'lim") ? '📚'
                : listing.category_name?.includes('Transport') ? '🚚'
                : listing.category_name?.includes('Tozalash') ? '🧹'
                : listing.category_name?.includes('Qurilish') ? '🏗️'
                : listing.category_name?.includes('Avto') ? '🚗'
                : listing.category_name?.includes('Oshpaz') ? '🍳'
                : listing.category_name?.includes('Media') ? '📸'
                : '📋'}
            </span>
            <span className="text-[11px] font-medium text-gray-400 text-center px-2 line-clamp-2">
              {listing.category_name}
            </span>
          </div>
        )}

        {/* Heart save button — top right, like Avito */}
        <button
          type="button"
          onClick={handleSave}
          className={`absolute top-2 right-2 p-1.5 rounded-full transition-all z-10 cursor-pointer ${
            isSaved
              ? 'bg-white text-rose-500 shadow-sm'
              : 'bg-white/75 text-gray-500 hover:bg-white hover:text-rose-500 shadow-sm'
          }`}
          aria-label="Saqlash"
        >
          <Heart
            className={`w-4 h-4 transition-transform active:scale-125 ${
              isSaved ? 'fill-rose-500 text-rose-500' : ''
            }`}
          />
        </button>

        {/* Distance badge if available */}
        {listing.distance_km !== null && listing.distance_km !== undefined && (
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-md font-medium">
            📍 {listing.distance_km} km
          </div>
        )}
      </div>

      {/* ── CONTENT (below photo, like Avito) ── */}
      <div className="p-2.5 flex flex-col gap-0.5 flex-1">

        {/* Price — bold, dark blue like Avito */}
        <div className="font-bold text-sm leading-tight text-gray-900">
          <PriceDisplay
            priceType={listing.price_type}
            priceMin={listing.price_min}
            priceMax={listing.price_max}
            currency={listing.currency}
            salaryType={listing.salary_type}
            salaryMin={listing.salary_min}
            salaryMax={listing.salary_max}
            isJob={isJob}
            className="text-gray-900 font-bold text-sm"
          />
        </div>

        {/* Title */}
        <h3 className="text-xs text-gray-700 line-clamp-2 leading-snug mt-0.5 group-hover:text-blue-600 transition-colors">
          {listing.title}
        </h3>

        {/* Location */}
        <div className="mt-1 flex items-center gap-0.5 text-[11px] text-gray-400">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate leading-none">
            {[listing.district_name, listing.region_name].filter(Boolean).join(', ')}
          </span>
        </div>

        {/* Owner name + verified check */}
        <div className="mt-1.5 pt-1.5 border-t border-gray-100 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[11px] text-gray-500 font-medium truncate">
              {listing.organization_name || listing.owner_name || ''}
            </span>
            {(listing.is_profile_complete || listing.organization_verification_status === 'VERIFIED') && (
              <CheckCircle2 className="w-3 h-3 text-blue-500 shrink-0" />
            )}
          </div>
          <span className="text-[10px] text-gray-400 shrink-0">
            {formatDateAgo(listing.renewed_at || listing.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ListingCard;
