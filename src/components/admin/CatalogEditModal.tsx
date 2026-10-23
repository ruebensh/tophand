import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest, uploadImageFile } from '../../lib/api.ts';
import { X, LayoutGrid, Save, Trash2, ImagePlus, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n/IntlContext.tsx';

// Katalog qo'shish/tahrirlash modali. Rasm PNG/JPG yuklanadi — server uni
// WebP'ga siqib public joyga (`/api/upload?folder=catalogs`) joylaydi.
interface CatalogEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: any | null;
  onSaved: () => void;
}

// E'lon turlari — katalog qaysi turdagi e'lonlarni qabul qilishini belgilaydi.
const LISTING_TYPE_OPTIONS = [
  'SERVICE_OFFER', 'SERVICE_REQUEST', 'SELL', 'WANTED',
  'RENT_OUT', 'RENT_WANTED', 'JOB_OPENING', 'JOB_SEEKER',
];

export const CatalogEditModal: React.FC<CatalogEditModalProps> = ({
  isOpen,
  onClose,
  catalog,
  onSaved,
}) => {
  const { t } = useI18n();
  const isEditing = Boolean(catalog?.id);
  const [nameUz, setNameUz] = useState('');
  const [slug, setSlug] = useState('');
  const [icon, setIcon] = useState('Briefcase');
  const [description, setDescription] = useState('');
  const [listingTypes, setListingTypes] = useState<string[]>(['SERVICE_OFFER', 'SERVICE_REQUEST']);
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState<number>(1);
  const [imageUrl, setImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (catalog) {
      setNameUz(catalog.name_uz || '');
      setSlug(catalog.slug || '');
      setIcon(catalog.icon || 'Briefcase');
      setDescription(catalog.description || '');
      setSortOrder(catalog.sort_order || 0);
      setIsActive(catalog.is_active !== undefined ? catalog.is_active : 1);
      setImageUrl(catalog.image_url || '');
      const types = typeof catalog.listing_types === 'string'
        ? catalog.listing_types.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];
      setListingTypes(types.length ? types : ['SERVICE_OFFER', 'SERVICE_REQUEST']);
    } else {
      setNameUz('');
      setSlug('');
      setIcon('Briefcase');
      setDescription('');
      setSortOrder(0);
      setIsActive(1);
      setImageUrl('');
      setListingTypes(['SERVICE_OFFER', 'SERVICE_REQUEST']);
    }
  }, [catalog, isOpen]);

  if (!isOpen) return null;

  const toggleType = (type: string) => {
    setListingTypes((prev) =>
      prev.includes(type) ? prev.filter((x) => x !== type) : [...prev, type]
    );
  };

  const handleImage = async (file?: File) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadImageFile(file, 'catalogs');
      setImageUrl(url);
    } catch (err: any) {
      alert(err.message || t('admin.cemImgErr'));
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameUz.trim()) {
      alert(t('admin.cemNameRequired'));
      return;
    }
    if (listingTypes.length === 0) {
      alert(t('admin.catmNeedType'));
      return;
    }

    setIsSubmitting(true);
    try {
      const generatedSlug = slug.trim() || nameUz.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      const payload: any = {
        name_uz: nameUz.trim(),
        slug: generatedSlug,
        icon: icon.trim() || 'Briefcase',
        description: description.trim(),
        listing_types: listingTypes.join(','),
        sort_order: sortOrder,
        is_active: isActive,
        image_url: imageUrl,
      };

      if (isEditing) {
        await apiRequest(`/api/catalogs/${catalog.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiRequest('/api/catalogs', { method: 'POST', body: JSON.stringify(payload) });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message || t('common.errGeneric'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-gray-950">
                {isEditing ? t('admin.catmEditTitle') : t('admin.catmAddTitle')}
              </h3>
              <p className="text-xs text-gray-500">{t('admin.catmSub')}</p>
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
          {/* Name (UZ) */}
          <div>
            <label className="font-bold text-gray-700 block mb-1">
              {t('admin.catmNameLabel')} (UZ) <span className="text-rose-500">*</span>
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
              placeholder={t('admin.catmNamePh')}
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
              placeholder="xizmatlar"
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
                placeholder="Briefcase"
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

          {/* Description */}
          <div>
            <label className="font-bold text-gray-700 block mb-1">{t('admin.catmDescLabel')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium resize-none"
              placeholder={t('admin.catmDescPh')}
            />
          </div>

          {/* Listing types */}
          <div>
            <label className="font-bold text-gray-700 block mb-1.5">{t('admin.catmTypesLabel')} *</label>
            <div className="flex flex-wrap gap-1.5">
              {LISTING_TYPE_OPTIONS.map((type) => {
                const active = listingTypes.includes(type);
                return (
                  <button
                    type="button"
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                      active
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Image */}
          <div>
            <label className="font-bold text-gray-700 block mb-1.5">{t('admin.cemImageLabel')}</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus className="w-6 h-6 text-gray-300" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={isUploading}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
                >
                  {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                  <span>{isUploading ? t('admin.cemImgUploading') : t('admin.cemImgPick')}</span>
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold cursor-pointer"
                  >
                    {t('common.delete')}
                  </button>
                )}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => handleImage(e.target.files?.[0])}
            />
            <p className="text-[10px] text-gray-400 mt-1">{t('admin.cemImgHint')}</p>
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
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
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
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isEditing ? t('common.save') : t('common.add')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
