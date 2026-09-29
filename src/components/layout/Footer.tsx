import React from 'react';
import { ShieldCheck, Heart, MapPin } from 'lucide-react';
import { TopHandLogo } from '../common/TopHandLogo.tsx';

interface FooterProps {
  onNavigate: (route: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="hidden md:block bg-gray-900 text-gray-300 pt-12 pb-12 mt-16 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* 1. Brand column */}
          <div className="md:col-span-1">
            <div
              onClick={() => onNavigate('/')}
              className="flex items-center cursor-pointer select-none mb-4 hover:opacity-95 transition-opacity"
            >
              <TopHandLogo
                variant="white"
                size="md"
                showText={true}
                imgClassName="w-8 h-8 object-contain"
                alt="tophand.uz"
              />
            </div>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              O‘zbekistondagi xizmatlar, tajribali ustalar, bo‘sh ish o‘rinlari va mutaxassislar uchun yagona ishonchli mahalliy bozor platformasi.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Xavfsiz va tekshirilgan muloqot</span>
            </div>
          </div>

          {/* 2. Platforma */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Platforma</h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li>
                <button onClick={() => onNavigate('/')} className="hover:text-white transition-colors">
                  Bosh sahifa
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/create')} className="hover:text-white transition-colors">
                  E’lon berish (bepul)
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/create-org')} className="hover:text-white transition-colors">
                  Tashkilot profili ochish
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/chat')} className="hover:text-white transition-colors">
                  TopHand Chat
                </button>
              </li>
            </ul>
          </div>

          {/* 3. Xizmat turlari */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">E’lon turlari</h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li>Xizmat taklif qilaman (Ustalar)</li>
              <li>Xizmat kerak (Buyurtmalar)</li>
              <li>Ishchi qidiraman (Vakansiyalar)</li>
              <li>Ish qidiraman (Rezyumelar)</li>
            </ul>
          </div>

          {/* 4. Hududlar */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Qamrov</h4>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
              <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
              <span>O‘zbekistonning barcha 14 ta hududi</span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Toshkent, Samarqand, Buxoro, Andijon, Farg‘ona, Namangan, Qashqadaryo, Xorazm va boshqa barcha tumanlarda.
            </p>
          </div>
        </div>

        {/* Safety Note & Copyright */}
        <div className="pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <p>© {new Date().getFullYear()} TopHand. Barcha huquqlar himoyalangan.</p>
          <div className="flex items-center gap-1 text-[11px]">
            <span>O‘zbekistonda mehr bilan yaratilgan</span>
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
          </div>
        </div>
      </div>
    </footer>
  );
};
