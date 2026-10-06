import React, { useState, useEffect, useCallback } from 'react';
import { Save, Sparkles, Trash2, Plus, RotateCcw, Upload, Check, ImagePlus, X } from 'lucide-react';
import { apiRequest, uploadImageFile } from '../../lib/api.ts';
import { useTheme } from '../../context/ThemeContext.tsx';
import { DEFAULT_HOLIDAYS, type HolidayDef } from '../../lib/holidays.ts';
import { REGION_THEMES, type RegionTheme } from '../../lib/regionThemes.ts';
import { PATTERN_OPTIONS, EFFECT_OPTIONS, type PatternKey, type EffectKey } from '../../lib/themePatterns.ts';
import { useI18n } from '../../i18n/IntlContext.tsx';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

type Override = { type: 'holiday' | 'region' | 'none'; id?: string };

export const ThemeHolidaySection: React.FC = () => {
  const { t } = useI18n();
  const { setPreview, reload, regionThemesEnabled } = useTheme();

  const [holidays, setHolidays] = useState<HolidayDef[]>(DEFAULT_HOLIDAYS);
  const [regionOverrides, setRegionOverrides] = useState<Record<string, Partial<RegionTheme>>>({});
  const [regionNames, setRegionNames] = useState<Record<string, string>>({});
  const [serverOverride, setServerOverride] = useState<Override>({ type: 'none' });
  const [isStaff, setIsStaff] = useState(false);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const flash = (t: string) => {
    setMsg(t);
    setTimeout(() => setMsg(''), 2500);
  };

  // ── Load config ──
  const load = useCallback(async () => {
    try {
      const cfg = await apiRequest<{
        holidays?: HolidayDef[];
        regionThemes?: Record<string, Partial<RegionTheme>>;
        override?: Override | null;
      }>('/api/theme/config');
      if (Array.isArray(cfg.holidays) && cfg.holidays.length) setHolidays(cfg.holidays);
      if (cfg.regionThemes) setRegionOverrides(cfg.regionThemes);
      if (cfg.override) setServerOverride(cfg.override);
    } catch {
      /* defaults */
    }
    try {
      const regions = await apiRequest<{ id: string; name_uz: string }[]>('/api/locations/regions');
      const map: Record<string, string> = {};
      regions.forEach((r) => (map[r.id] = r.name_uz));
      setRegionNames(map);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    try {
      const me = JSON.parse(localStorage.getItem('th_dev_role') || 'null');
      setIsStaff(ADMIN_ROLES.includes(me));
    } catch {
      /* ignore */
    }
  }, [load]);

  // ── Holiday editing ──
  const updateHoliday = (idx: number, patch: Partial<HolidayDef>) => {
    setHolidays((prev) => prev.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  };
  const addHoliday = () => {
    setHolidays((prev) => [
      ...prev,
      { id: `custom_${Date.now()}`, name: 'Yangi bayram', month: 1, day: 1, accent: '#1673E6', accentSoft: '#EAF2FE', motif: '🎉', gradient: 'linear-gradient(135deg,#1673E6,#125FD0)', effect: 'sparkle', backgrounds: [] },
    ]);
  };
  const removeHoliday = (idx: number) => setHolidays((prev) => prev.filter((_, i) => i !== idx));

  const uploadHolidayBg = async (idx: number, file: File) => {
    setBusy(true);
    try {
      const url = await uploadImageFile(file);
      const h = holidays[idx];
      updateHoliday(idx, { backgrounds: [...(h.backgrounds || []), url] });
      flash(t('admin.thsBgAdded'));
    } catch (e: any) {
      flash(e.message || t('admin.thsImgErr'));
    } finally {
      setBusy(false);
    }
  };

  const saveHolidays = async () => {
    setBusy(true);
    try {
      await apiRequest('/api/theme/holidays', { method: 'PUT', body: JSON.stringify({ holidays }) });
      await reload();
      flash(t('admin.thsHolsSaved'));
    } catch (e: any) {
      flash(e.message || t('admin.mnsSaveErr'));
    } finally {
      setBusy(false);
    }
  };

  // ── Region theme editing ──
  const updateRegion = (id: string, patch: Partial<RegionTheme>) => {
    setRegionOverrides((prev) => {
      const cur = prev[id] || {};
      const merged = { ...cur, ...patch };
      if (patch.accent) merged.gradient = `linear-gradient(135deg, ${patch.accent}, ${patch.accent})`;
      return { ...prev, [id]: merged };
    });
  };
  const addRegionBg = async (id: string, file: File) => {
    setBusy(true);
    try {
      const url = await uploadImageFile(file);
      const cur = regionOverrides[id] || {};
      const list = cur.backgrounds || REGION_THEMES[id]?.backgrounds || [];
      const next = [...list, url];
      updateRegion(id, { backgrounds: next, hero_image_url: next[0] || '' });
      flash(t('admin.thsImgAdded'));
    } catch (e: any) {
      flash(e.message || t('admin.thsImgErr'));
    } finally {
      setBusy(false);
    }
  };
  const removeRegionBg = (id: string, idx: number) => {
    const cur = regionOverrides[id] || {};
    const list = [...(cur.backgrounds || REGION_THEMES[id]?.backgrounds || [])];
    list.splice(idx, 1);
    updateRegion(id, { backgrounds: list, hero_image_url: list[0] || '' });
  };
  const removeHolidayBg = (idx: number, bIdx: number) => {
    const h = holidays[idx];
    const list = [...(h.backgrounds || [])];
    list.splice(bIdx, 1);
    updateHoliday(idx, { backgrounds: list });
  };

  const saveRegions = async () => {
    setBusy(true);
    try {
      await apiRequest('/api/theme/region-themes', { method: 'PUT', body: JSON.stringify({ regionThemes: regionOverrides }) });
      await reload();
      flash(t('admin.thsRegionsSaved'));
    } catch (e: any) {
      flash(e.message || t('admin.mnsSaveErr'));
    } finally {
      setBusy(false);
    }
  };

  // ── Hudud (GPS) dizaynini yoqish / o'chirish ──
  const toggleRegionEnabled = async () => {
    setBusy(true);
    try {
      const next = !regionThemesEnabled;
      await apiRequest('/api/theme/region-themes/enabled', { method: 'PUT', body: JSON.stringify({ enabled: next }) });
      await reload();
      flash(next ? t('admin.thsDesignOn') : t('admin.thsDesignOff'));
    } catch (e: any) {
      flash(e.message || t('admin.thsChangeErr'));
    } finally {
      setBusy(false);
    }
  };

  // ── Preview (local) + Apply (server, hamma uchun) ──
  const previewHoliday = (id: string) => setPreview({ type: 'holiday', id });
  const previewRegion = (id: string) => setPreview({ type: 'region', id });
  const stopPreview = () => setPreview(null);

  const applyOverride = async (o: Override) => {
    setBusy(true);
    try {
      await apiRequest('/api/theme/override', { method: 'PUT', body: JSON.stringify({ override: o }) });
      setServerOverride(o);
      await reload();
      flash(o.type === 'none' ? t('admin.thsClearedAuto') : t('admin.thsAppliedAll', { id: o.id ?? '' }));
    } catch (e: any) {
      flash(e.message || t('admin.thsApplyErr'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" /> {t('admin.thsTitle')}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('admin.thsSubtitle')}
          </p>
        </div>
        {msg && (
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            {msg}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-xs">
        <span className="font-bold text-blue-900">{t('admin.thsServerTheme')}</span>
        <span className="text-blue-800">
          {serverOverride.type === 'none' ? t('admin.thsAutoHoliday') : `${serverOverride.type} → ${serverOverride.id}`}
        </span>
        <button
          onClick={stopPreview}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 font-semibold cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" /> {t('admin.thsStopPreview')}
        </button>
      </div>

      {/* ── Holidays ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-gray-900">{t('admin.thsHolidayList')}</h3>
          <div className="flex items-center gap-2">
            <button onClick={addHoliday} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> {t('common.add')}
            </button>
            <button onClick={saveHolidays} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
              <Save className="w-3.5 h-3.5" /> {t('common.save')}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {holidays.map((h, idx) => {
            const isLunar = !h.month && !h.day ? true : !!h.date;
            return (
              <div key={h.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={h.motif}
                    onChange={(e) => updateHoliday(idx, { motif: e.target.value })}
                    className="w-12 text-center bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                    title={t('admin.thsMotifTitle')}
                  />
                  <input
                    value={h.name}
                    onChange={(e) => updateHoliday(idx, { name: e.target.value })}
                    className="flex-1 min-w-[150px] bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  />
                  {!isLunar ? (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <input
                        type="number" min={1} max={12} value={h.month ?? ''}
                        onChange={(e) => updateHoliday(idx, { month: Number(e.target.value), date: undefined })}
                        className="w-14 bg-white border border-gray-200 rounded-lg px-2 py-1.5" title={t('admin.thsMonthTitle')}
                      />
                      <span>—</span>
                      <input
                        type="number" min={1} max={31} value={h.day ?? ''}
                        onChange={(e) => updateHoliday(idx, { day: Number(e.target.value), date: undefined })}
                        className="w-14 bg-white border border-gray-200 rounded-lg px-2 py-1.5" title={t('admin.thsDayTitle')}
                      />
                    </div>
                  ) : (
                    <input
                      type="date" value={h.date || ''}
                      onChange={(e) => updateHoliday(idx, { date: e.target.value, month: undefined, day: undefined })}
                      className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs" title={t('admin.thsDateTitle')}
                    />
                  )}
                  <select
                    value={h.effect || 'none'}
                    onChange={(e) => updateHoliday(idx, { effect: e.target.value as EffectKey })}
                    className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-semibold cursor-pointer"
                    title={t('admin.thsEffectTitle')}
                  >
                    {EFFECT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                  <input
                    type="color" value={h.accent}
                    onChange={(e) => { const accent = e.target.value; updateHoliday(idx, { accent, gradient: `linear-gradient(135deg, ${accent}, ${accent})` }); }}
                    className="w-9 h-9 rounded-lg border border-gray-200 bg-white cursor-pointer" title={t('admin.thsAccentTitle')}
                  />
                  <button onClick={() => previewHoliday(h.id)} className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-blue-400 text-xs font-semibold cursor-pointer">{t('admin.thsPreview')}</button>
                  <button onClick={() => applyOverride({ type: 'holiday', id: h.id })} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1" title={t('admin.thsApplyAllTitle')}>
                    <Check className="w-3.5 h-3.5" /> {t('admin.thsHammaga')}
                  </button>
                  <button onClick={() => removeHoliday(idx)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer" title={t('common.delete')}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {/* Bayram fon rasmlari */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-gray-500 font-semibold">{t('admin.thsBgImages')}</span>
                  {(h.backgrounds || []).map((src, bIdx) => (
                    <div key={src + bIdx} className="relative w-14 h-10 rounded-md overflow-hidden border border-gray-200 bg-gray-100">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => removeHolidayBg(idx, bIdx)} className="absolute top-0 right-0 p-0.5 bg-black/55 text-white rounded-bl-md cursor-pointer"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <label className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-[11px] font-semibold cursor-pointer">
                    <ImagePlus className="w-3.5 h-3.5" /> {t('admin.thsImage')}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadHolidayBg(idx, f); }} />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
        {!isStaff && (
          <p className="text-[11px] text-amber-600 mt-3">{t('admin.thsAdminNote')}</p>
        )}
      </div>

      {/* ── Region themes ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-gray-900">{t('admin.thsRegionThemes')}</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {t('admin.thsRegionHint')}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={toggleRegionEnabled}
              disabled={busy}
              className={`relative inline-flex items-center gap-2 h-9 pl-1 pr-3 rounded-full border text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                regionThemesEnabled ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-100 border-gray-300 text-gray-500'
              }`}
              title={t('admin.thsToggleTitle')}
            >
              <span className={`inline-flex w-8 h-8 rounded-full items-center justify-center transition-colors ${regionThemesEnabled ? 'bg-emerald-500 text-white' : 'bg-white text-gray-400 border border-gray-200'}`}>
                <span className={`w-3.5 h-3.5 rounded-full ${regionThemesEnabled ? 'bg-white' : 'bg-gray-300'}`} />
              </span>
              {regionThemesEnabled ? t('admin.thsEnabledState') : t('admin.thsDisabledState')}
            </button>
            <button onClick={saveRegions} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
              <Save className="w-3.5 h-3.5" /> {t('common.save')}
            </button>
          </div>
        </div>

        {!regionThemesEnabled && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <X className="w-4 h-4 shrink-0" /> {t('admin.thsOffBanner')}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.keys(REGION_THEMES).map((id) => {
            const base = REGION_THEMES[id];
            const ov = regionOverrides[id] || {};
            const accent = ov.accent || base.accent;
            const motif = ov.motif ?? base.motif;
            const pattern = ov.pattern || base.pattern || 'plain';
            const bgs = ov.backgrounds || base.backgrounds || [];
            return (
              <div key={id} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800 truncate">{regionNames[id] || base.badge}</span>
                  <span className="w-6 h-6 rounded-md shrink-0" style={{ background: `linear-gradient(135deg, ${accent}, ${accent})` }} />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color" value={accent}
                    onChange={(e) => updateRegion(id, { accent: e.target.value })}
                    className="w-9 h-9 rounded-lg border border-gray-200 bg-white cursor-pointer" title={t('admin.thsAccent')}
                  />
                  <input
                    value={motif} onChange={(e) => updateRegion(id, { motif: e.target.value })}
                    className="w-12 text-center bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                  />
                  <select
                    value={pattern} onChange={(e) => updateRegion(id, { pattern: e.target.value as PatternKey })}
                    className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold cursor-pointer" title={t('admin.thsPattern')}
                  >
                    {PATTERN_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </div>
                {/* Fon rasmlari (bir nechta) */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {bgs.map((src, bIdx) => (
                    <div key={src + bIdx} className="relative w-14 h-10 rounded-md overflow-hidden border border-gray-200 bg-gray-100">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => removeRegionBg(id, bIdx)} className="absolute top-0 right-0 p-0.5 bg-black/55 text-white rounded-bl-md cursor-pointer"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <label className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-[11px] font-semibold cursor-pointer">
                    <Upload className="w-3.5 h-3.5" /> {bgs.length ? t('admin.thsAddShort') : t('admin.thsBgLabel')}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addRegionBg(id, f); }} />
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => previewRegion(id)} className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-blue-400 text-xs font-semibold cursor-pointer">{t('admin.thsPreview')}</button>
                  <button onClick={() => applyOverride({ type: 'region', id })} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1" title={t('admin.thsApplyAllTitle')}>
                    <Check className="w-3.5 h-3.5" /> {t('admin.thsHammaga')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => applyOverride({ type: 'none' })}
          disabled={busy}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold disabled:opacity-50 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" /> {t('admin.thsAutoBack')}
        </button>
      </div>
    </div>
  );
};
