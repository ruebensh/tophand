import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api.ts';
import { DollarSign, Save, Loader2, CheckCircle2, Rocket, RefreshCw, Megaphone } from 'lucide-react';
import { useI18n } from '../../i18n/IntlContext.tsx';

/** Shape returned by GET /api/admin/monetization (MonetizationConfig). */
interface AdminMonetizationConfig {
  monetization_mode: 'FREE_TEST' | 'PAID';
  free_test_end_date: string;
  listing_active_days_free: number;
  listing_active_days_paid: number;
  expiry_warning_days: number;
  listing_price_services: number;
  listing_price_jobs: number;
  renew_enabled_paid: boolean;
  renew_price_services: number;
  renew_price_jobs: number;
  promo_price_services: number;
  promo_price_jobs: number;
  promo_duration_hours: number;
  auto_approve_enabled: boolean;
  ads_enabled: boolean;
  ads_top_enabled: boolean;
  ads_popular_enabled: boolean;
  ads_inline_enabled: boolean;
  ads_sidebar_enabled: boolean;
  ads_inline_every: number;
}

const inputCls =
  'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500';

const fmtDateForInput = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

/** Reklama joylashuvi uchun kichik toggle (master o'chiq bo'lsa — nolij). */
const AdToggle: React.FC<{
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, hint, checked, disabled, onChange }) => (
  <label
    className={`flex items-start justify-between gap-3 p-3 rounded-2xl border transition-colors ${
      disabled ? 'bg-gray-50/50 border-gray-100 opacity-50 cursor-not-allowed' : 'cursor-pointer'
    } ${checked && !disabled ? 'bg-blue-50/60 border-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
  >
    <span className="min-w-0">
      <span className="block text-xs font-bold text-gray-800">{label}</span>
      <span className="block text-[11px] text-gray-400 mt-0.5">{hint}</span>
    </span>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 mt-0.5 accent-blue-600 shrink-0"
    />
  </label>
);

export const MonetizationSettings: React.FC = () => {
  const { t } = useI18n();
  const [cfg, setCfg] = useState<AdminMonetizationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const fetchCfg = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<AdminMonetizationConfig>('/api/admin/monetization');
      setCfg(data);
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message || t('admin.mnsLoadErr') });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCfg();
  }, []);

  const patch = (partial: Partial<AdminMonetizationConfig>) =>
    setCfg((prev) => (prev ? { ...prev, ...partial } : prev));

  const handleSave = async () => {
    if (!cfg) return;
    setIsSaving(true);
    setMsg(null);
    try {
      const body: Record<string, any> = {
        monetization_mode: cfg.monetization_mode,
        free_test_end_date: cfg.free_test_end_date,
        listing_active_days_free: cfg.listing_active_days_free,
        listing_active_days_paid: cfg.listing_active_days_paid,
        expiry_warning_days: cfg.expiry_warning_days,
        listing_price_services: cfg.listing_price_services,
        listing_price_jobs: cfg.listing_price_jobs,
        renew_enabled_paid: cfg.renew_enabled_paid,
        renew_price_services: cfg.renew_price_services,
        renew_price_jobs: cfg.renew_price_jobs,
        promo_price_services: cfg.promo_price_services,
        promo_price_jobs: cfg.promo_price_jobs,
        promo_duration_hours: cfg.promo_duration_hours,
        auto_approve_enabled: cfg.auto_approve_enabled,
        ads_enabled: cfg.ads_enabled,
        ads_top_enabled: cfg.ads_top_enabled,
        ads_popular_enabled: cfg.ads_popular_enabled,
        ads_inline_enabled: cfg.ads_inline_enabled,
        ads_sidebar_enabled: cfg.ads_sidebar_enabled,
        ads_inline_every: cfg.ads_inline_every,
      };
      const res = await apiRequest<{ message?: string }>('/api/admin/monetization', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setMsg({ type: 'ok', text: res?.message || t('admin.mnsSaved') });
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message || t('admin.mnsSaveErr') });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-xs gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> {t('admin.mnsLoading')}
      </div>
    );
  }

  if (!cfg) {
    return (
      <div className="p-6 text-center text-xs text-rose-600">
        {t('admin.mnsLoadFail')}{' '}
        <button onClick={fetchCfg} className="underline font-bold cursor-pointer">
          {t('admin.mnsRetry')}
        </button>
      </div>
    );
  }

  const isPaid = cfg.monetization_mode === 'PAID';

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-blue-600" />
        <h3 className="font-black text-sm text-gray-900">{t('admin.mnsTitle')}</h3>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Mode + test end date */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1.5">{t('admin.mnsModeLabel')}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => patch({ monetization_mode: 'FREE_TEST' })}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  !isPaid
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {t('admin.mnsFreeTest')}
              </button>
              <button
                type="button"
                onClick={() => patch({ monetization_mode: 'PAID' })}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isPaid
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {t('admin.mnsPaid')}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              {t('admin.mnsModeHint')}
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1.5">{t('admin.mnsTestEndDate')}</label>
            <input
              type="date"
              value={fmtDateForInput(cfg.free_test_end_date)}
              onChange={(e) => {
                const d = new Date(e.target.value);
                if (!isNaN(d.getTime())) patch({ free_test_end_date: d.toISOString() });
              }}
              className={inputCls}
            />
          </div>
        </section>

        {/* Active days */}
        <section>
          <h4 className="text-xs font-bold text-gray-800 mb-2">{t('admin.mnsActiveDays')}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">{t('admin.mnsFreePeriod')}</label>
              <input
                type="number"
                min={0}
                value={cfg.listing_active_days_free}
                onChange={(e) => patch({ listing_active_days_free: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">{t('admin.mnsPaidPeriod')}</label>
              <input
                type="number"
                min={0}
                value={cfg.listing_active_days_paid}
                onChange={(e) => patch({ listing_active_days_paid: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">{t('admin.mnsExpiryWarn')}</label>
              <input
                type="number"
                min={0}
                value={cfg.expiry_warning_days}
                onChange={(e) => patch({ expiry_warning_days: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
          </div>
        </section>

        {/* Prices */}
        <section>
          <h4 className="text-xs font-bold text-gray-800 mb-2 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-blue-600" /> {t('admin.mnsPrices')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-gray-50/70 border border-gray-100 space-y-2.5">
              <span className="text-[11px] font-bold text-gray-700 block">{t('admin.mnsServices')}</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">{t('admin.mnsListing')}</label>
                  <input type="number" min={0} value={cfg.listing_price_services}
                    onChange={(e) => patch({ listing_price_services: Number(e.target.value) })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">{t('admin.mnsRenew')}</label>
                  <input type="number" min={0} value={cfg.renew_price_services}
                    onChange={(e) => patch({ renew_price_services: Number(e.target.value) })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Promo</label>
                  <input type="number" min={0} value={cfg.promo_price_services}
                    onChange={(e) => patch({ promo_price_services: Number(e.target.value) })} className={inputCls} />
                </div>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-gray-50/70 border border-gray-100 space-y-2.5">
              <span className="text-[11px] font-bold text-gray-700 block">{t('admin.mnsJobs')}</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">{t('admin.mnsListing')}</label>
                  <input type="number" min={0} value={cfg.listing_price_jobs}
                    onChange={(e) => patch({ listing_price_jobs: Number(e.target.value) })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">{t('admin.mnsRenew')}</label>
                  <input type="number" min={0} value={cfg.renew_price_jobs}
                    onChange={(e) => patch({ renew_price_jobs: Number(e.target.value) })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Promo</label>
                  <input type="number" min={0} value={cfg.promo_price_jobs}
                    onChange={(e) => patch({ promo_price_jobs: Number(e.target.value) })} className={inputCls} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Toggles */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/70 border border-gray-100 cursor-pointer">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-gray-500" /> {t('admin.mnsRenewPaid')}
            </span>
            <input
              type="checkbox"
              checked={cfg.renew_enabled_paid}
              onChange={(e) => patch({ renew_enabled_paid: e.target.checked })}
              className="w-4 h-4 accent-blue-600"
            />
          </label>
          <label className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/70 border border-gray-100 cursor-pointer">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {t('admin.mnsAiAuto')}
            </span>
            <input
              type="checkbox"
              checked={cfg.auto_approve_enabled}
              onChange={(e) => patch({ auto_approve_enabled: e.target.checked })}
              className="w-4 h-4 accent-blue-600"
            />
          </label>
        </section>

        {/* Reklama joylashuvlarini ochish/yopish */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5">
            <Megaphone className="w-3.5 h-3.5 text-blue-600" />
            <h4 className="text-xs font-bold text-gray-800">{t('admin.mnsAdSlots')}</h4>
          </div>

          <label
            className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${
              cfg.ads_enabled ? 'bg-blue-600 border-blue-600' : 'bg-gray-50/70 border-gray-200'
            }`}
          >
            <span className={`text-xs font-bold ${cfg.ads_enabled ? 'text-white' : 'text-gray-800'}`}>
              {t('admin.mnsAdsEnableAll')}
            </span>
            <input
              type="checkbox"
              checked={cfg.ads_enabled}
              onChange={(e) => patch({ ads_enabled: e.target.checked })}
              className="w-4 h-4 accent-blue-600"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <AdToggle
              label={t('admin.mnsAdTop')}
              hint={t('admin.mnsAdTopHint')}
              checked={cfg.ads_top_enabled}
              disabled={!cfg.ads_enabled}
              onChange={(v) => patch({ ads_top_enabled: v })}
            />
            <AdToggle
              label={t('admin.mnsAdPopular')}
              hint={t('admin.mnsAdPopularHint')}
              checked={cfg.ads_popular_enabled}
              disabled={!cfg.ads_enabled}
              onChange={(v) => patch({ ads_popular_enabled: v })}
            />
            <AdToggle
              label={t('admin.mnsAdInline')}
              hint={t('admin.mnsAdInlineHint')}
              checked={cfg.ads_inline_enabled}
              disabled={!cfg.ads_enabled}
              onChange={(v) => patch({ ads_inline_enabled: v })}
            />
            <AdToggle
              label={t('admin.mnsAdSidebar')}
              hint={t('admin.mnsAdSidebarHint')}
              checked={cfg.ads_sidebar_enabled}
              disabled={!cfg.ads_enabled}
              onChange={(v) => patch({ ads_sidebar_enabled: v })}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">
              {t('admin.mnsAdEvery')}
            </label>
            <input
              type="number"
              min={1}
              value={cfg.ads_inline_every}
              disabled={!cfg.ads_enabled || !cfg.ads_inline_enabled}
              onChange={(e) => patch({ ads_inline_every: Math.max(1, Number(e.target.value) || 1) })}
              className={`${inputCls} sm:max-w-[200px] disabled:opacity-50`}
            />
          </div>

          <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            {t('admin.mnsAdNote')}
          </p>
        </section>

        {/* Promo duration */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Rocket className="w-3.5 h-3.5 text-violet-600" />
            <h4 className="text-xs font-bold text-gray-800">{t('admin.mnsPromoDuration')}</h4>
          </div>
          <input
            type="number"
            min={0}
            value={cfg.promo_duration_hours}
            onChange={(e) => patch({ promo_duration_hours: Number(e.target.value) })}
            className={`${inputCls} sm:max-w-[200px]`}
          />
        </section>

        {msg && (
          <div
            className={`p-3 rounded-2xl text-xs font-semibold ${
              msg.type === 'ok'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-rose-50 border border-rose-200 text-rose-700'
            }`}
          >
            {msg.text}
          </div>
        )}

        <div className="flex items-center justify-end pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{t('common.save')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonetizationSettings;
