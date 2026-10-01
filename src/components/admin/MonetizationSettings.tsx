import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api.ts';
import { DollarSign, Save, Loader2, CheckCircle2, Rocket, RefreshCw } from 'lucide-react';

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
}

const inputCls =
  'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500';

const fmtDateForInput = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

export const MonetizationSettings: React.FC = () => {
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
      setMsg({ type: 'err', text: err.message || 'Yuklashda xatolik' });
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
      };
      const res = await apiRequest<{ message?: string }>('/api/admin/monetization', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setMsg({ type: 'ok', text: res?.message || 'Saqlandi' });
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message || 'Saqlashda xatolik' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-xs gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Monetizatsiya sozlamalari yuklanmoqda...
      </div>
    );
  }

  if (!cfg) {
    return (
      <div className="p-6 text-center text-xs text-rose-600">
        Sozlamalarni yuklab bo‘lmadi.{' '}
        <button onClick={fetchCfg} className="underline font-bold cursor-pointer">
          Qayta urinish
        </button>
      </div>
    );
  }

  const isPaid = cfg.monetization_mode === 'PAID';

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-blue-600" />
        <h3 className="font-black text-sm text-gray-900">Monetizatsiya boshqaruvi</h3>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Mode + test end date */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1.5">Rejim</label>
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
                Bepul test
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
                Pullik
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              Test tugash sanasi kelgach platforma avtomatik pullik rejimga o‘tadi.
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1.5">Test tugash sanasi</label>
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
          <h4 className="text-xs font-bold text-gray-800 mb-2">Faol kunlar</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Test (bepul) davri</label>
              <input
                type="number"
                min={0}
                value={cfg.listing_active_days_free}
                onChange={(e) => patch({ listing_active_days_free: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Pullik davr</label>
              <input
                type="number"
                min={0}
                value={cfg.listing_active_days_paid}
                onChange={(e) => patch({ listing_active_days_paid: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Muddat ogohlantirishi (kun)</label>
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
            <DollarSign className="w-3.5 h-3.5 text-blue-600" /> Narxlar (so‘m, kategoriya bo‘yicha)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-gray-50/70 border border-gray-100 space-y-2.5">
              <span className="text-[11px] font-bold text-gray-700 block">Xizmatlar</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">E'lon</label>
                  <input type="number" min={0} value={cfg.listing_price_services}
                    onChange={(e) => patch({ listing_price_services: Number(e.target.value) })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Uzatish</label>
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
              <span className="text-[11px] font-bold text-gray-700 block">Ish e'lonlari</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">E'lon</label>
                  <input type="number" min={0} value={cfg.listing_price_jobs}
                    onChange={(e) => patch({ listing_price_jobs: Number(e.target.value) })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Uzatish</label>
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
              <RefreshCw className="w-3.5 h-3.5 text-gray-500" /> Uzatish pullik bo‘lsin
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
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> AI avto-tasdiqlash
            </span>
            <input
              type="checkbox"
              checked={cfg.auto_approve_enabled}
              onChange={(e) => patch({ auto_approve_enabled: e.target.checked })}
              className="w-4 h-4 accent-blue-600"
            />
          </label>
        </section>

        {/* Promo duration */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Rocket className="w-3.5 h-3.5 text-violet-600" />
            <h4 className="text-xs font-bold text-gray-800">Promo muddati (soat)</h4>
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
            <span>Saqlash</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonetizationSettings;
