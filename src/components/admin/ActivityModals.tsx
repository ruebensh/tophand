import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '../../lib/api.ts';
import { useI18n } from '../../i18n/IntlContext.tsx';
import { LineChart } from './LineChart.tsx';
import { X, Users, Globe, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

// ─── Admin statistika modallari (chiziqli grafik, oylik, so'nggi 12 oy) ────
// 1) VisitsModal — saytga kirganlar (user_events: LOGIN/LOGOUT/noyob mehmon).
// 2) BrowserStatsModal — brauzerda qidiruv va sayt clicklari (Google Search
//    Console API). Ikkalasi ham GSC uslubidagi SVG chiziqli grafik; barcha
//    ko'rsatkichlar bir vaqtda ko'rinadi (toggle yo'q), aniq sonlar bilan.

const MONTHS = 12;

// SVG stroke/fill uchun hex ranglar (Tailwind class emas).
const C = {
  logins: '#2563eb',   // blue-600
  logouts: '#f43f5e',  // rose-500
  unique: '#f59e0b',   // amber-500
  impressions: '#6366f1', // indigo-500
  clicks: '#10b981',   // emerald-500
};

interface VisitsSeriesRow {
  month?: string; // YYYY-MM (oylik)
  date?: string;  // YYYY-MM-DD (kunlik)
  unique_visitors: string | number;
  logins: string | number;
  logouts: string | number;
}
interface VisitsData {
  months?: number;
  days?: number;
  series: VisitsSeriesRow[];
  totals: { logins: number; logouts: number; unique_visitors: number };
}

interface GscMonthRow {
  month?: string; // YYYY-MM (oylik)
  date?: string;  // YYYY-MM-DD (kunlik)
  impressions: number;
  clicks: number;
}
interface GscData {
  status: 'OK' | 'NOT_CONFIGURED' | 'ERROR';
  months?: GscMonthRow[];
  days?: GscMonthRow[];
  top_queries: { query: string; impressions: number; clicks: number }[];
  totals: { impressions: number; clicks: number };
  fetched_at: string | null;
  error?: string;
}

const overlayCls =
  'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200';
const panelCls =
  'relative w-full bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200';

function ModalHeader({
  icon,
  title,
  hint,
  onClose,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClose: () => void;
}) {
  return (
    <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <h3 className="font-bold text-base text-gray-950">{title}</h3>
          <p className="text-[11px] text-gray-500">{hint}</p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-2 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer"
        aria-label="close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// "YYYY-MM" -> locale oy qisqartmasi + 2 xonali yil (masalan "Sen 25").
function useMonthFormatter() {
  const { intlLocale } = useI18n();
  return (month: string) => {
    try {
      return new Intl.DateTimeFormat(intlLocale || 'uz', { month: 'short', year: '2-digit' }).format(
        new Date(month + '-01T00:00:00')
      );
    } catch {
      return month;
    }
  };
}

// "YYYY-MM-DD" -> kun + qisqa oy (masalan "23 okt").
function useDayFormatter() {
  const { intlLocale } = useI18n();
  return (date: string) => {
    try {
      return new Intl.DateTimeFormat(intlLocale || 'uz', { day: '2-digit', month: 'short' }).format(
        new Date(date + 'T00:00:00')
      );
    } catch {
      return date;
    }
  };
}

// Kunlik / Oylik almashinuvi (ikki tugmali segmentlangan boshqaruv).
function ViewToggle({
  mode,
  onChange,
  dailyLabel,
  monthlyLabel,
}: {
  mode: 'daily' | 'monthly';
  onChange: (m: 'daily' | 'monthly') => void;
  dailyLabel: string;
  monthlyLabel: string;
}) {
  const base =
    'px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer';
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-gray-100">
      <button
        onClick={() => onChange('daily')}
        className={`${base} ${mode === 'daily' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
      >
        {dailyLabel}
      </button>
      <button
        onClick={() => onChange('monthly')}
        className={`${base} ${mode === 'monthly' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
      >
        {monthlyLabel}
      </button>
    </div>
  );
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <span className="flex items-center gap-3 text-[10px] font-semibold text-gray-500">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1">
          <span className="w-2.5 h-[3px] rounded-full" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </span>
  );
}

// ─── 1. Saytga kirganlar modali (kunlik / oylik almashinuv) ───────────────
const DAYS = 30;

export const VisitsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const fmtMonth = useMonthFormatter();
  const fmtDay = useDayFormatter();
  const [mode, setMode] = useState<'daily' | 'monthly'>('daily');
  const [data, setData] = useState<VisitsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    setData(null);
    const url = mode === 'monthly' ? `/api/admin/visits?months=${MONTHS}` : `/api/admin/visits?days=${DAYS}`;
    apiRequest<VisitsData>(url)
      .then((d) => setData(d))
      .catch((e: any) => setError(e?.message || t('common.error')))
      .finally(() => setLoading(false));
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const rows = data?.series || [];
  const labelOf = (r: VisitsSeriesRow) => (mode === 'monthly' ? fmtMonth(r.month || '') : fmtDay(r.date || ''));
  const keyOf = (r: VisitsSeriesRow, i: number) => (mode === 'monthly' ? r.month : r.date) || String(i);
  const labels = rows.map(labelOf);
  const hasData = rows.some((r) => Number(r.logins) > 0 || Number(r.logouts) > 0);

  return createPortal(
    <div className={overlayCls} onClick={onClose}>
      <div className={`${panelCls} max-w-3xl`} onClick={(e) => e.stopPropagation()}>
        <ModalHeader
          icon={<span className="p-2 rounded-xl bg-blue-50"><Users className="w-4 h-4 text-blue-600" /></span>}
          title={t('admin.visitsModalTitle')}
          hint={t('admin.visitsModalHint')}
          onClose={onClose}
        />

        {/* Sarlavcha + rejim almashinuvi + seriyalar legendasi (bir vaqtda) */}
        <div className="px-5 pt-4 flex items-center justify-between gap-2 flex-wrap">
          <ViewToggle
            mode={mode}
            onChange={setMode}
            dailyLabel={t('admin.dailyView')}
            monthlyLabel={t('admin.monthlyView')}
          />
          <Legend
            items={[
              { color: C.logins, label: t('admin.logins') },
              { color: C.logouts, label: t('admin.logouts') },
              { color: C.unique, label: t('admin.uniqueVisitors') },
            ]}
          />
        </div>

        <div className="p-5 overflow-y-auto">
          <p className="text-[11px] font-bold text-gray-500 uppercase mb-3">
            {mode === 'monthly' ? t('admin.last12Months') : t('admin.last30Days')}
          </p>
          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
          {loading && !data && <div className="h-48 rounded-2xl bg-gray-50 animate-pulse" />}
          {data && (
            <>
              {/* Jami kartalar (tanlangan davr yig'indisi) */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100 text-center">
                  <p className="text-xl font-black text-blue-900">{data.totals.logins.toLocaleString()}</p>
                  <span className="text-[10px] font-bold text-blue-700 uppercase">{t('admin.logins')}</span>
                </div>
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-center">
                  <p className="text-xl font-black text-rose-900">{data.totals.logouts.toLocaleString()}</p>
                  <span className="text-[10px] font-bold text-rose-700 uppercase">{t('admin.logouts')}</span>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100 text-center">
                  <p className="text-xl font-black text-amber-900">{data.totals.unique_visitors.toLocaleString()}</p>
                  <span className="text-[10px] font-bold text-amber-700 uppercase">{t('admin.uniqueVisitors')}</span>
                </div>
              </div>

              {!hasData ? (
                <p className="text-xs text-gray-400 italic text-center py-8">{t('admin.noDataYet')}</p>
              ) : (
                <>
                  {/* Chiziqli grafik — 3 seriya bir vaqtda */}
                  <div className="rounded-2xl border border-gray-100 p-3 mb-4">
                    <LineChart
                      labels={labels}
                      height={240}
                      series={[
                        { name: t('admin.logins'), color: C.logins, values: rows.map((r) => Number(r.logins)) },
                        { name: t('admin.logouts'), color: C.logouts, values: rows.map((r) => Number(r.logouts)) },
                        { name: t('admin.uniqueVisitors'), color: C.unique, values: rows.map((r) => Number(r.unique_visitors)) },
                      ]}
                    />
                  </div>

                  {/* Aniq sonlar jadvali (kunma-kun yoki oyma-oy) */}
                  <div className="rounded-2xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-left text-[10px] uppercase font-bold text-gray-500">
                          <th className="px-3 py-2">{mode === 'monthly' ? t('admin.monthCol') : t('admin.dayCol')}</th>
                          <th className="px-3 py-2 text-right">{t('admin.logins')}</th>
                          <th className="px-3 py-2 text-right">{t('admin.logouts')}</th>
                          <th className="px-3 py-2 text-right">{t('admin.uniqueVisitors')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={keyOf(r, i)} className="border-t border-gray-50 hover:bg-gray-50/50">
                            <td className="px-3 py-1.5 font-semibold text-gray-800">{labelOf(r)}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-blue-700">{Number(r.logins).toLocaleString()}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-rose-600">{Number(r.logouts).toLocaleString()}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-amber-600">{Number(r.unique_visitors).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── 2. Brauzer qidiruvlari (GSC) modali (kunlik / oylik almashinuv) ──────
export const BrowserStatsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { t, intlLocale } = useI18n();
  const fmtMonth = useMonthFormatter();
  const fmtDay = useDayFormatter();
  const [mode, setMode] = useState<'daily' | 'monthly'>('monthly');
  const [data, setData] = useState<GscData | null>(null);
  const [loading, setLoading] = useState(false);
  // Konfiguratsiya formasi (NOT_CONFIGURED holatida ko'rsatiladi)
  const [cfg, setCfg] = useState({ client_email: '', site_url: '', private_key: '' });
  const [saving, setSaving] = useState(false);
  const [cfgMsg, setCfgMsg] = useState<'saved' | 'error' | null>(null);

  const fetchData = () => {
    setLoading(true);
    const url = mode === 'monthly' ? `/api/admin/gsc-analytics?months=${MONTHS}` : `/api/admin/gsc-analytics?days=${DAYS}`;
    apiRequest<GscData>(url)
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const saveCfg = async () => {
    setSaving(true);
    setCfgMsg(null);
    try {
      await apiRequest('/api/admin/gsc/config', { method: 'PUT', body: JSON.stringify(cfg) });
      setCfgMsg('saved');
      setCfg((c) => ({ ...c, private_key: '' }));
      fetchData();
    } catch {
      setCfgMsg('error');
    } finally {
      setSaving(false);
    }
  };

  const rows = mode === 'monthly' ? data?.months || [] : data?.days || [];
  const labels = rows.map((r) => (mode === 'monthly' ? fmtMonth(r.month || '') : fmtDay(r.date || '')));

  return createPortal(
    <div className={overlayCls} onClick={onClose}>
      <div className={`${panelCls} max-w-3xl`} onClick={(e) => e.stopPropagation()}>
        <ModalHeader
          icon={<span className="p-2 rounded-xl bg-emerald-50"><Globe className="w-4 h-4 text-emerald-600" /></span>}
          title={t('admin.browserModalTitle')}
          hint={t('admin.browserModalHint')}
          onClose={onClose}
        />

        <div className="p-5 overflow-y-auto space-y-5">
          {loading && !data && <div className="h-48 rounded-2xl bg-gray-50 animate-pulse" />}

          {/* NOT_CONFIGURED: konfiguratsiya formasi + yo'riqnoma */}
          {data?.status === 'NOT_CONFIGURED' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <p className="text-xs font-bold">{t('admin.gscNotConfigured')}</p>
              </div>
              <p className="text-[11px] text-amber-700 leading-relaxed">{t('admin.gscHint')}</p>
              <div className="space-y-2">
                <input
                  value={cfg.client_email}
                  onChange={(e) => setCfg({ ...cfg, client_email: e.target.value })}
                  placeholder="service-account@project.iam.gserviceaccount.com"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <input
                  value={cfg.site_url}
                  onChange={(e) => setCfg({ ...cfg, site_url: e.target.value })}
                  placeholder="https://tophand.uz/"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <textarea
                  value={cfg.private_key}
                  onChange={(e) => setCfg({ ...cfg, private_key: e.target.value })}
                  placeholder="-----BEGIN PRIVATE KEY----- ..."
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={saveCfg}
                    disabled={saving || !cfg.client_email || !cfg.site_url || !cfg.private_key}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    {t('admin.gscSave')}
                  </button>
                  {cfgMsg === 'saved' && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                      <CheckCircle className="w-3.5 h-3.5" /> {t('admin.gscSaved')}
                    </span>
                  )}
                  {cfgMsg === 'error' && <span className="text-[11px] font-bold text-red-600">{t('common.error')}</span>}
                </div>
              </div>
            </div>
          )}

          {/* ERROR holati */}
          {data?.status === 'ERROR' && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-800">{t('admin.gscError')}</p>
                <p className="text-[11px] text-red-700 mt-0.5 break-words">{data.error}</p>
              </div>
            </div>
          )}

          {/* OK: chiziqli grafiklar (impressions + clicks, bir vaqtda) */}
          {data?.status === 'OK' && (
            <>
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-2 gap-3 flex-1 mr-3">
                  <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-center">
                    <p className="text-xl font-black text-indigo-900">{data.totals.impressions.toLocaleString()}</p>
                    <span className="text-[10px] font-bold text-indigo-700 uppercase">{t('admin.impressions')}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                    <p className="text-xl font-black text-emerald-900">{data.totals.clicks.toLocaleString()}</p>
                    <span className="text-[10px] font-bold text-emerald-700 uppercase">{t('admin.browserClicks')}</span>
                  </div>
                </div>
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 cursor-pointer shrink-0"
                  title={t('admin.refresh')}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold text-gray-500 uppercase">
                  {mode === 'monthly' ? t('admin.last12Months') : t('admin.last30Days')}
                </p>
                <ViewToggle
                  mode={mode}
                  onChange={setMode}
                  dailyLabel={t('admin.dailyView')}
                  monthlyLabel={t('admin.monthlyView')}
                />
              </div>

              {rows.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-8">{t('admin.noDataYet')}</p>
              ) : (
                <>
                  {/* Impressions chiziqli grafigi (aniq sonlar bilan) */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-700 mb-2">
                      {mode === 'monthly' ? t('admin.impressionsByMonth') : t('admin.impressionsByDay')}
                    </h4>
                    <div className="rounded-2xl border border-gray-100 p-3">
                      <LineChart
                        labels={labels}
                        height={200}
                        showValues
                        series={[{ name: t('admin.impressions'), color: C.impressions, values: rows.map((r) => r.impressions) }]}
                      />
                    </div>
                  </div>

                  {/* Clicks chiziqli grafigi (aniq sonlar bilan) */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-700 mb-2">
                      {mode === 'monthly' ? t('admin.clicksByMonth') : t('admin.clicksByDay')}
                    </h4>
                    <div className="rounded-2xl border border-gray-100 p-3">
                      <LineChart
                        labels={labels}
                        height={200}
                        showValues
                        series={[{ name: t('admin.browserClicks'), color: C.clicks, values: rows.map((r) => r.clicks) }]}
                      />
                    </div>
                  </div>

                  {/* Top qidiruv so'zlari */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-700 mb-2">{t('admin.topQueriesTitle')}</h4>
                    {data.top_queries.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">{t('admin.noDataYet')}</p>
                    ) : (
                      <div className="rounded-2xl border border-gray-100 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 text-left text-[10px] uppercase font-bold text-gray-500">
                              <th className="px-3 py-2">{t('admin.queryCol')}</th>
                              <th className="px-3 py-2 text-right">{t('admin.impressions')}</th>
                              <th className="px-3 py-2 text-right">{t('admin.browserClicks')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.top_queries.slice(0, 20).map((q, i) => (
                              <tr key={q.query + i} className="border-t border-gray-50 hover:bg-gray-50/50">
                                <td className="px-3 py-1.5 font-semibold text-gray-800 break-words">{q.query}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-indigo-700">{q.impressions.toLocaleString()}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-emerald-700">{q.clicks.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {data.fetched_at && (
                    <p className="text-[10px] text-gray-400 text-right">
                      {t('admin.gscFetchedAt')}: {new Date(data.fetched_at).toLocaleString(intlLocale || undefined)}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
