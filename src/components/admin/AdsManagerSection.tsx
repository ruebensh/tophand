import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Image as ImageIcon,
  Type as TypeIcon,
  Video as VideoIcon,
  Upload,
  Eye,
  MousePointerClick,
} from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import {
  adminListAds,
  adminCreateAd,
  adminUpdateAd,
  adminDeleteAd,
  uploadImageFile,
  uploadVideoFile,
} from '../../lib/api.ts';
import { useAds } from '../../context/AdsContext.tsx';
import type { AdCampaign, AdType, AdPlacement } from '../../types/index.ts';
import { useI18n } from '../../i18n/IntlContext.tsx';

const inputCls =
  'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-[11px] font-bold text-gray-700 mb-1';

const TYPE_OPTIONS: { id: AdType; labelKey: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'image', labelKey: 'admin.amsTypeImage', icon: ImageIcon },
  { id: 'text', labelKey: 'admin.amsTypeText', icon: TypeIcon },
  { id: 'video', labelKey: 'admin.amsTypeVideo', icon: VideoIcon },
];

const PLACEMENT_OPTIONS: { id: AdPlacement; labelKey: string }[] = [
  { id: 'top', labelKey: 'admin.amsPlTop' },
  { id: 'popular', labelKey: 'admin.amsPlPopular' },
  { id: 'inline', labelKey: 'admin.amsPlInline' },
  { id: 'sidebar', labelKey: 'admin.amsPlSidebar' },
  { id: 'all', labelKey: 'admin.amsPlAll' },
];

const placementLabel = (p: AdPlacement) =>
  PLACEMENT_OPTIONS.find((o) => o.id === p)?.labelKey || p;

// ISO → <input type="datetime-local"> qiymati (mahalliy vaqt).
function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

interface Draft {
  id?: string;
  type: AdType;
  title: string;
  body: string;
  image_url: string;
  video_url: string;
  link_url: string;
  cta_label: string;
  placement: AdPlacement;
  active: boolean;
  priority: number;
  starts_at: string;
  ends_at: string;
}

const emptyDraft = (): Draft => ({
  type: 'image',
  title: '',
  body: '',
  image_url: '',
  video_url: '',
  link_url: '',
  cta_label: 'Batafsil',
  placement: 'top',
  active: true,
  priority: 0,
  starts_at: '',
  ends_at: '',
});

const toDraft = (ad: AdCampaign): Draft => ({
  id: ad.id,
  type: ad.type,
  title: ad.title,
  body: ad.body || '',
  image_url: ad.image_url || '',
  video_url: ad.video_url || '',
  link_url: ad.link_url,
  cta_label: ad.cta_label || 'Batafsil',
  placement: ad.placement,
  active: Boolean(ad.active),
  priority: ad.priority ?? 0,
  starts_at: toLocalInput(ad.starts_at),
  ends_at: toLocalInput(ad.ends_at),
});

export const AdsManagerSection: React.FC = () => {
  const { t } = useI18n();
  const { refresh } = useAds();
  const [ads, setAds] = useState<AdCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState<'image' | 'video' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fetchAds = useCallback(async () => {
    setIsLoading(true);
    try {
      setAds(await adminListAds());
    } catch (e: any) {
      setErr(e.message || t('admin.mnsLoadErr'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  const openCreate = () => {
    setDraft(emptyDraft());
    setErr(null);
    setModalOpen(true);
  };

  const openEdit = (ad: AdCampaign) => {
    setDraft(toDraft(ad));
    setErr(null);
    setModalOpen(true);
  };

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const handleImage = async (file?: File) => {
    if (!file) return;
    setUploading('image');
    setErr(null);
    try {
      const url = await uploadImageFile(file, 'ads');
      patch({ image_url: url });
    } catch (e: any) {
      setErr(e.message || t('admin.thsImgErr'));
    } finally {
      setUploading(null);
    }
  };

  const handleVideo = async (file?: File) => {
    if (!file) return;
    setUploading('video');
    setErr(null);
    try {
      const url = await uploadVideoFile(file);
      patch({ video_url: url });
    } catch (e: any) {
      setErr(e.message || t('admin.amsVideoErr'));
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    // Frontend validatsiya (backend ham tekshiradi).
    if (!draft.title.trim()) return setErr(t('admin.amsTitleReq'));
    if (!draft.link_url.trim()) return setErr(t('admin.amsLinkReq'));
    if (draft.type === 'image' && !draft.image_url) return setErr(t('admin.amsNeedImage'));
    if (draft.type === 'video' && !draft.video_url) return setErr(t('admin.amsNeedVideo'));

    setIsSaving(true);
    setErr(null);
    const payload: Partial<AdCampaign> = {
      type: draft.type,
      title: draft.title.trim(),
      body: draft.body.trim() || null,
      image_url: draft.image_url || null,
      video_url: draft.video_url || null,
      link_url: draft.link_url.trim(),
      cta_label: draft.cta_label.trim() || 'Batafsil',
      placement: draft.placement,
      active: draft.active ? 1 : 0,
      priority: Number(draft.priority) || 0,
      starts_at: draft.starts_at || null,
      ends_at: draft.ends_at || null,
    };
    try {
      if (draft.id) await adminUpdateAd(draft.id, payload);
      else await adminCreateAd(payload);
      await fetchAds();
      await refresh(); // saytdagi reklama real vaqtda yangilanadi
      setModalOpen(false);
    } catch (e: any) {
      setErr(e.message || t('admin.mnsSaveErr'));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (ad: AdCampaign) => {
    try {
      await adminUpdateAd(ad.id, { active: ad.active ? 0 : 1 });
      setAds((prev) => prev.map((a) => (a.id === ad.id ? { ...a, active: a.active ? 0 : 1 } : a)));
      await refresh();
    } catch (e: any) {
      setErr(e.message || t('admin.amsToggleErr'));
    }
  };

  const handleDelete = async (ad: AdCampaign) => {
    if (!window.confirm(t('admin.amsDeleteConfirm', { title: ad.title }))) return;
    try {
      await adminDeleteAd(ad.id);
      setAds((prev) => prev.filter((a) => a.id !== ad.id));
      await refresh();
    } catch (e: any) {
      setErr(e.message || t('admin.amsDeleteErr'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-blue-600" />
            <h3 className="font-black text-sm text-gray-900">{t('admin.amsTitle')}</h3>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> {t('admin.amsNewAd')}
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <p className="text-[11px] text-gray-500 mb-4">
            {t('admin.amsHelper')}
          </p>

          {err && !modalOpen && (
            <div className="mb-4 p-3 rounded-2xl text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700">
              {err}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> {t('admin.amsLoading')}
            </div>
          ) : ads.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto mb-3">
                <Megaphone className="w-7 h-7" />
              </div>
              <p className="font-bold text-sm text-gray-800">{t('admin.amsEmpty')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('admin.amsEmptyHint')}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {ads.map((ad) => (
                <div
                  key={ad.id}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 bg-gray-50/40 hover:bg-gray-50 transition-colors"
                >
                  {/* Preview */}
                  <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-white border border-gray-100 flex items-center justify-center text-gray-300">
                    {ad.type === 'image' && ad.image_url ? (
                      <img src={ad.image_url} alt="" className="w-full h-full object-cover" />
                    ) : ad.type === 'video' ? (
                      <VideoIcon className="w-5 h-5 text-gray-400" />
                    ) : ad.type === 'image' ? (
                      <ImageIcon className="w-5 h-5 text-gray-400" />
                    ) : (
                      <TypeIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-900 truncate max-w-[240px]">{ad.title}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600">
                        {t(placementLabel(ad.placement))}
                      </span>
                      {!ad.active && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-200 text-gray-600">
                          {t('admin.amsOff')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {ad.impressions}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MousePointerClick className="w-3 h-3" /> {ad.clicks}
                      </span>
                      <span>{t('admin.amsPriorityLabel')} {ad.priority}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleActive(ad)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        ad.active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {ad.active ? t('admin.amsOn') : t('admin.amsOff')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(ad)}
                      className="p-2 rounded-lg text-gray-500 hover:bg-white hover:text-blue-600 transition-colors cursor-pointer"
                      title={t('common.edit')}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(ad)}
                      className="p-2 rounded-lg text-gray-500 hover:bg-white hover:text-rose-600 transition-colors cursor-pointer"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => (isSaving ? null : setModalOpen(false))}
        size="lg"
        padded={false}
        header={
          <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-gray-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-base text-gray-950">
                {draft.id ? t('admin.amsEditTitle') : t('admin.amsNewAd')}
              </h3>
            </div>
            <button
              onClick={() => setModalOpen(false)}
              className="w-9 h-9 -mr-1 rounded-full flex items-center justify-center text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              aria-label={t('admin.amsClose')}
            >
              <X className="w-[18px] h-[18px]" strokeWidth={2.2} />
            </button>
          </div>
        }
      >
        <div className="p-5 sm:p-6 space-y-4">
          {err && (
            <div className="p-3 rounded-2xl text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700">
              {err}
            </div>
          )}

          {/* Type */}
          <div>
            <span className={labelCls}>{t('admin.amsAdType')}</span>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const on = draft.type === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patch({ type: opt.id })}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      on ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {t(opt.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title + body */}
          <div>
            <label className={labelCls}>{t('admin.amsTitleField')}</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder={t('admin.amsTitlePh')}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t('admin.amsDescField')}</label>
            <textarea
              value={draft.body}
              onChange={(e) => patch({ body: e.target.value })}
              rows={2}
              placeholder={t('admin.amsDescPh')}
              className={inputCls}
            />
          </div>

          {/* Media */}
          {draft.type === 'image' && (
            <MediaField
              label={t('admin.amsTypeImage')}
              value={draft.image_url}
              uploading={uploading === 'image'}
              accept="image/*"
              onUpload={(f) => handleImage(f)}
              onClear={() => patch({ image_url: '' })}
              preview={
                draft.image_url ? (
                  <img src={draft.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-gray-300" />
                )
              }
            />
          )}

          {draft.type === 'video' && (
            <div className="space-y-3">
              <MediaField
                label={t('admin.amsVideoLabel')}
                value={draft.video_url}
                uploading={uploading === 'video'}
                accept="video/mp4,video/webm"
                onUpload={(f) => handleVideo(f)}
                onClear={() => patch({ video_url: '' })}
                preview={<VideoIcon className="w-6 h-6 text-gray-300" />}
              />
              <div>
                <label className={labelCls}>{t('admin.amsVideoOrUrl')}</label>
                <input
                  type="text"
                  value={draft.video_url}
                  onChange={(e) => patch({ video_url: e.target.value })}
                  placeholder="https://youtube.com/watch?v=... yoki https://.../clip.mp4"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* Link + CTA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>{t('admin.amsLinkField')}</label>
              <input
                type="text"
                value={draft.link_url}
                onChange={(e) => patch({ link_url: e.target.value })}
                placeholder="/listing/... yoki https://..."
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t('admin.amsCtaField')}</label>
              <input
                type="text"
                value={draft.cta_label}
                onChange={(e) => patch({ cta_label: e.target.value })}
                placeholder="Batafsil"
                className={inputCls}
              />
            </div>
          </div>

          {/* Placement + priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('admin.amsPlacement')}</label>
              <select
                value={draft.placement}
                onChange={(e) => patch({ placement: e.target.value as AdPlacement })}
                className={inputCls}
              >
                {PLACEMENT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {t(o.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('admin.amsPriorityField')}</label>
              <input
                type="number"
                value={draft.priority}
                onChange={(e) => patch({ priority: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
          </div>

          {/* Dates + active */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('admin.amsStartField')}</label>
              <input
                type="datetime-local"
                value={draft.starts_at}
                onChange={(e) => patch({ starts_at: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t('admin.amsEndField')}</label>
              <input
                type="datetime-local"
                value={draft.ends_at}
                onChange={(e) => patch({ ends_at: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          <label className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/70 border border-gray-100 cursor-pointer">
            <span className="text-xs font-bold text-gray-800">{t('admin.amsActiveLabel')}</span>
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => patch({ active: e.target.checked })}
              className="w-4 h-4 accent-blue-600"
            />
          </label>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-gray-100 bg-white">
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            disabled={isSaving}
            className="px-4 py-2 rounded-full text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('common.save')}
          </button>
        </div>
      </Modal>
    </div>
  );
};

// Kichik upload maydoni (rasm/video uchun umumiy).
const MediaField: React.FC<{
  label: string;
  value: string;
  uploading: boolean;
  accept: string;
  onUpload: (file?: File) => void;
  onClear: () => void;
  preview: React.ReactNode;
}> = ({ label, value, uploading, accept, onUpload, onClear, preview }) => {
  const { t } = useI18n();
  return (
  <div>
    <label className={labelCls}>{label}</label>
    <div className="flex items-center gap-3">
      <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center">
        {preview}
      </div>
      <div className="flex-1 min-w-0">
        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 cursor-pointer">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? t('admin.amsUploading') : t('admin.amsChooseFile')}
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => onUpload(e.target.files?.[0])}
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="ml-2 text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
          >
            {t('admin.amsClear')}
          </button>
        )}
      </div>
    </div>
  </div>
  );
};

export default AdsManagerSection;
