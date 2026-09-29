import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api.ts';
import { X, Layers, Save, Trash2 } from 'lucide-react';
import { Category } from '../../types/index.ts';

interface CategoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
  onSaved: () => void;
}

export const CategoryEditModal: React.FC<CategoryEditModalProps> = ({
  isOpen,
  onClose,
  category,
  onSaved,
}) => {
  const [nameUz, setNameUz] = useState('');
  const [slug, setSlug] = useState('');
  const [icon, setIcon] = useState('Briefcase');
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (category) {
      setNameUz(category.name_uz || '');
      setSlug(category.slug || '');
      setIcon(category.icon || 'Briefcase');
      setSortOrder(category.sort_order || 0);
      setIsActive(category.is_active !== undefined ? category.is_active : 1);
    } else {
      setNameUz('');
      setSlug('');
      setIcon('Briefcase');
      setSortOrder(0);
      setIsActive(1);
    }
  }, [category, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameUz.trim()) {
      alert('Kategoriya nomi kiritilishi shart');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name_uz: nameUz.trim(),
        slug: slug.trim() || nameUz.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        icon: icon.trim() || 'Briefcase',
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
    if (!confirm(`Haqiqatan ham "${category.name_uz}" kategoriyasini o‘chirmoqchimisiz?`)) return;

    setIsSubmitting(true);
    try {
      await apiRequest(`/api/admin/categories/${category.id}`, { method: 'DELETE' });
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message || 'O‘chirishda xatolik');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-gray-950">
                {category ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya qo‘shish'}
              </h3>
              <p className="text-xs text-gray-400">Admin boshqaruvi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="font-bold text-gray-700 block mb-1">Kategoriya nomi (UZ) *</label>
            <input
              type="text"
              required
              value={nameUz}
              onChange={(e) => {
                setNameUz(e.target.value);
                if (!category) {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                }
              }}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 focus:outline-hidden focus:border-blue-600"
              placeholder="Masalan: Logistika va Yetkazib berish"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">Slug (URL identifikator) *</label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={Boolean(category)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-gray-800 disabled:opacity-60"
              placeholder="logistika"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-gray-700 block mb-1">Ikonka / Emoji</label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
                placeholder="🚚 yoki Truck"
              />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Tartib raqami</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">Holati</label>
            <select
              value={isActive}
              onChange={(e) => setIsActive(Number(e.target.value))}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold"
            >
              <option value={1}>Faol (Ko‘rsatiladi)</option>
              <option value={0}>Nofaol (Yashirilgan)</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            {category ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-full text-rose-600 hover:bg-rose-50 border border-rose-200 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>O‘chirish</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full border border-gray-200 font-semibold"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{category ? 'Saqlash' : 'Qo‘shish'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
