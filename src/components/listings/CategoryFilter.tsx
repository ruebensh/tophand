import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Category } from '../../types/index.ts';
import { CategoryIcon } from '../common/CategoryIcon.tsx';
import { Check, ChevronRight, Layers, X } from 'lucide-react';
import { useI18n } from '../../i18n/IntlContext.tsx';

interface CategoryFilterProps {
  categories?: Category[];
  catalogId?: string;
  selectedCategoryId?: string;
  onSelectCategory: (categoryId?: string) => void;
  className?: string;
  onClose?: () => void;
}

interface FlyoutPos {
  top: number;
  left: number;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories: categoriesProp,
  catalogId,
  selectedCategoryId,
  onSelectCategory,
  className = '',
  onClose,
}) => {
  const { t, localized } = useI18n();
  const [internalCategories, setInternalCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredParentId, setHoveredParentId] = useState<string | null>(null);
  const [flyoutPos, setFlyoutPos] = useState<FlyoutPos>({ top: 0, left: 0 });

  const flyoutRef = useRef<HTMLDivElement>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Self-fetch if prop is empty
  useEffect(() => {
    if (categoriesProp && categoriesProp.length > 0) return;
    setIsLoading(true);
    const url = catalogId ? `/api/categories?catalog_id=${catalogId}` : '/api/categories';
    fetch(url)
      .then((r) => r.json())
      .then((data: Category[]) => {
        setInternalCategories(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [categoriesProp, catalogId]);

  const rawCategories =
    categoriesProp && categoriesProp.length > 0 ? categoriesProp : internalCategories;

  // Filter by catalogId if provided
  const categories = catalogId
    ? rawCategories.filter((c) => !c.catalog_id || c.catalog_id === catalogId)
    : rawCategories;

  // Build parent → subs map
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

  const hoveredParent = parents.find((p) => p.id === hoveredParentId) || null;
  const flyoutSubs = hoveredParentId ? subsByParent[hoveredParentId] || [] : [];

  const clearHide = useCallback(() => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
  }, []);

  const scheduleHide = useCallback(() => {
    hideTimeout.current = setTimeout(() => setHoveredParentId(null), 200);
  }, []);

  const handleParentEnter = useCallback(
    (parentId: string, e: React.MouseEvent<HTMLButtonElement>) => {
      clearHide();
      setHoveredParentId(parentId);

      // Use fixed position based on button's bounding rect
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setFlyoutPos({
        top: rect.top,
        left: rect.right + 8,
      });
    },
    [clearHide]
  );

  const handleSelect = (catId?: string) => {
    onSelectCategory(catId);
    setHoveredParentId(null);
    if (onClose) onClose();
  };

  // Find selected category display info
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const selectedParent = selectedCategory?.parent_id
    ? parents.find((p) => p.id === selectedCategory?.parent_id)
    : null;

  // Flyout panel rendered via Portal
  const flyoutPanel =
    hoveredParent && flyoutSubs.length > 0
      ? createPortal(
          <div
            ref={flyoutRef}
            onMouseEnter={clearHide}
            onMouseLeave={scheduleHide}
            style={{
              position: 'fixed',
              top: Math.min(flyoutPos.top, window.innerHeight - 400),
              left: flyoutPos.left,
              zIndex: 9999,
            }}
            className="w-72 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
              <CategoryIcon name={hoveredParent.icon} className="w-4 h-4 text-blue-600" />
              <button
                onClick={() => handleSelect(hoveredParent.id)}
                className="font-bold text-sm text-gray-900 hover:text-blue-700 cursor-pointer transition-colors flex-1 text-left"
              >
                {localized(hoveredParent)}
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            </div>

            {/* Barcha */}
            <div className="px-3 pt-2 pb-1">
              <button
                onClick={() => handleSelect(hoveredParent.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                  selectedCategoryId === hoveredParent.id
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-blue-600 hover:bg-blue-50 font-medium'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{t('home.allOf', { name: localized(hoveredParent) })}</span>
                {selectedCategoryId === hoveredParent.id && (
                  <Check className="w-3 h-3 ml-auto" />
                )}
              </button>
            </div>

            {/* Subcategories */}
            <div className="px-3 pb-3 flex flex-col gap-0.5 max-h-72 overflow-y-auto">
              {flyoutSubs.map((sub) => {
                const isSel = selectedCategoryId === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => handleSelect(sub.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[12.5px] flex items-center justify-between transition-colors cursor-pointer ${
                      isSel
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-blue-700'
                    }`}
                  >
                    <span className="truncate">{localized(sub)}</span>
                    {isSel && <Check className="w-3 h-3 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className={`flex flex-col w-full ${className}`}>
        {/* Selected indicator */}
        {selectedCategory && (
          <div className="flex items-center justify-between px-2 py-2 mb-2 bg-blue-50 border border-blue-200 rounded-xl text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <CategoryIcon
                name={selectedParent?.icon || selectedCategory.icon}
                className="w-3.5 h-3.5 text-blue-600 shrink-0"
              />
              <div className="min-w-0">
                {selectedParent && (
                  <span className="text-blue-500 text-[10px] block leading-tight">
                    {localized(selectedParent)}
                  </span>
                )}
                <span className="font-semibold text-blue-900 truncate block">
                  {localized(selectedCategory)}
                </span>
              </div>
            </div>
            <button
              onClick={() => handleSelect(undefined)}
              className="p-0.5 text-blue-400 hover:text-rose-500 shrink-0 cursor-pointer rounded transition-colors"
              title={t('common.clear')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Barcha kategoriyalar */}
        <button
          type="button"
          onClick={() => handleSelect(undefined)}
          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors cursor-pointer mb-1 ${
            !selectedCategoryId
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Layers
            className={`w-3.5 h-3.5 shrink-0 ${!selectedCategoryId ? 'text-white' : 'text-gray-400'}`}
          />
          <span>{t('nav.allCatalogs')}</span>
          {!selectedCategoryId && <Check className="w-3 h-3 ml-auto" />}
        </button>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col gap-1.5 mt-1">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-7 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {/* Parent list */}
        {!isLoading && (
          <div className="flex flex-col gap-0.5 mt-1">
            {parents.map((parent) => {
              const isSelected = selectedCategoryId === parent.id;
              const hasSelectedSub = (subsByParent[parent.id] || []).some(
                (s) => s.id === selectedCategoryId
              );
              const isHovered = hoveredParentId === parent.id;
              const hasSubs = (subsByParent[parent.id] || []).length > 0;

              return (
                <button
                  key={parent.id}
                  type="button"
                  onMouseEnter={(e) => handleParentEnter(parent.id, e)}
                  onMouseLeave={scheduleHide}
                  onClick={() => handleSelect(parent.id)}
                  className={`group w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : hasSelectedSub
                      ? 'bg-blue-50 text-blue-900 font-semibold border border-blue-200/60'
                      : isHovered
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <CategoryIcon
                    name={parent.icon}
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected
                        ? 'text-white'
                        : hasSelectedSub
                        ? 'text-blue-600'
                        : 'text-gray-400 group-hover:text-blue-600'
                    }`}
                  />
                  <span className="flex-1 truncate">{localized(parent)}</span>
                  {(isSelected || hasSelectedSub) && <Check className="w-3 h-3 shrink-0" />}
                  {hasSubs && !isSelected && !hasSelectedSub && (
                    <ChevronRight
                      className={`w-3 h-3 shrink-0 ${
                        isHovered ? 'text-blue-500' : 'text-gray-300'
                      } transition-colors`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Flyout via Portal — not clipped by sidebar overflow */}
      {flyoutPanel}
    </>
  );
};
