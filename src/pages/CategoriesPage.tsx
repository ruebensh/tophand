import React, { useState, useEffect, useMemo } from 'react';
import { Category } from '../types/index.ts';
import { apiRequest } from '../lib/api.ts';
import { CategoryIcon } from '../components/common/CategoryIcon.tsx';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { CATEGORIES_CATALOG } from '../../server/db/categoriesData.ts';

interface CategoriesPageProps {
  onNavigate: (route: string) => void;
  onSelectCategory?: (categoryId: string) => void;
}

export const CategoriesPage: React.FC<CategoriesPageProps> = ({
  onNavigate,
  onSelectCategory,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    setIsLoading(true);
    apiRequest<Category[]>('/api/categories')
      .then((data) => setCategories(data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleCategoryClick = (catId: string) => {
    if (onSelectCategory) {
      onSelectCategory(catId);
    } else {
      onNavigate(`/?category=${catId}`);
    }
  };

  // Build parent+subs map from API data
  const { parents, subsByParent } = useMemo(() => {
    const parents: Category[] = [];
    const subsByParent: Record<string, Category[]> = {};
    categories.forEach((cat) => {
      if (!cat.parent_id) parents.push(cat);
      else {
        if (!subsByParent[cat.parent_id]) subsByParent[cat.parent_id] = [];
        subsByParent[cat.parent_id].push(cat);
      }
    });
    parents.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    Object.values(subsByParent).forEach((list) =>
      list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    );
    return { parents, subsByParent };
  }, [categories]);

  // Search: match across parent and sub names
  const searchResults = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return null;
    const hits: { parentId: string; parentName: string; parentIcon: string; matchedSubs: Category[]; selfMatch: boolean }[] = [];
    parents.forEach((parent) => {
      const subs = subsByParent[parent.id] || [];
      const selfMatch = parent.name_uz.toLowerCase().includes(q);
      const matchedSubs = subs.filter((s) => s.name_uz.toLowerCase().includes(q));
      if (selfMatch || matchedSubs.length > 0) {
        hits.push({ parentId: parent.id, parentName: parent.name_uz, parentIcon: parent.icon, matchedSubs: selfMatch ? subs : matchedSubs, selfMatch });
      }
    });
    return hits;
  }, [searchTerm, parents, subsByParent]);

  const displayGroups = searchResults !== null ? searchResults : parents.map((p) => ({
    parentId: p.id,
    parentName: p.name_uz,
    parentIcon: p.icon,
    matchedSubs: subsByParent[p.id] || [],
    selfMatch: true,
  }));

  return (
    <div className="min-h-[calc(100vh-140px)] bg-white pb-24 sm:pb-16">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
            <button
              onClick={() => onNavigate('/')}
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              Asosiy
            </button>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-semibold text-gray-800">Xizmatlar</span>
          </div>

          {/* Title row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              Xizmatlar
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </h1>

            {/* Search */}
            <div className="relative sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Kategoriya qidirish..."
                className="w-full pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
        {isLoading ? (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-8 space-y-8">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="break-inside-avoid mb-8 space-y-2">
                <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4" />
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-3.5 bg-gray-100 rounded animate-pulse w-2/3" />
                ))}
              </div>
            ))}
          </div>
        ) : displayGroups.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">"{searchTerm}" bo'yicha kategoriya topilmadi</p>
            <button
              onClick={() => setSearchTerm('')}
              className="mt-3 text-blue-600 text-sm font-medium cursor-pointer hover:underline"
            >
              Tozalash
            </button>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-x-10 gap-y-2">
            {displayGroups.map(({ parentId, parentName, parentIcon, matchedSubs }) => (
              <div key={parentId} className="break-inside-avoid mb-7">
                {/* Parent category title */}
                <button
                  onClick={() => handleCategoryClick(parentId)}
                  className="group flex items-center gap-1 mb-2 cursor-pointer text-left w-full"
                >
                  <span className="font-bold text-[15px] text-gray-900 group-hover:text-blue-700 transition-colors leading-tight">
                    {parentName}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-700 shrink-0 transition-colors" />
                </button>

                {/* Subcategories */}
                <ul className="space-y-1">
                  {matchedSubs.map((sub) => (
                    <li key={sub.id}>
                      <button
                        onClick={() => handleCategoryClick(sub.id)}
                        className="text-[13px] text-gray-600 hover:text-blue-700 transition-colors cursor-pointer text-left leading-snug w-full"
                      >
                        {sub.name_uz}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoriesPage;
