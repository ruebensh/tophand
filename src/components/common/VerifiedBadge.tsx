import React from 'react';

interface VerifiedBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  labelText?: string;
  className?: string;
  tooltip?: string;
  variant?: 'blue' | 'emerald' | 'official' | 'staff';
}

// 4-pointed golden sparkle star (tillarang zarcha)
const GoldenSparkle: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`absolute pointer-events-none select-none z-20 ${className}`}
    style={style}
  >
    <path
      d="M8 0L9.4 6.6L16 8L9.4 9.4L8 16L6.6 9.4L0 8L6.6 6.6L8 0Z"
      fill="url(#zarcha-gold-grad)"
    />
  </svg>
);

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  size = 'sm',
  showLabel = false,
  labelText = 'Tasdiqlangan',
  className = '',
  tooltip = 'TopHand tomonidan to‘liq tasdiqlangan profil',
  variant = 'blue',
}) => {
  const sizeMap = {
    xs: { icon: 'w-4 h-4', p1: 'w-2 h-2', p2: 'w-1.5 h-1.5', text: 'text-[10px]' },
    sm: { icon: 'w-4.5 h-4.5', p1: 'w-2.5 h-2.5', p2: 'w-2 h-2', text: 'text-[11px]' },
    md: { icon: 'w-5.5 h-5.5', p1: 'w-3 h-3', p2: 'w-2 h-2', text: 'text-xs' },
    lg: { icon: 'w-7 h-7', p1: 'w-3.5 h-3.5', p2: 'w-2.5 h-2.5', text: 'text-sm' },
  }[size];

  const badgeIcon = (
    <span
      className={`relative inline-flex items-center justify-center shrink-0 select-none overflow-visible ${sizeMap.icon}`}
      title={tooltip}
    >
      {/* Tillarang zarchalar: 4 golden floating sparkles rising out from around the badge */}
      <span className="absolute inset-0 pointer-events-none overflow-visible" aria-hidden="true">
        {/* Zarcha 1: floats up-left */}
        <GoldenSparkle className={`${sizeMap.p1} animate-zarcha-1 -top-1 -left-1`} />
        {/* Zarcha 2: floats up-right */}
        <GoldenSparkle className={`${sizeMap.p2} animate-zarcha-2 -top-1.5 -right-1`} />
        {/* Zarcha 3: floats top-center */}
        <GoldenSparkle className={`${sizeMap.p1} animate-zarcha-3 -top-2 left-1/4`} />
        {/* Zarcha 4: floats right */}
        <GoldenSparkle className={`${sizeMap.p2} animate-zarcha-4 top-0.5 -right-1.5`} />
      </span>

      {/* Main Crisp Official Rosette Seal with gentle golden-blue glow */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 w-full h-full animate-badge-glow overflow-visible"
      >
        <defs>
          <linearGradient id="verified-blue-seal" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1D4ED8" />
            <stop offset="0.4" stopColor="#1673E6" />
            <stop offset="0.9" stopColor="#0284C7" />
          </linearGradient>

          <linearGradient id="verified-emerald-seal" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#047857" />
            <stop offset="0.4" stopColor="#10B981" />
            <stop offset="0.9" stopColor="#059669" />
          </linearGradient>

          {/* Official (TopHand admin) royal-gold seal */}
          <linearGradient id="verified-gold-seal" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FEF3C7" />
            <stop offset="0.35" stopColor="#F59E0B" />
            <stop offset="0.75" stopColor="#D97706" />
            <stop offset="1" stopColor="#92400E" />
          </linearGradient>

          {/* Staff (TopHand moderator) indigo-violet seal */}
          <linearGradient id="verified-staff-seal" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4338CA" />
            <stop offset="0.5" stopColor="#6366F1" />
            <stop offset="1" stopColor="#7C3AED" />
          </linearGradient>

          {/* Golden zarcha gradient */}
          <linearGradient id="zarcha-gold-grad" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFBEB" />
            <stop offset="0.25" stopColor="#FDE047" />
            <stop offset="0.6" stopColor="#F59E0B" />
            <stop offset="1" stopColor="#D97706" />
          </linearGradient>
        </defs>

        {/* 16-point scalloped verified badge seal */}
        <path
          d="M10.29 2.308a2.23 2.23 0 0 1 3.42 0l.738.868a2.23 2.23 0 0 0 2.247.602l1.106-.289a2.23 2.23 0 0 1 2.766 2.01l.056 1.141a2.23 2.23 0 0 0 1.39 1.897l1.045.466a2.23 2.23 0 0 1 1.056 3.25l-.657.933a2.23 2.23 0 0 0 0 2.628l.657.933a2.23 2.23 0 0 1-1.056 3.25l-1.045.466a2.23 2.23 0 0 0-1.39 1.897l-.056 1.141a2.23 2.23 0 0 1-2.766 2.01l-1.106-.289a2.23 2.23 0 0 0-2.247.602l-.738.868a2.23 2.23 0 0 1-3.42 0l-.738-.868a2.23 2.23 0 0 0-2.247-.602l-1.106.289a2.23 2.23 0 0 1-2.766-2.01l-.056-1.141a2.23 2.23 0 0 0-1.39-1.897l-1.045-.466a2.23 2.23 0 0 1-1.056-3.25l.657-.933a2.23 2.23 0 0 0 0-2.628l-.657-.933a2.23 2.23 0 0 1 1.056-3.25l1.045-.466a2.23 2.23 0 0 0 1.39-1.897l.056-1.141a2.23 2.23 0 0 1 2.766-2.01l1.106.289a2.23 2.23 0 0 0 2.247-.602l.738-.868z"
          fill={
            variant === 'emerald'
              ? 'url(#verified-emerald-seal)'
              : variant === 'official'
                ? 'url(#verified-gold-seal)'
                : variant === 'staff'
                  ? 'url(#verified-staff-seal)'
                  : 'url(#verified-blue-seal)'
          }
        />

        {variant === 'official' ? (
          <>
            {/* Royal crown glyph marks the official TopHand account */}
            <path
              d="M5 15.5L3.4 7.2l4.7 3.4L12 5.6l3.9 5 4.7-3.4L19 15.5H5z"
              fill="#FFFFFF"
              stroke="#FFFFFF"
              strokeWidth="0.6"
              strokeLinejoin="round"
            />
            <rect x="5.4" y="16.8" width="13.2" height="1.9" rx="0.7" fill="#FFFFFF" />
          </>
        ) : variant === 'staff' ? (
          <>
            {/* Shield + check marks TopHand moderator / staff accounts */}
            <path
              d="M12 3.4l6.6 2.5v5.1c0 4.3-2.8 7.2-6.6 8.5-3.8-1.3-6.6-4.2-6.6-8.5V5.9L12 3.4z"
              fill="#FFFFFF"
            />
            <path
              d="M8.9 11.9l2.1 2.1 4.2-4.4"
              stroke="#4F46E5"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          /* Crisp checkmark with clean anti-aliasing */
          <path
            d="M8.5 12.3l2.4 2.4 4.8-5"
            stroke="#FFFFFF"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </span>
  );

  if (!showLabel) {
    return <span className={`inline-flex items-center overflow-visible ${className}`}>{badgeIcon}</span>;
  }

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold transition-all shadow-xs overflow-visible ${
        variant === 'emerald'
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs'
          : variant === 'official'
            ? 'bg-amber-50 text-amber-700 border border-amber-300 shadow-xs'
            : variant === 'staff'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs'
              : 'bg-blue-50 text-[#1673E6] border border-blue-200 shadow-xs'
      } ${sizeMap.text} ${className}`}
    >
      {badgeIcon}
      <span>{labelText}</span>
    </span>
  );
};

export default VerifiedBadge;
