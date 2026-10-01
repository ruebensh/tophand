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

  // SEO: hudud landing sahifalariga ichki havolalar (krawl uchun <a href>)
  const regions: { slug: string; name: string }[] = [
    { slug: 'toshkent-sh', name: 'Toshkent shahri' },
    { slug: 'toshkent', name: 'Toshkent viloyati' },
    { slug: 'samarqand', name: 'Samarqand' },
    { slug: 'fargona', name: "Farg'ona" },
    { slug: 'andijon', name: 'Andijon' },
    { slug: 'namangan', name: 'Namangan' },
    { slug: 'buxoro', name: 'Buxoro' },
    { slug: 'xorazm', name: 'Xorazm' },
    { slug: 'qashqadaryo', name: 'Qashqadaryo' },
    { slug: 'surxondaryo', name: 'Surxondaryo' },
    { slug: 'jizzax', name: 'Jizzax' },
    { slug: 'sirdaryo', name: 'Sirdaryo' },
    { slug: 'navoiy', name: 'Navoiy' },
    { slug: 'qoraqalpogiston', name: "Qoraqalpog'iston" },
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
              © {new Date().getFullYear()} TopHand · O‘zbekistonda yaratilgan
            </p>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {links.map((l) => (
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

        {/* Hududlar bo'yicha e'lonlar (SEO internal links) */}
        <div className="mt-5 pt-5 border-t border-[#EBECF0]">
          <p className="text-[11px] font-bold text-[#5E6C84] mb-2">Hududlar bo'yicha e'lonlar</p>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {regions.map((r) => (
              <a
                key={r.slug}
                href={`/hudud/${r.slug}`}
                onClick={(e) => { e.preventDefault(); onNavigate(`/hudud/${r.slug}`); }}
                className="text-[11px] text-[#8A94A6] hover:text-[#1673E6] transition-colors cursor-pointer"
              >
                {r.name} e'lonlari
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
};
