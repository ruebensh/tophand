import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../lib/api.ts';
import { useLogo } from '../../context/LogoContext.tsx';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Palette,
  Sparkles,
  Info,
  Type,
  Eye,
  Sliders,
  Globe,
} from 'lucide-react';
import { useI18n } from '../../i18n/IntlContext.tsx';

export const PlatformManagementSection: React.FC = () => {
  const { t } = useI18n();
  const { branding, updateBranding, updateActiveLogo, refreshLogo, fullLogoSrc } = useLogo();

  // Branding Form State
  const [prefixText, setPrefixText] = useState(branding.prefix_text || 'top');
  const [prefixColor, setPrefixColor] = useState(branding.prefix_color || '#111827');
  const [suffixText, setSuffixText] = useState(branding.suffix_text || 'hand');
  const [suffixColor, setSuffixColor] = useState(branding.suffix_color || '#1673E6');
  const [domainSuffix, setDomainSuffix] = useState(branding.domain_suffix || '.uz');
  const [domainColor, setDomainColor] = useState(branding.domain_color || '#1673E6');
  const [tagline, setTagline] = useState(branding.tagline || '');
  const [isSavingBrand, setIsSavingBrand] = useState(false);
  const [brandSuccessMsg, setBrandSuccessMsg] = useState('');
  const [brandErrorMsg, setBrandErrorMsg] = useState('');

  // Logo file upload state
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── Favicon (light/dark) — sayt logo'sidan butunlay mustaqil ──
  const [favFiles, setFavFiles] = useState<{ light: File | null; dark: File | null }>({ light: null, dark: null });
  const [favPreviews, setFavPreviews] = useState<{ light: string | null; dark: string | null }>({ light: null, dark: null });
  const [favInfo, setFavInfo] = useState<{ light: any; dark: any }>({ light: null, dark: null });
  const [favBusy, setFavBusy] = useState<'light' | 'dark' | null>(null);
  const [favErr, setFavErr] = useState<string | null>(null);
  const [favOk, setFavOk] = useState<string | null>(null);

  const fetchFavicon = useCallback(async () => {
    try {
      const d = await apiRequest<any>('/api/admin/favicon');
      setFavInfo({ light: d?.light || null, dark: d?.dark || null });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchFavicon();
  }, [fetchFavicon]);

  const pickFavicon = (variant: 'light' | 'dark', f?: File) => {
    setFavErr(null);
    setFavOk(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.png')) {
      setFavErr(t('admin.fmsFmtErr'));
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setFavErr(t('admin.fmsSizeErr'));
      return;
    }
    setFavFiles((p) => ({ ...p, [variant]: f }));
    const reader = new FileReader();
    reader.onloadend = () => setFavPreviews((p) => ({ ...p, [variant]: reader.result as string }));
    reader.readAsDataURL(f);
  };

  const uploadFavicon = async (variant: 'light' | 'dark') => {
    const f = favFiles[variant];
    if (!f) return;
    setFavBusy(variant);
    setFavErr(null);
    setFavOk(null);
    try {
      const fd = new FormData();
      fd.append('favicon', f);
      fd.append('variant', variant);
      const token = localStorage.getItem('tophand_token');
      const res = await fetch('/api/admin/favicon', {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('admin.fmsErr'));
      setFavOk(t('admin.fmsUploaded'));
      setFavFiles((p) => ({ ...p, [variant]: null }));
      setFavPreviews((p) => ({ ...p, [variant]: null }));
      await refreshLogo();
      await fetchFavicon();
    } catch (e: any) {
      setFavErr(e.message || t('admin.fmsErr'));
    } finally {
      setFavBusy(null);
    }
  };

  useEffect(() => {
    setPrefixText(branding.prefix_text || 'top');
    setPrefixColor(branding.prefix_color || '#111827');
    setSuffixText(branding.suffix_text || 'hand');
    setSuffixColor(branding.suffix_color || '#1673E6');
    setDomainSuffix(branding.domain_suffix || '.uz');
    setDomainColor(branding.domain_color || '#1673E6');
    setTagline(branding.tagline || '');
  }, [branding]);

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBrand(true);
    setBrandSuccessMsg('');
    setBrandErrorMsg('');

    try {
      const payload = {
        prefix_text: prefixText.trim(),
        prefix_color: prefixColor,
        suffix_text: suffixText.trim(),
        suffix_color: suffixColor,
        domain_suffix: domainSuffix.trim(),
        domain_color: domainColor,
        tagline: tagline.trim(),
        logo_url: branding.logo_url,
      };

      await apiRequest('/api/admin/branding', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      updateBranding(payload);
      setBrandSuccessMsg(t('admin.mpsSaveOk'));
      setTimeout(() => setBrandSuccessMsg(''), 4000);
    } catch (err: any) {
      setBrandErrorMsg(err.message || t('admin.mpsSaveErr'));
    } finally {
      setIsSavingBrand(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadSuccess(null);
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      setFile(null);
      setFilePreview(null);
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith('.png')) {
      setUploadError(t('admin.mpsFmtErr'));
      setFile(null);
      setFilePreview(null);
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setUploadError(t('admin.mpsSizeErr'));
      setFile(null);
      setFilePreview(null);
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleUploadLogo = async () => {
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('logo', file);

    try {
      const token = localStorage.getItem('tophand_token');
      const res = await fetch('/api/admin/logo', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t('admin.mpsUploadErrFull'));
      }

      setUploadSuccess(t('admin.mpsUploadOk'));
      setFile(null);
      setFilePreview(null);
      if (data.logo_url) {
        updateActiveLogo(data.logo_url, data.version);
      }
      await refreshLogo();
    } catch (err: any) {
      setUploadError(err.message || t('admin.mnsLoadErr'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Platform Brand & Letter Colors Editor */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs">
        <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-950 flex items-center gap-2">
              <Palette className="w-5 h-5 text-blue-600" />
              <span>{t('admin.mpsTitle')}</span>
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {t('admin.mpsSubtitle')}
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('admin.mpsLiveBadge')}</span>
          </span>
        </div>

        {/* Live Interactive Preview Box */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-gray-50 via-slate-50 to-blue-50/40 border border-gray-200/80">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-3 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-blue-600" />
            <span>{t('admin.mpsLivePreview')}</span>
          </span>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-gray-200/70 shadow-xs">
            <div className="flex items-center gap-3">
              <img
                src={fullLogoSrc}
                alt="Logo Preview"
                className="w-9 h-9 sm:w-11 sm:h-11 object-contain"
              />
              <div>
                <span className="font-black text-2xl sm:text-3xl tracking-tight leading-none select-none flex items-center">
                  <span style={{ color: prefixColor }}>{prefixText || 'top'}</span>
                  <span style={{ color: suffixColor }}>{suffixText || 'hand'}</span>
                  <span style={{ color: domainColor }}>{domainSuffix || '.uz'}</span>
                </span>
                <p className="text-xs text-gray-400 mt-1 font-medium">{tagline || t('admin.mpsTaglineDefault')}</p>
              </div>
            </div>

            {/* Dark mode mock */}
            <div className="p-3 rounded-xl bg-gray-950 flex items-center gap-2.5">
              <span className="text-[10px] text-gray-400 font-semibold">{t('admin.mpsNightBg')}</span>
              <span className="font-black text-lg tracking-tight select-none">
                <span style={{ color: '#ffffff' }}>{prefixText}</span>
                <span style={{ color: suffixColor }}>{suffixText}</span>
                <span style={{ color: domainColor }}>{domainSuffix}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Brand Editor Form */}
        <form onSubmit={handleSaveBrand} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Part 1 (Prefix: top) */}
            <div className="p-4 rounded-2xl bg-gray-50/80 border border-gray-200/60 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t('admin.mpsPart1')}</span>
                </label>
                <span className="text-[10px] text-gray-400 font-mono">{t('admin.mpsExTop')}</span>
              </div>
              <input
                type="text"
                value={prefixText}
                onChange={(e) => setPrefixText(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-900 focus:outline-hidden focus:border-blue-600"
                placeholder="top"
              />
              <div>
                <label className="text-[11px] font-semibold text-gray-600 block mb-1.5">{t('admin.mpsPart1Color')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={prefixColor}
                    onChange={(e) => setPrefixColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={prefixColor}
                    onChange={(e) => setPrefixColor(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-mono text-gray-800"
                  />
                </div>
              </div>
            </div>

            {/* Part 2 (Suffix: hand) */}
            <div className="p-4 rounded-2xl bg-gray-50/80 border border-gray-200/60 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t('admin.mpsPart2')}</span>
                </label>
                <span className="text-[10px] text-gray-400 font-mono">{t('admin.mpsExHand')}</span>
              </div>
              <input
                type="text"
                value={suffixText}
                onChange={(e) => setSuffixText(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-900 focus:outline-hidden focus:border-blue-600"
                placeholder="hand"
              />
              <div>
                <label className="text-[11px] font-semibold text-gray-600 block mb-1.5">{t('admin.mpsPart2Color')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={suffixColor}
                    onChange={(e) => setSuffixColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={suffixColor}
                    onChange={(e) => setSuffixColor(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-mono text-gray-800"
                  />
                </div>
              </div>
            </div>

            {/* Part 3 (Domain: .uz) */}
            <div className="p-4 rounded-2xl bg-gray-50/80 border border-gray-200/60 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t('admin.mpsPart3')}</span>
                </label>
                <span className="text-[10px] text-gray-400 font-mono">{t('admin.mpsExDomain')}</span>
              </div>
              <input
                type="text"
                value={domainSuffix}
                onChange={(e) => setDomainSuffix(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-900 focus:outline-hidden focus:border-blue-600"
                placeholder=".uz"
              />
              <div>
                <label className="text-[11px] font-semibold text-gray-600 block mb-1.5">{t('admin.mpsPart3Color')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={domainColor}
                    onChange={(e) => setDomainColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={domainColor}
                    onChange={(e) => setDomainColor(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-mono text-gray-800"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Slogan */}
          <div className="p-4 rounded-2xl bg-gray-50/80 border border-gray-200/60">
            <label className="text-xs font-bold text-gray-800 block mb-1.5">
              {t('admin.mpsSloganLabel')}
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 focus:outline-hidden focus:border-blue-600"
              placeholder={t('admin.mpsTaglinePlaceholder')}
            />
          </div>

          {/* Feedback messages */}
          {brandSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{brandSuccessMsg}</span>
            </div>
          )}
          {brandErrorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{brandErrorMsg}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingBrand}
              className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              {isSavingBrand ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('admin.lmsSaving')}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('admin.mpsSaveBtn')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Logo File Upload Card */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs">
        <h3 className="text-lg font-extrabold text-gray-950 flex items-center gap-2 mb-2">
          <Upload className="w-5 h-5 text-blue-600" />
          <span>{t('admin.mpsLogoTitle')}</span>
        </h3>
        <p className="text-xs text-gray-500 mb-6">
          {t('admin.mpsLogoSubtitle')}
        </p>

        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-blue-400 transition-colors">
          <input
            type="file"
            id="logo-file-input"
            accept=".png,image/png"
            onChange={handleFileChange}
            className="hidden"
          />
          <label htmlFor="logo-file-input" className="cursor-pointer flex flex-col items-center">
            {filePreview ? (
              <div className="mb-3">
                <img
                  src={filePreview}
                  alt="Preview"
                  className="max-h-24 max-w-full object-contain mx-auto"
                />
                <span className="text-xs text-blue-600 font-bold block mt-2">{t('admin.mpsChooseOther')}</span>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-gray-900 block mb-1">
                  {t('admin.mpsChooseNew')}
                </span>
                <span className="text-xs text-gray-400">{t('admin.mpsMaxSize')}</span>
              </>
            )}
          </label>
        </div>

        {uploadSuccess && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
        )}
        {uploadError && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {file && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleUploadLogo}
              disabled={isUploading}
              className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('admin.mpsUploading')}</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t('admin.mpsSetLogo')}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 3. Favicon (light/dark) — sayt logo'sidan mustaqil brauzer ikonasi */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs">
        <h3 className="text-lg font-extrabold text-gray-950 flex items-center gap-2 mb-2">
          <Globe className="w-5 h-5 text-blue-600" />
          <span>{t('admin.fmsTitle')}</span>
        </h3>
        <p className="text-xs text-gray-500 mb-6">{t('admin.fmsSubtitle')}</p>

        {favErr && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{favErr}</span>
          </div>
        )}
        {favOk && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{favOk}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(['light', 'dark'] as const).map((v) => {
            const info = favInfo[v];
            const currentSrc = info?.url
              ? `${info.url}${info.url.includes('?') ? '&' : '?'}v=${info.version || 'x'}`
              : null;
            const shown = favPreviews[v] || currentSrc;
            return (
              <div key={v} className="p-5 rounded-2xl border border-gray-200 bg-gray-50/60">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-gray-700">
                    {t(v === 'dark' ? 'admin.fmsDarkLabel' : 'admin.fmsLightLabel')}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                    {t('admin.fmsActive')}
                  </span>
                </div>

                <div
                  className="relative w-full h-32 rounded-xl border border-gray-200 flex items-center justify-center p-4 overflow-hidden bg-white"
                  style={{
                    backgroundImage:
                      'linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)',
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                  }}
                >
                  {shown ? (
                    <img src={shown} alt={`Favicon ${v}`} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-[11px] text-gray-400">{t('admin.fmsNone')}</span>
                  )}
                </div>

                <input
                  type="file"
                  id={`fav-${v}-input`}
                  accept=".png,image/png"
                  onChange={(e) => pickFavicon(v, e.target.files?.[0])}
                  className="hidden"
                />

                <div className="mt-4 flex items-center gap-2">
                  <label
                    htmlFor={`fav-${v}-input`}
                    className="flex-1 cursor-pointer py-2.5 px-4 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{favFiles[v] ? t('admin.mpsChooseOther') : t('admin.fmsChoose')}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => uploadFavicon(v)}
                    disabled={!favFiles[v] || favBusy === v}
                    className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {favBusy === v ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{t('admin.fmsUploading')}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t('admin.fmsUpload')}</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-gray-400">{t('admin.fmsHint')}</p>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[11px] text-amber-600 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          <span>{t('admin.fmsNote')}</span>
        </p>
      </div>
    </div>
  );
};
