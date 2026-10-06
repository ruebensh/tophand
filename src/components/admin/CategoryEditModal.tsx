import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api.ts';
import { X, Layers, Save, Trash2, GitBranch } from 'lucide-react';
import { CategoryChip } from '../common/CategoryIcon.tsx';
import type { Catalog } from '../../types/index.ts';
import { useI18n } from '../../i18n/IntlContext.tsx';

// Katalog bo'yicha barqaror rang toni (Header/AdminDashboard bilan mos).
const CAT_TONE: Record<string, string> = {
  transport: 'blue', realty: 'amber', jobs: 'violet', services: 'teal',
  personal: 'rose', 'home-dacha': 'orange', parts: 'cyan', electronics: 'indigo',
  hobby: 'lime', animals: 'emerald', business: 'sky', business360: 'fuchsia', handmade: 'red',
};

// Kataloglar API yuklanmaganda ishlatiladigan zaxira ro'yxat.
const FALLBACK_CATALOGS: Catalog[] = [
  { id: 'services', name_uz: 'Xizmatlar', slug: 'xizmatlar', icon: 'Wrench', listing_types: '', sort_order: 0, is_active: 1 },
  { id: 'jobs', name_uz: 'Ish e’lonlari', slug: 'ish-elonlari', icon: 'Briefcase', listing_types: '', sort_order: 0, is_active: 1 },
];

interface CategoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: any | null;
  defaultParentId?: string | null;
  defaultCatalogId?: string;
  parentCategories?: any[];
  catalogs?: Catalog[];
  onSaved: () => void;
}

export const CategoryEditModal: React.FC<CategoryEditModalProps> = ({
  isOpen,
  onClose,
  category,
  defaultParentId = null,
  defaultCatalogId = 'services',
  parentCategories = [],
  catalogs = [],
  onSaved,
}) => {
  const { t } = useI18n();
  const catalogOptions = catalogs.length > 0 ? catalogs : FALLBACK_CATALOGS;
  const isEditing = Boolean(category?.id);
  const [isSubcategory, setIsSubcategory] = useState<boolean>(false);
  const [parentId, setParentId] = useState<string>('');
  const [catalogId, setCatalogId] = useState<string>('services');
  const [nameUz, setNameUz] = useState('');
  const [slug, setSlug] = useState('');
  const [icon, setIcon] = useState('Briefcase');
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (category) {
      setNameUz(category.name_uz || '');
      setSlug(category.slug || '');
      setIcon(category.icon || (category.parent_id ? 'Layers' : 'Briefcase'));
      setSortOrder(category.sort_order || 0);
      setIsActive(category.is_active !== undefined ? category.is_active : 1);
      setCatalogId(category.catalog_id || 'services');
      const hasParent = Boolean(category.parent_id);
      setIsSubcategory(hasParent);
      setParentId(category.parent_id || '');
    } else {
      setNameUz('');
      setSlug('');
      setSortOrder(0);
      setIsActive(1);
      setCatalogId(defaultCatalogId || 'services');
      if (defaultParentId) {
        setIsSubcategory(true);
        setParentId(defaultParentId);
        setIcon('Layers');
      } else {
        setIsSubcategory(false);
        setParentId('');
        setIcon('Briefcase');
      }
    }
  }, [category, defaultParentId, defaultCatalogId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameUz.trim()) {
      alert(t('admin.cemNameRequired'));
      return;
    }

    if (isSubcategory && !parentId) {
      alert(t('admin.cemParentRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      const generatedSlug = slug.trim() || nameUz.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      const payload: any = {
        name_uz: nameUz.trim(),
        slug: generatedSlug,
        icon: icon.trim() || (isSubcategory ? 'Layers' : 'Briefcase'),
        catalog_id: catalogId,
        parent_id: isSubcategory ? parentId : null,
        sort_order: sortOrder,
        is_active: isActive,
      };

      if (category?.id) {
        await apiRequest(`/api/admin/categories/${category.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message || t('common.errGeneric'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!category?.id) return;
    const labelKey = category.parent_id ? 'admin.delLabelSub' : 'admin.delLabelParent';
    if (!confirm(t('admin.catDeleteConfirm', { name: category.name_uz, label: t(labelKey) }))) return;

    setIsSubmitting(true);
    try {
      await apiRequest(`/api/admin/categories/${category.id}`, { method: 'DELETE' });
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message || t('admin.deleteErrFull'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              {isSubcategory ? <GitBranch className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-base text-gray-950">
                {isEditing
                  ? (isSubcategory ? t('admin.editSub') : t('admin.cemEditMain'))
                  : (isSubcategory ? t('admin.cemAddSub') : t('admin.cemAddMain'))}
              </h3>
              <p className="text-xs text-gray-500">{t('admin.cemSub')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-white/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Category Type Switch (Only when creating new) */}
          {!isEditing && (
            <div>
              <label className="font-bold text-gray-700 block mb-1.5">{t('admin.cemLevelLabel')}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSubcategory(false);
                    setParentId('');
                    setIcon('Briefcase');
                  }}
                  className={`p-3 rounded-2xl border flex items-center gap-2.5 font-bold transition-all cursor-pointer ${
                    !isSubcategory
                      ? 'border-blue-600 bg-blue-50/60 text-blue-700 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <Layers className="w-4 h-4 shrink-0" />
                  <div className="text-left">
                    <p className="leading-none">{t('admin.cemMainWord')}</p>
                    <span className="text-[10px] font-normal text-gray-400">{t('admin.cemMainHint')}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSubcategory(true);
                    if (!parentId && parentCategories.length > 0) {
                      setParentId(parentCategories[0].id);
                    }
                    setIcon('Layers');
                  }}
                  className={`p-3 rounded-2xl border flex items-center gap-2.5 font-bold transition-all cursor-pointer ${
                    isSubcategory
                      ? 'border-blue-600 bg-blue-50/60 text-blue-700 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <GitBranch className="w-4 h-4 shrink-0" />
                  <div className="text-left">
                    <p className="leading-none">{t('admin.cemSubWord')}</p>
                    <span className="text-[10px] font-normal text-gray-400">{t('admin.cemSubHint')}</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Catalog selector — barcha 13 katalog */}
          <div>
            <label className="font-bold text-gray-700 block mb-1.5">{t('admin.cemCatalogLabel')} *</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {catalogOptions.map((c) => {
                const active = catalogId === c.id;
                return (
                  <label
                    key={c.id}
                    className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      active
                        ? 'border-blue-600 bg-blue-50/40 text-blue-800 font-bold'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="catalog"
                      value={c.id}
                      checked={active}
                      onChange={() => {
                        setCatalogId(c.id);
                        setParentId(''); // katalog o'zgarganda ota kategoriyani tozalash
                      }}
                      className="sr-only"
                    />
                    <CategoryChip name={c.icon} size="sm" tone={CAT_TONE[c.id]} className="w-7 h-7 shrink-0" />
                    <span className="text-xs truncate">{c.name_uz}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Parent category selector (if subcategory) */}
          {isSubcategory && (
            <div>
              <label className="font-bold text-gray-700 block mb-1">
                {t('admin.cemParentLabel')} <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:outline-hidden focus:border-blue-600"
              >
                <option value="">{t('admin.cemParentPh')}</option>
                {parentCategories
                  .filter((p) => (p.catalog_id || 'services') === catalogId)
                  .map((p) => {
                    const scope = p.scope === 'JOB_OPENING' ? ' · ' + t('admin.scopeVacancy') : p.scope === 'JOB_SEEKER' ? ' · ' + t('admin.scopeResume') : '';
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name_uz}
                        {scope}
                      </option>
                    );
                  })}
              </select>
              <p className="text-[10px] text-gray-400 mt-1">
                {t('admin.cemParentHint')}
              </p>
            </div>
          )}

          {/* Name (UZ) */}
          <div>
            <label className="font-bold text-gray-700 block mb-1">
              {isSubcategory ? t('admin.cemSubNameLabel') : t('admin.cemNameLabel')} (UZ) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nameUz}
              onChange={(e) => {
                setNameUz(e.target.value);
                if (!isEditing) {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'));
                }
              }}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 focus:outline-hidden focus:border-blue-600"
              placeholder={isSubcategory ? t('admin.cemSubNamePh') : t('admin.cemNamePh')}
            />
          </div>

          {/* Slug */}
          <div>
            <label className="font-bold text-gray-700 block mb-1">
              {t('admin.cemSlugLabel')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={isEditing}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-gray-800 disabled:opacity-60"
              placeholder="santexnika-montaji"
            />
          </div>

          {/* Icon & Sort order */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-gray-700 block mb-1">{t('admin.cemIconLabel')}</label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium"
                placeholder={isSubcategory ? 'Layers' : t('admin.cemIconPh')}
              />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">{t('admin.cemSortLabel')}</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="font-bold text-gray-700 block mb-1">{t('admin.thState')}</label>
            <select
              value={isActive}
              onChange={(e) => setIsActive(Number(e.target.value))}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold"
            >
              <option value={1}>{t('admin.cemActiveOpt')}</option>
              <option value={0}>{t('admin.cemInactiveOpt')}</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('common.delete')}</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-200 font-semibold hover:bg-gray-50 cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isEditing ? t('common.save') : t('common.add')}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
