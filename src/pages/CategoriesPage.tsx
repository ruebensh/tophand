import React, { useState, useEffect } from 'react';
import { Category, ListingType } from '../types/index.ts';
import { apiRequest } from '../lib/api.ts';
import {
  Wrench,
  Zap,
  Hammer,
  Code,
  Palette,
  GraduationCap,
  Truck,
  Sparkles,
  HeartPulse,
  Camera,
  ShoppingBag,
  UtensilsCrossed,
  Car,
  MoreHorizontal,
  Search,
  ArrowRight,
  LayoutGrid,
  ChevronLeft,
  X,
  Briefcase,
  Layers,
  LucideIcon,
} from 'lucide-react';

interface CategoriesPageProps {
  onNavigate: (route: string) => void;
  onSelectCategory?: (categoryId: string) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Wrench,
  Zap,
  Hammer,
  Code,
  Palette,
  GraduationCap,
  Truck,
  Sparkles,
  HeartPulse,
  Camera,
  ShoppingBag,
  UtensilsCrossed,
  Car,
  MoreHorizontal,
};

export const CategoriesPage: React.FC<CategoriesPageProps> = ({
  onNavigate,
  onSelectCategory,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedType, setSelectedType] = useState<ListingType | 'ALL'>('ALL');

  useEffect(() => {
    setIsLoading(true);
    apiRequest<Category[]>('/api/categories')
      .then((data) => {
        setCategories(data);
      })
      .catch((err) => {
        console.error('Kategoriyalarni yuklashda xatolik:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleCategoryClick = (cat: Category) => {
    if (onSelectCategory) {
      onSelectCategory(cat.id);
    } else {
      const typeQuery = selectedType !== 'ALL' ? `&type=${selectedType}` : '';
      onNavigate(`/?category=${cat.id}${typeQuery}`);
    }
  };

  const filteredCategories = categories.filter((cat) => {
    if (!searchTerm.trim()) return true;
    return cat.name_uz.toLowerCase().includes(searchTerm.toLowerCase().trim());
  });

  const totalListings = categories.reduce(
    (acc, curr) => acc + (curr.active_count || 0),
    0
  );

  return (
    <div className="min-h-[calc(100vh-140px)] bg-gray-50/50 pb-24 sm:pb-16">
      {/* Top Banner / Breadcrumb */}
      <div className="bg-white border-b border-[#EBECF0]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-5">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => onNavigate('/')}
              className="p-1 rounded-lg text-[#5E6C84] hover:text-[#172B4D] hover:bg-gray-100 transition-colors cursor-pointer"
              title="Orqaga"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 text-xs text-[#5E6C84]">
              <button
                onClick={() => onNavigate('/')}
                className="hover:text-[#1673E6] transition-colors"
              >
                Asosiy
              </button>
              <span>/</span>
              <span className="font-semibold text-[#172B4D]">Kategoriyalar</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1673E6] flex items-center justify-center">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#172B4D] tracking-tight">
                  Kategoriyalar
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-[#5E6C84] mt-1">
                Kerakli xizmat yoki ish sohasini tanlang ({categories.length} ta yo‘nalish, {totalListings} ta faol e’lon)
              </p>
            </div>

            {/* Quick Type Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {[
                { id: 'ALL', label: 'Barchasi' },
                { id: 'SERVICE_OFFER', label: 'Xizmatlar' },
                { id: 'JOB_OPENING', label: 'Ish o‘rinlari' },
                { id: 'SERVICE_REQUEST', label: 'Buyurtmalar' },
                { id: 'JOB_SEEKER', label: 'Rezyumelar' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedType(t.id as any)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                    selectedType === t.id
                      ? 'bg-[#1673E6] text-white shadow-2xs'
                      : 'bg-white text-[#5E6C84] hover:text-[#172B4D] border border-[#EBECF0]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Search Input */}
          <div className="mt-4 relative max-w-xl">
            <div className="flex items-center bg-[#F9FAFB] border border-[#EBECF0] rounded-xl px-3.5 py-2.5 focus-within:border-[#1673E6] focus-within:bg-white transition-all shadow-2xs">
              <Search className="w-4 h-4 text-[#5E6C84] shrink-0 mr-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Kategoriya yoki soha nomini kiriting..."
                className="w-full bg-transparent text-xs sm:text-sm text-[#172B4D] placeholder-[#5E6C84] focus:outline-hidden"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Categories Content */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="bg-white border border-[#EBECF0] rounded-2xl p-4 animate-pulse flex flex-col items-center text-center space-y-3"
              >
                <div className="w-12 h-12 rounded-xl bg-gray-100" />
                <div className="w-3/4 h-4 bg-gray-100 rounded" />
                <div className="w-1/2 h-3 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#EBECF0] p-12 text-center max-w-md mx-auto my-8">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-[#1673E6] flex items-center justify-center text-xl mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm text-[#172B4D]">
              Hech qanday kategoriya topilmadi
            </h3>
            <p className="text-xs text-[#5E6C84] mt-1 mb-4">
              "{searchTerm}" so‘zi bo‘yicha mos yo‘nalish mavjud emas. Boshqa so‘z bilan qidiring.
            </p>
            <button
              onClick={() => setSearchTerm('')}
              className="px-4 py-2 rounded-lg bg-[#1673E6] text-white font-semibold text-xs cursor-pointer"
            >
              Qidiruvni tozalash
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {filteredCategories.map((cat) => {
              const IconComponent = ICON_MAP[cat.icon] || MoreHorizontal;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat)}
                  className="group bg-white hover:bg-blue-50/40 border border-[#EBECF0] hover:border-[#1673E6]/40 rounded-2xl p-4 sm:p-5 flex flex-col items-center text-center transition-all duration-200 shadow-2xs hover:shadow-md cursor-pointer relative"
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-[#1673E6] text-[#1673E6] group-hover:text-white flex items-center justify-center mb-3 transition-colors duration-200 shadow-2xs">
                    <IconComponent className="w-6 h-6 stroke-[2]" />
                  </div>

                  <h3 className="text-xs sm:text-sm font-bold text-[#172B4D] group-hover:text-[#1673E6] line-clamp-1 transition-colors">
                    {cat.name_uz}
                  </h3>

                  <div className="mt-1.5 flex items-center gap-1">
                    <span className="text-[11px] font-semibold text-[#5E6C84]">
                      {cat.active_count !== undefined && cat.active_count > 0
                        ? `${cat.active_count} ta e’lon`
                        : '0 ta e’lon'}
                    </span>
                    <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-[#1673E6] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoriesPage;
