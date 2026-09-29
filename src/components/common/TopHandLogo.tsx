import React from 'react';
import { useLogo } from '../../context/LogoContext.tsx';

interface TopHandLogoProps {
  variant?: 'default' | 'white' | 'icon';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  showText?: boolean;
  className?: string;
  imgClassName?: string;
  textClassName?: string;
  onClick?: () => void;
  alt?: string;
}

export const TopHandLogo: React.FC<TopHandLogoProps> = ({
  variant = 'default',
  size = 'md',
  showText,
  className = '',
  imgClassName = '',
  textClassName = '',
  onClick,
  alt = 'tophand.uz',
}) => {
  const { fullLogoSrc, branding } = useLogo();

  // If variant is 'icon', default showText is false; otherwise true
  const shouldShowText = showText !== undefined ? showText : variant !== 'icon';

  const sizeClasses = {
    xs: 'h-6 w-6',
    sm: 'h-7 w-7',
    md: 'h-8 w-8 sm:h-9 sm:w-9',
    lg: 'h-10 w-10',
    xl: 'h-12 w-12',
    custom: '',
  }[size];

  const textSizeClasses = {
    xs: 'text-sm',
    sm: 'text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-xl sm:text-2xl',
    xl: 'text-2xl sm:text-3xl',
    custom: '',
  }[size];

  const isWhite = variant === 'white';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2 sm:gap-2.5 select-none bg-transparent ${className} ${
        onClick ? 'cursor-pointer' : ''
      }`}
      style={{ backgroundColor: 'transparent' }}
    >
      <img
        src={fullLogoSrc}
        alt={alt}
        className={`${sizeClasses} ${imgClassName} object-contain shrink-0 bg-transparent`}
        style={{ backgroundColor: 'transparent' }}
        referrerPolicy="no-referrer"
      />
      {shouldShowText && (
        <span
          className={`font-black tracking-tight leading-none flex items-center select-none ${textSizeClasses} ${textClassName}`}
        >
          <span style={{ color: isWhite ? '#ffffff' : (branding.prefix_color || '#111827') }}>
            {branding.prefix_text || 'top'}
          </span>
          <span style={{ color: isWhite ? '#93c5fd' : (branding.suffix_color || '#1673E6') }}>
            {branding.suffix_text || 'hand'}
          </span>
          <span style={{ color: isWhite ? '#93c5fd' : (branding.domain_color || '#1673E6') }}>
            {branding.domain_suffix || '.uz'}
          </span>
        </span>
      )}
    </div>
  );
};

export default TopHandLogo;
