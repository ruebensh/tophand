import React from 'react';
import { TopHandLogo } from '../common/TopHandLogo.tsx';
import { useI18n } from '../../i18n/IntlContext.tsx';

interface FooterProps {
  onNavigate: (route: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { t } = useI18n();
  // Huquqiy / axborot sahifalari (AdSense tasdiqi uchun majburiy)
  const legalLinks: { label: string; route: string }[] = [
    { label: t('footer.about'), route: '/about' },
    { label: t('footer.terms'), route: '/terms' },
    { label: t('footer.privacy'), route: '/privacy' },
    { label: t('footer.contact'), route: '/contact' },
  ];

  return (
    <footer className="bg-white border-t border-[#EBECF0]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              onClick={() => onNavigate('/')}
              className="flex items-center cursor-pointer select-none hover:opacity-90 transition-opacity"
            >
              <TopHandLogo size="sm" showText={false} imgClassName="w-7 h-7 object-contain" alt="tophand.uz" />
            </div>
            <p className="text-xs text-[#5E6C84]">
              © {new Date().getFullYear()} {t('footer.tagline')}
            </p>
          </div>

          {/* Huquqiy / axborot havolalari */}
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {legalLinks.map((l) => (
              <a
                key={l.route}
                href={l.route}
                onClick={(e) => { e.preventDefault(); onNavigate(l.route); }}
                className="text-xs font-medium text-[#5E6C84] hover:text-[#1673E6] transition-colors cursor-pointer"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
};
