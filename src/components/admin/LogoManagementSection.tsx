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
import { useI18n } from '../../i18n/IntlContext.tsx';

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
  const { t } = useI18n();
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
      setErrorMessage(err.message || t('admin.lmsFetchErr'));
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
      setErrorMessage(t('admin.lmsFmtErr'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Maximum size check (5 MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setErrorMessage(t('admin.lmsSizeErr', { n: sizeMB }));
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
      setErrorMessage(t('admin.lmsSelectFirst'));
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
        throw new Error(responseData.error || t('admin.lmsServerErr'));
      }

      // Success
      setSuccessMessage(t('admin.lmsSaveSuccess'));
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
      setErrorMessage(err.message || t('admin.lmsSaveErr'));
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
              <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">{t('admin.lmsTitle')}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {t('admin.lmsSubtitle')}
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
              <span>{t('admin.lmsRefresh')}</span>
            </button>
          </div>
        </div>

        {/* Notices */}
        {errorMessage && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-bold">{t('admin.lmsErrLabel')}</p>
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
              <p className="font-bold">{t('admin.lmsSuccessLabel')}</p>
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
            <p className="font-bold text-blue-950">{t('admin.lmsReqTitle')}</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-800">
              <li>{t('admin.lmsReq1')}</li>
              <li>{t('admin.lmsReq2')}</li>
              <li>{t('admin.lmsReq3')}</li>
              <li>{t('admin.lmsReq4')}</li>
              <li>{t('admin.lmsReq5')}</li>
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
                  {t('admin.lmsActiveLogo')}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="w-3 h-3" />
                  {t('admin.lmsActiveBadge')}
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
                  <span className="text-gray-400">{t('admin.lmsPath')}</span>
                  <span className="font-mono text-gray-800 truncate max-w-[200px]" title={logoData?.logo_url}>
                    {logoData?.logo_url || '/TOPHAND.uz (1).png'}
                  </span>
                </div>
                {logoData?.width && logoData?.height && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">{t('admin.lmsResolution')}</span>
                    <span className="font-bold text-gray-800">
                      {logoData.width} × {logoData.height} px
                    </span>
                  </div>
                )}
                {logoData?.size && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">{t('admin.lmsSize')}</span>
                    <span className="font-bold text-gray-800">{formatFileSize(logoData.size)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">{t('admin.lmsLastUpdated')}</span>
                  <span className="text-gray-800 font-medium" title={logoData?.updated_at}>
                    {logoData?.updated_at ? formatDateAgo(logoData.updated_at) : t('admin.lmsInitialVersion')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">{t('admin.lmsAdminLabel')}</span>
                  <span className="text-gray-800 font-medium">{logoData?.updater_name || t('admin.lmsSystem')}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200/80 flex items-center justify-between text-[11px] text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {t('admin.lmsCacheNote')}
              </span>
              <span className="font-mono">v{logoData?.version?.slice(-6) || 'active'}</span>
            </div>
          </div>

          {/* Card 2: Upload & Preview New Logo */}
          <div className="p-6 rounded-2xl border border-gray-200 bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t('admin.lmsUploadLabel')}
                </span>
                {selectedFile && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    {t('admin.lmsPendingBadge')}
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
                    {t('admin.lmsDropHint')}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">{t('admin.lmsDropSub')}</p>
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
                      <span className="text-blue-900 font-semibold">{t('admin.lmsSelectedFile')}</span>
                      <span className="font-mono text-gray-800 font-bold truncate max-w-[200px]">
                        {selectedFile.name}
                      </span>
                    </div>
                    {previewMeta && (
                      <div className="flex items-center justify-between">
                        <span className="text-blue-900">{t('admin.lmsDetectedSize')}</span>
                        <span className="font-bold text-gray-800">
                          {previewMeta.width} × {previewMeta.height} px
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-blue-900">{t('admin.lmsSizeShort')}</span>
                      <span className="font-bold text-gray-800">{formatFileSize(selectedFile.size)}</span>
                    </div>
                    <div className="pt-1 text-[11px] text-amber-700 font-medium">
                      {t('admin.lmsNote')}
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
                  <span>{t('admin.lmsUploadBtn')}</span>
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
                    <span>{t('admin.lmsCancelBtn')}</span>
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
                        <span>{t('admin.lmsSaving')}</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>{t('admin.lmsSaveBtn')}</span>
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
              {t('admin.lmsAuditTitle')}
            </h3>
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 text-xs text-gray-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  {t('admin.lmsAuditLine', { name: logoData.last_audit.actor_name || t('admin.lmsAdminDefault') })}
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
