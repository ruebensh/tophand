import React from 'react';
import { ListingType } from '../../types/index.ts';
import { getListingTypeLabel, getListingTypeBadgeColors } from '../../lib/utils.ts';

interface ListingTypeBadgeProps {
  type: ListingType;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ListingTypeBadge: React.FC<ListingTypeBadgeProps> = ({ type, className = '', size = 'md' }) => {
  const label = getListingTypeLabel(type);
  const colors = getListingTypeBadgeColors(type);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-semibold',
    lg: 'text-sm px-3.5 py-1.5 font-semibold',
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border shadow-2xs ${colors.bg} ${sizeClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      <span>{label}</span>
    </span>
  );
};
