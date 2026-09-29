import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Wrench,
  Search,
  FileText,
  Hammer,
  Zap,
  Code,
  Sparkles,
  LayoutGrid,
} from 'lucide-react';

interface CategoryNavProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  className?: string;
}

interface NavItem {
  id: string;
  label: string;
  route: string;
  badge?: string;
}

export const CategoryNav: React.FC<CategoryNavProps> = ({
  currentRoute,
  onNavigate,
  className = '',
}) => {
  const [categories, setCategories] = useState<{ id: string; name_uz: string; active_count?: number }[]>([]);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data);
        }
      })
      .catch(() => {});
  }, []);

  // Main Listing Types for filtered Home Page views
  const primaryTypeItems: NavItem[] = [
    { id: 'all', label: 'Barchasi', route: '/' },
    { id: 'SERVICE_OFFER', label: 'Xizmatlar', route: '/?type=SERVICE_OFFER' },
    { id: 'JOB_OPENING', label: 'Ish e’lonlari', route: '/?type=JOB_OPENING' },
    { id: 'SERVICE_REQUEST', label: 'Buyurtmalar', route: '/?type=SERVICE_REQUEST' },
    { id: 'JOB_SEEKER', label: 'Rezyumelar', route: '/?type=JOB_SEEKER' },
  ];

  // Specific domain category items
  const categoryItems: NavItem[] = categories.map((cat) => ({
    id: cat.id,
    label: cat.name_uz,
    route: `/?category=${cat.id}`,
    badge: cat.active_count && cat.active_count > 0 ? `${cat.active_count}` : undefined,
  }));

  const allItems = [...primaryTypeItems, ...categoryItems];

  const isItemActive = (item: NavItem) => {
    if (item.id === 'all') {
      return currentRoute === '/' || currentRoute === '';
    }
    return currentRoute === item.route;
  };

  return (
    <nav
      aria-label="Kategoriyalar bo‘yicha tezkor o‘tish"
      className={`w-full border-t border-[#EBECF0] bg-[#F9FAFB]/95 backdrop-blur-xs px-3 py-2 overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-1.5 ${className}`}
    >
      {allItems.map((item) => {
        const active = isItemActive(item);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.route)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
              active
                ? 'bg-[#1673E6] text-white shadow-2xs ring-2 ring-blue-500/20'
                : 'bg-white text-[#172B4D] hover:bg-gray-100 hover:text-blue-600 border border-[#EBECF0]'
            }`}
          >
            <span>{item.label}</span>
            {item.badge && (
              <span
                className={`text-[10px] px-1 rounded-full font-medium ${
                  active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
