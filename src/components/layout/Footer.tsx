import React from 'react';
import { TopHandLogo } from '../common/TopHandLogo.tsx';

interface FooterProps {
  onNavigate: (route: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const links: { label: string; route: string }[] = [
    { label: 'Bosh sahifa', route: '/' },
    { label: 'Kategoriyalar', route: '/categories' },
    { label: 'E’lon berish', route: '/create' },
    { label: 'Saqlanganlar', route: '/saved' },
  ];

  return (
    <footer className="bg-white border-t border-[#EBECF0]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            onClick={() => onNavigate('/')}
            className="flex items-center cursor-pointer select-none hover:opacity-90 transition-opacity"
          >
            <TopHandLogo size="sm" showText={false} imgClassName="w-7 h-7 object-contain" alt="tophand.uz" />
          </div>
          <p className="text-xs text-[#5E6C84]">
            © {new Date().getFullYear()} TopHand · O‘zbekistonda yaratilgan
          </p>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {links.map((l) => (
            <button
              key={l.route}
              onClick={() => onNavigate(l.route)}
              className="text-xs font-medium text-[#5E6C84] hover:text-[#1673E6] transition-colors cursor-pointer"
            >
              {l.label}
            </button>
          ))}
        </nav>
      </div>
    </footer>
  );
};
