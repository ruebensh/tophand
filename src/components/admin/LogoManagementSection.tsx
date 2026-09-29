import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  Clock,
  UserCheck,
  FileCheck,
  Info,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../../lib/api.ts';
import { useLogo } from '../../context/LogoContext.tsx';
import { formatDateAgo } from '../../lib/utils.ts';

interface AdminLogoData {
  logo_url: string;
  updated_at: string;
  updated_by: string | null;
  updater_name: string;
  version: string;
  width?: number;
  height?: number;
  size?: number;
  hasAlpha?: boolean;
  last_audit?: {
    id: string;
    actor_name?: string;
    created_at: string;
    metadata?: string;
  };
}

export const LogoManagementSection: React.FC = () => {
  const { fullLogoSrc, updateActiveLogo, refreshLogo } = useLogo();

  // Remote server data
  const [logoData, setLogoData] = useState<AdminLogoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Staged upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{ width: number; height: number; size: number } | null>(null);

  // Actions state
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLogoData = async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest<AdminLogoData>('/api/admin/logo');
      setLogoData(data);
    } catch (err: any) {
      console.error('Error fetching admin logo data:', err);
      setErrorMessage(err.message || 'Logo ma’lumotlarini yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogoData();
  }, []);

  // Cleanup object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Strict client-side format validation (.png only)
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'png' || (file.type && file.type !== 'image/png')) {
      setErrorMessage("Faqat .png formatidagi rasm fayllari qabul qilinadi. Boshqa formatlar (JPG, SVG, WebP, GIF) taqiqlanadi.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Maximum size check (5 MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setErrorMessage(`Fayl hajmi juda katta (${sizeMB} MB). Maksimal ruxsat etilgan hajm: 5 MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);

    // Read image dimensions
    const img = new Image();
    img.onload = () => {
      setPreviewMeta({
        width: img.naturalWidth,
        height: img.naturalHeight,
        size: file.size,
      });
    };
    img.src = objectUrl;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleCancel = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setPreviewMeta(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedFile) {
      setErrorMessage("Iltimos, avval yangi PNG logo faylini tanlang.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append('logo', selectedFile);

      // We use standard fetch with token to send multipart/form-data
      const token = localStorage.getItem('tophand_token');
      const res = await fetch('/api/admin/logo', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.error || "Serverda logoni yangilashda xatolik yuz berdi.");
      }

      // Success
      setSuccessMessage("TopHand logosi muvaffaqiyatli saqlandi va butun platforma bo‘ylab yangilandi!");
      handleCancel();

      // Update central context immediately
      if (responseData.logo_url) {
        updateActiveLogo(responseData.logo_url, responseData.updated_at);
        await refreshLogo();
      }

      // Refresh admin data
      await fetchLogoData();
    } catch (err: any) {
      console.error('Error saving logo:', err);
      setErrorMessage(err.message || 'Logoni saqlashda xatolik yuz berdi. Amaldagi logo o‘zgarishsiz qoldirildi.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Heading */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">Logo Management (Logo boshqaruvi)</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                TopHand loyihasining rasmiy logosini markazlashgan holda yangilash va boshqarish
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogoData}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Yangilash</span>
            </button>
          </div>
        </div>

        {/* Notices */}
        {errorMessage && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-bold">Xatolik:</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-emerald-800 animate-in fade-in duration-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-bold">Muvaffaqiyatli:</p>
              <p className="mt-0.5">{successMessage}</p>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Requirements Box */}
        <div className="mt-6 p-4 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-start gap-3 text-blue-900 text-xs">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <p className="font-bold text-blue-950">Qat’iy talablar va xavfsizlik qoidalari:</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-800">
              <li>Faqat bitta haqiqiy <strong>.png</strong> formatidagi rasm qabul qilinadi (JPG, SVG, WebP, GIF taqiqlanadi).</li>
              <li>Maksimal ruxsat etilgan fayl hajmi: <strong>5 MB</strong>.</li>
              <li>Shaffof (transparent) fon to‘liq qo‘llab-quvvatlanadi.</li>
              <li>Yuklangan faylning asl piksellari, nisbati, shaffofligi va ranglari mutlaqo o‘zgartirilmasdan saqlanadi.</li>
              <li>Yangi logo tasdiqlangandan so‘ng sayt sarlavhasi (Header), mobil menyu, sahifalar va autentifikatsiya oynalarida bir zumda aks etadi.</li>
            </ul>
          </div>
        </div>

        {/* Main Grid: Active Logo vs New Upload */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Card 1: Currently Active Logo */}
          <div className="p-6 rounded-2xl border border-gray-200 bg-gray-50/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Amaldagi faol logo (Active Logo)
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="w-3 h-3" />
                  Hozir faol
                </span>
              </div>

              {/* Logo Preview Container with subtle checkerboard to show transparency */}
              <div
                className="relative w-full h-44 rounded-2xl border border-gray-200 flex items-center justify-center p-6 overflow-hidden bg-white shadow-inner"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                }}
              >
                <img
                  src={fullLogoSrc}
                  alt="Active TopHand Logo"
                  className="max-h-full max-w-full object-contain shrink-0 transition-transform duration-200 hover:scale-105"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Metadata Details */}
              <div className="mt-4 space-y-2 text-xs text-gray-600 bg-white p-4 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Fayl yo‘li (Path):</span>
                  <span className="font-mono text-gray-800 truncate max-w-[200px]" title={logoData?.logo_url}>
                    {logoData?.logo_url || '/TOPHAND.uz (1).png'}
                  </span>
                </div>
                {logoData?.width && logoData?.height && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">O‘lchamlari (Resolution):</span>
                    <span className="font-bold text-gray-800">
                      {logoData.width} × {logoData.height} px
                    </span>
                  </div>
                )}
                {logoData?.size && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Hajmi (Size):</span>
                    <span className="font-bold text-gray-800">{formatFileSize(logoData.size)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Oxirgi yangilangan:</span>
                  <span className="text-gray-800 font-medium" title={logoData?.updated_at}>
                    {logoData?.updated_at ? formatDateAgo(logoData.updated_at) : 'Dastlabki versiya'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Mas’ul admin:</span>
                  <span className="text-gray-800 font-medium">{logoData?.updater_name || 'Tizim'}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200/80 flex items-center justify-between text-[11px] text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Avtomatik kesh yangilanishi faol
              </span>
              <span className="font-mono">v{logoData?.version?.slice(-6) || 'active'}</span>
            </div>
          </div>

          {/* Card 2: Upload & Preview New Logo */}
          <div className="p-6 rounded-2xl border border-gray-200 bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Yangi logo yuklash (Upload New Logo)
                </span>
                {selectedFile && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    Kutilmoqda
                  </span>
                )}
              </div>

              {!selectedFile ? (
                /* Dropzone / Upload trigger */
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-44 rounded-2xl border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/30 transition-all cursor-pointer flex flex-col items-center justify-center p-6 text-center group"
                >
                  <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-blue-100 group-hover:text-blue-600 text-gray-500 flex items-center justify-center transition-colors mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                    PNG faylni tanlash uchun bosing yoki shu yerga tashlang
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">Faqat .png format, maksimal 5 MB</p>
                </div>
              ) : (
                /* Staged preview of selected file */
                <div>
                  <div
                    className="relative w-full h-44 rounded-2xl border border-blue-200 flex items-center justify-center p-6 overflow-hidden bg-white shadow-inner"
                    style={{
                      backgroundImage:
                        'linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)',
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                    }}
                  >
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt="New Logo Preview"
                        className="max-h-full max-w-full object-contain shrink-0 animate-in zoom-in-95 duration-150"
                      />
                    )}
                  </div>

                  <div className="mt-4 p-4 rounded-xl bg-blue-50/70 border border-blue-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-900 font-semibold">Tanlangan fayl:</span>
                      <span className="font-mono text-gray-800 font-bold truncate max-w-[200px]">
                        {selectedFile.name}
                      </span>
                    </div>
                    {previewMeta && (
                      <div className="flex items-center justify-between">
                        <span className="text-blue-900">Aniqlangan o‘lcham:</span>
                        <span className="font-bold text-gray-800">
                          {previewMeta.width} × {previewMeta.height} px
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-blue-900">Hajmi:</span>
                      <span className="font-bold text-gray-800">{formatFileSize(selectedFile.size)}</span>
                    </div>
                    <div className="pt-1 text-[11px] text-amber-700 font-medium">
                      * Eslatma: Amaldagi logo hozircha o‘zgarmadi. Tasdiqlash uchun "O‘zgarishlarni saqlash" tugmasini bosing.
                    </div>
                  </div>
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,image/png"
                onChange={handleInputChange}
                className="hidden"
              />
            </div>

            {/* Buttons: Upload Logo / Save Changes / Cancel */}
            <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
              {!selectedFile ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Logo (PNG tanlash)</span>
                </button>
              ) : (
                <div className="flex items-center gap-3 w-full">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    <span>Bekor qilish (Cancel)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Saqlanmoqda...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>O‘zgarishlarni saqlash (Save)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Audit Log Record for Logo Updates */}
        {logoData?.last_audit && (
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Oxirgi o‘zgarish auditi (Audit log)
            </h3>
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 text-xs text-gray-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Admin <strong>{logoData.last_audit.actor_name || 'Administrator'}</strong> tomonidan logo yangilangan
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-400 font-mono text-[11px]">
                <Clock className="w-3.5 h-3.5" />
                <span>{new Date(logoData.last_audit.created_at).toLocaleString('uz-UZ')}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogoManagementSection;
