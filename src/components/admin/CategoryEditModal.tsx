import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api.ts';
import { X, Layers, Save, Trash2, FolderPlus, GitBranch, Briefcase, Wrench } from 'lucide-react';

interface CategoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: any | null;
  defaultParentId?: string | null;
  defaultCatalogId?: string;
  parentCategories?: any[];
  onSaved: () => void;
}

export const CategoryEditModal: React.FC<CategoryEditModalProps> = ({
  isOpen,
  onClose,
  category,
  defaultParentId = null,
  defaultCatalogId = 'services',
  parentCategories = [],
  onSaved,
}) => {
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
      alert('Kategoriya nomi kiritilishi shart');
      return;
    }

    if (isSubcategory && !parentId) {
      alert('Subkategoriya uchun asosiy ota kategoriyani tanlang');
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
      alert(err.message || 'Xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!category?.id) return;
    const typeLabel = category.parent_id ? 'subkategoriyasini' : 'kategoriyasini va uning barcha subkategoriyalarini';
    if (!confirm(`Haqiqatan ham "${category.name_uz}" ${typeLabel} o‘chirmoqchimisiz?`)) return;

    setIsSubmitting(true);
    try {
      await apiRequest(`/api/admin/categories/${category.id}`, { method: 'DELETE' });
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message || 'O‘chirishda xatolik yuz berdi');
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
                  ? `${isSubcategory ? 'Subkategoriya' : 'Asosiy kategoriya'}ni tahrirlash`
                  : `${isSubcategory ? 'Yangi subkategoriya' : 'Yangi asosiy kategoriya'} qo‘shish`}
              </h3>
              <p className="text-xs text-gray-500">Katalog va e’lonlar strukturasi boshqaruvi</p>
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
              <label className="font-bold text-gray-700 block mb-1.5">Kategoriya darajasi</label>
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
                    <p className="leading-none">Asosiy kategoriya</p>
                    <span className="text-[10px] font-normal text-gray-400">Mustaqil katta bo‘lim</span>
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
                    <p className="leading-none">Subkategoriya</p>
                    <span className="text-[10px] font-normal text-gray-400">Kategoriya ichidagi yo‘nalish</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Catalog selector */}
          <div>
            <label className="font-bold text-gray-700 block mb-1.5">Tegishli Katalog *</label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                  catalogId === 'services'
                    ? 'border-blue-600 bg-blue-50/40 text-blue-700 font-bold'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="catalog"
                  value="services"
                  checked={catalogId === 'services'}
                  onChange={() => setCatalogId('services')}
                  className="sr-only"
                />
                <Wrench className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Xizmatlar katalogi</span>
              </label>

              <label
                className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                  catalogId === 'jobs'
                    ? 'border-blue-600 bg-blue-50/40 text-blue-700 font-bold'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="catalog"
                  value="jobs"
                  checked={catalogId === 'jobs'}
                  onChange={() => setCatalogId('jobs')}
                  className="sr-only"
                />
                <Briefcase className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Ish va Vakansiyalar</span>
              </label>
            </div>
          </div>

          {/* Parent category selector (if subcategory) */}
          {isSubcategory && (
            <div>
              <label className="font-bold text-gray-700 block mb-1">
                Asosiy ota kategoriya <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:outline-hidden focus:border-blue-600"
              >
                <option value="">-- Ota kategoriyani tanlang --</option>
                {parentCategories.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name_uz} ({p.catalog_id === 'jobs' ? 'Ish' : 'Xizmat'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Name (UZ) */}
          <div>
            <label className="font-bold text-gray-700 block mb-1">
              {isSubcategory ? 'Subkategoriya nomi' : 'Kategoriya nomi'} (UZ) <span className="text-rose-500">*</span>
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
              placeholder={isSubcategory ? 'Masalan: Kran va quvurlar montaji' : 'Masalan: Santexnika xizmatlari'}
            />
          </div>

          {/* Slug */}
          <div>
            <label className="font-bold text-gray-700 block mb-1">
              Slug (URL identifikator) <span className="text-rose-500">*</span>
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
              <label className="font-bold text-gray-700 block mb-1">Ikonka (Lucide icon yoki Emoji)</label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium"
                placeholder={isSubcategory ? 'Layers' : 'Wrench yoki 🔧'}
              />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Tartib raqami</label>
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
            <label className="font-bold text-gray-700 block mb-1">Holati</label>
            <select
              value={isActive}
              onChange={(e) => setIsActive(Number(e.target.value))}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold"
            >
              <option value={1}>Faol (Platformada e’lonlar va filtrlarda ko‘rsatiladi)</option>
              <option value={0}>Nofaol (Yashiringan)</option>
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
                <span>O‘chirish</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-200 font-semibold hover:bg-gray-50 cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isEditing ? 'Saqlash' : 'Qo‘shish'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
