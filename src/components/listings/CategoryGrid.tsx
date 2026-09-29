import React, { useState } from 'react';
import { Category } from '../../types/index.ts';
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
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  X,
  LucideIcon,
} from 'lucide-react';

interface CategoryGridProps {
  categories: Category[];
  selectedCategoryId?: string;
  onSelectCategory: (id?: string) => void;
  className?: string;
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

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  className = '',
}) => {
  // Mobile expand/collapse state: show top 6 or all categories
  const [isExpanded, setIsExpanded] = useState(false);

  // If a selected category is not in the first 6, ensure it's visible or expanded
  const selectedIndex = categories.findIndex((c) => c.id === selectedCategoryId);
  const shouldShowAll = isExpanded || (selectedIndex >= 6);

  const displayedCategories = shouldShowAll ? categories : categories.slice(0, 6);
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className={`w-full bg-[#F9FAFB] border border-[#EBECF0] rounded-2xl p-4 ${className}`}>
      {/* Header with Title and Clear Action */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#1673E6] flex items-center justify-center">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#172B4D] tracking-tight">Kategoriyalar</h2>
            <p className="text-[10px] text-[#5E6C84]">Mutaxassislik yoki xizmatni tanlang</p>
          </div>
        </div>

        {selectedCategory ? (
          <button
            onClick={() => onSelectCategory(undefined)}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#1673E6] hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
          >
            <span>Barchasi</span>
            <X className="w-3 h-3" />
          </button>
        ) : (
          <span className="text-[11px] font-medium text-[#5E6C84]">
            {categories.length} ta yo‘nalish
          </span>
        )}
      </div>

      {/* Categories Grid (Optimized for Mobile Phone Screens) */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {displayedCategories.map((cat) => {
          const IconComponent = ICON_MAP[cat.icon] || MoreHorizontal;
          const isSelected = selectedCategoryId === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(isSelected ? undefined : cat.id)}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all duration-150 cursor-pointer ${
                isSelected
                  ? 'bg-[#1673E6] text-white border-[#1673E6] shadow-sm ring-2 ring-blue-500/20'
                  : 'bg-white hover:bg-blue-50/50 text-[#172B4D] border-[#EBECF0] hover:border-blue-200'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center mb-1.5 transition-colors ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-blue-50 text-[#1673E6]'
                }`}
              >
                <IconComponent className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-semibold line-clamp-1 leading-tight">
                {cat.name_uz}
              </span>
              {cat.active_count !== undefined && cat.active_count > 0 ? (
                <span
                  className={`text-[9px] mt-0.5 font-medium ${
                    isSelected ? 'text-blue-100' : 'text-[#5E6C84]'
                  }`}
                >
                  {cat.active_count} ta
                </span>
              ) : (
                <span
                  className={`text-[9px] mt-0.5 ${
                    isSelected ? 'text-blue-100' : 'text-gray-400'
                  }`}
                >
                  0 ta
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Expand / Collapse Button for Mobile */}
      {categories.length > 6 && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2.5 w-full py-2 bg-white hover:bg-gray-50 border border-[#EBECF0] rounded-xl text-xs font-semibold text-[#1673E6] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          {shouldShowAll ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Kamroq ko‘rsatish</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Barcha kategoriyalarni ko‘rish ({categories.length})</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};
