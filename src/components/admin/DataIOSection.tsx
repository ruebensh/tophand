import React, { useState } from 'react';
import { exportEntityToExcel, importEntityFromExcel, type ImportReport } from '../../lib/api.ts';
import { Download, Upload, Loader2, Table2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useI18n } from '../../i18n/IntlContext.tsx';

const ENTITIES: { id: string; labelKey: string; importable: boolean }[] = [
  { id: 'users', labelKey: 'admin.entUsers', importable: true },
  { id: 'listings', labelKey: 'admin.entListings', importable: true },
  { id: 'organizations', labelKey: 'admin.entOrgs', importable: true },
  { id: 'categories', labelKey: 'admin.entCategories', importable: true },
  { id: 'regions', labelKey: 'admin.entRegions', importable: true },
  { id: 'districts', labelKey: 'admin.entDistricts', importable: true },
];

export const DataIOSection: React.FC = () => {
  const { t } = useI18n();
  const [entity, setEntity] = useState('users');
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState('');
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setBusy('export');
    setError('');
    try {
      await exportEntityToExcel(entity);
    } catch (err: any) {
      setError(err.message || t('admin.dioExportErr'));
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async (file: File) => {
    setBusy('import');
    setError('');
    setReport(null);
    try {
      const r = await importEntityFromExcel(entity, file);
      setReport(r);
    } catch (err: any) {
      setError(err.message || t('admin.dioImportErr'));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center gap-2">
        <Table2 className="w-5 h-5 text-blue-600" />
        <h3 className="font-black text-sm text-gray-900">{t('admin.dioTitle')}</h3>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {/* Entity picker */}
        <div>
          <label className="block text-xs font-bold text-gray-800 mb-1.5">{t('admin.dioTableLabel')}</label>
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className="w-full sm:max-w-xs bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500"
          >
            {ENTITIES.map((en) => (
              <option key={en.id} value={en.id}>
                {t(en.labelKey)}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={busy !== null}
            className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {busy === 'export' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{t('admin.dioDownload')}</span>
          </button>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy !== null}
            className="px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {busy === 'import' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>{t('admin.dioImport')}</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
            }}
          />
        </div>

        <p className="text-[11px] text-gray-400 leading-relaxed">
          {t('admin.dioHint')}
        </p>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {report && (
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-gray-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {t('admin.dioReportDone')}
            </div>
            <div className="flex flex-wrap gap-4 text-gray-600">
              <span>{t('admin.dioTotal')} <b>{report.total}</b></span>
              <span className="text-emerald-700">{t('admin.dioInserted')} <b>{report.inserted}</b></span>
              <span className="text-blue-700">{t('admin.dioUpdated')} <b>{report.updated}</b></span>
              <span className={report.errors.length ? 'text-rose-700' : 'text-gray-500'}>
                {t('admin.dioErrors')} <b>{report.errors.length}</b>
              </span>
            </div>
            {report.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto mt-2 space-y-1 border-t border-gray-200 pt-2">
                {report.errors.slice(0, 50).map((e, i) => (
                  <div key={i} className="text-rose-600 text-[11px]">
                    {t('admin.dioRow', { n: e.row })}: {e.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DataIOSection;
