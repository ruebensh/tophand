import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

export const PlatformManagementSection: React.FC = () => {
  const { branding, updateBranding, refreshLogo, fullLogoSrc } = useLogo();

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
      };

      await apiRequest('/api/admin/branding', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      updateBranding(payload);
      setBrandSuccessMsg('Platforma nomi, ranglari va shiori muvaffaqiyatli saqlandi!');
      setTimeout(() => setBrandSuccessMsg(''), 4000);
    } catch (err: any) {
      setBrandErrorMsg(err.message || 'Saqlashda xatolik yuz berdi');
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
      setUploadError("Faqat .png formatidagi fayllar qabul qilinadi.");
      setFile(null);
      setFilePreview(null);
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setUploadError("Fayl hajmi 5 MB dan oshmasligi kerak.");
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
        throw new Error(data.error || 'Yuklashda xatolik yuz berdi');
      }

      setUploadSuccess('Yangi logotip muvaffaqiyatli o‘rnatildi!');
      setFile(null);
      setFilePreview(null);
      await refreshLogo();
    } catch (err: any) {
      setUploadError(err.message || 'Yuklashda xatolik');
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
              <span>Platforma nomi va Harflar ranglari boshqaruvi</span>
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Platforma sarlavhasidagi har bir so‘z va qo‘shimchaning rangini (masalan: «top» qora, «hand» ko‘k) erkin moslang.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Jonli yangilanish</span>
          </span>
        </div>

        {/* Live Interactive Preview Box */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-gray-50 via-slate-50 to-blue-50/40 border border-gray-200/80">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-3 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-blue-600" />
            <span>Jonli ko‘rinish (Real-time Preview):</span>
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
                <p className="text-xs text-gray-400 mt-1 font-medium">{tagline || 'Mahalliy xizmatlar va ish bozori'}</p>
              </div>
            </div>

            {/* Dark mode mock */}
            <div className="p-3 rounded-xl bg-gray-950 flex items-center gap-2.5">
              <span className="text-[10px] text-gray-400 font-semibold">Tungi fon:</span>
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
                  <span>1-qism matni (Bosh qism)</span>
                </label>
                <span className="text-[10px] text-gray-400 font-mono">Masalan: top</span>
              </div>
              <input
                type="text"
                value={prefixText}
                onChange={(e) => setPrefixText(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-900 focus:outline-hidden focus:border-blue-600"
                placeholder="top"
              />
              <div>
                <label className="text-[11px] font-semibold text-gray-600 block mb-1.5">1-qism rangi:</label>
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
                  <span>2-qism matni (Asosiy so‘z)</span>
                </label>
                <span className="text-[10px] text-gray-400 font-mono">Masalan: hand</span>
              </div>
              <input
                type="text"
                value={suffixText}
                onChange={(e) => setSuffixText(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-900 focus:outline-hidden focus:border-blue-600"
                placeholder="hand"
              />
              <div>
                <label className="text-[11px] font-semibold text-gray-600 block mb-1.5">2-qism rangi:</label>
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
                  <span>3-qism (Domen / Qo‘shimcha)</span>
                </label>
                <span className="text-[10px] text-gray-400 font-mono">Masalan: .uz</span>
              </div>
              <input
                type="text"
                value={domainSuffix}
                onChange={(e) => setDomainSuffix(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-900 focus:outline-hidden focus:border-blue-600"
                placeholder=".uz"
              />
              <div>
                <label className="text-[11px] font-semibold text-gray-600 block mb-1.5">3-qism rangi:</label>
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
              Platforma shiori (Slogan / Tavsifi)
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 focus:outline-hidden focus:border-blue-600"
              placeholder="Mahalliy Xizmatlar va Ish Bozori Platformasi"
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
                  <span>Saqlanmoqda...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ranglar va matnni saqlash</span>
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
          <span>Logotip tasvirini yangilash (PNG)</span>
        </h3>
        <p className="text-xs text-gray-500 mb-6">
          Platformaning rasmiy logotip tasvirini almashtirish. Faqat shaffof (.png) format qabul qilinadi.
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
                <span className="text-xs text-blue-600 font-bold block mt-2">Boshqa fayl tanlash</span>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-gray-900 block mb-1">
                  Yangi PNG logotipni tanlang
                </span>
                <span className="text-xs text-gray-400">Maksimal hajm: 5 MB</span>
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
                  <span>Yuklanmoqda...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Logotipni o‘rnatish</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
