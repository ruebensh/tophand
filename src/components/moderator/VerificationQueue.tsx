import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Loader2, Check, X, ExternalLink, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../lib/api.ts';

interface VerificationRequest {
  id: string;
  name: string;
  profile_photo_url?: string | null;
  full_legal_name?: string | null;
  birth_date?: string | null;
  pinfl?: string | null;
  passport_series?: string | null;
  passport_number?: string | null;
  passport_issued_by?: string | null;
  passport_issued_date?: string | null;
  verification_photo_url?: string | null;
  verification_status: string;
  verification_rejection_reason?: string | null;
  region_name?: string | null;
  created_at?: string;
  active_listing_count?: number;
}

const STATUS_OPTIONS = [
  { id: 'PENDING', label: 'Ko‘rib chiqilishi kerak' },
  { id: 'VERIFIED', label: 'Tasdiqlanganlar' },
  { id: 'REJECTED', label: 'Rad etilganlar' },
];

export const VerificationQueue: React.FC = () => {
  const [status, setStatus] = useState<string>('PENDING');
  const [list, setList] = useState<VerificationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<VerificationRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setIsLoading(true);
    setActionError('');
    try {
      const data = await apiRequest<VerificationRequest[]>(`/api/moderation/verifications?status=${status}`);
      setList(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setActionError(err.message || 'Navbatni yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleApprove = async (target: VerificationRequest) => {
    if (!confirm(`${target.full_legal_name || target.name} foydalanuvchisini tasdiqlaysizmi?`)) return;
    setBusyId(target.id);
    setActionError('');
    try {
      await apiRequest(`/api/moderation/verifications/${target.id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: 'APPROVE' }),
      });
      setList((prev) => prev.filter((u) => u.id !== target.id));
    } catch (err: any) {
      setActionError(err.message || 'Tasdiqlashda xatolik');
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (target: VerificationRequest) => {
    setRejectTarget(target);
    setRejectReason('');
  };

  const submitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    setIsSubmitting(true);
    setActionError('');
    try {
      await apiRequest(`/api/moderation/verifications/${rejectTarget.id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: 'REJECT', rejection_reason: rejectReason.trim() || undefined }),
      });
      setList((prev) => prev.filter((u) => u.id !== rejectTarget.id));
      setRejectTarget(null);
    } catch (err: any) {
      setActionError(err.message || 'Rad etishda xatolik');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs">
        <div>
          <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Tasdiq nishoni arizalari</span>
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Foydalanuvchilar yuborgan pasport ma’lumotlari. Tekshirib, tasdiqlang yoki rad eting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-gray-200 bg-white px-3 py-1.5 rounded-xl text-xs font-medium text-gray-700 focus:outline-hidden focus:border-blue-500 cursor-pointer"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={fetchList}
            className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 cursor-pointer"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium">{actionError}</div>
      )}

      {isLoading && list.length === 0 ? (
        <div className="py-16 flex justify-center text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400 bg-white rounded-2xl border border-gray-100">
          Ushbu holatda ariza topilmadi.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {list.map((u) => (
            <div key={u.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-2xs flex flex-col">
              {/* User header */}
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={u.profile_photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name || 'U')}`}
                  alt={u.name}
                  className="w-11 h-11 rounded-xl object-cover border border-gray-100 shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-bold text-sm text-gray-900 truncate">{u.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {u.region_name || 'Hudud ko‘rsatilmagan'} · {u.active_listing_count || 0} ta faol e’lon
                  </p>
                </div>
              </div>

              {/* Passport data */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] bg-gray-50/70 rounded-xl p-3 border border-gray-100 mb-3">
                <Field label="To‘liq ism" value={u.full_legal_name} span />
                <Field label="PINFL" value={u.pinfl} />
                <Field label="Tav. sanasi" value={u.birth_date} />
                <Field label="Pasport" value={`${u.passport_series || ''} ${u.passport_number || ''}`.trim()} />
                <Field label="Berilgan" value={u.passport_issued_date} />
                {u.passport_issued_by && <Field label="Kim bergan" value={u.passport_issued_by} span />}
                {u.verification_status === 'REJECTED' && u.verification_rejection_reason && (
                  <div className="col-span-2 text-rose-600">
                    <span className="font-semibold">Rad sababi: </span>
                    {u.verification_rejection_reason}
                  </div>
                )}
              </div>

              {/* Verification photo */}
              {u.verification_photo_url && (
                <a
                  href={u.verification_photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block rounded-xl overflow-hidden border border-gray-200 mb-3 bg-gray-50"
                >
                  <img src={u.verification_photo_url} alt="Hujjat" className="w-full h-36 object-cover" />
                  <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-[10px] font-bold text-white bg-black/55 px-2 py-1 rounded-lg">
                    <ExternalLink className="w-3 h-3" /> Rasmi ochish
                  </span>
                </a>
              )}

              {/* Actions */}
              <div className="mt-auto flex items-center gap-2">
                {u.verification_status === 'PENDING' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => openReject(u)}
                      className="flex-1 h-10 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 font-bold text-xs flex items-center justify-center gap-1.5 active:bg-rose-100 cursor-pointer"
                    >
                      <X className="w-4 h-4" /> Rad etish
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(u)}
                      disabled={busyId === u.id}
                      className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
                    >
                      {busyId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Tasdiqlash
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setStatus('PENDING'); }}
                    className="w-full h-10 rounded-xl border border-gray-200 text-gray-600 font-semibold text-xs hover:bg-gray-50 cursor-pointer"
                  >
                    Ko‘rib chiqilgan — navbatga qaytish
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/45"
          onClick={() => setRejectTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] shadow-xl p-6 sm:p-8 pb-[calc(24px+env(safe-area-inset-bottom))]"
          >
            <h3 className="text-lg font-bold text-gray-950 mb-1">Arizani rad etish</h3>
            <p className="text-xs text-gray-500 mb-4">
              <span className="font-semibold text-gray-700">{rejectTarget.full_legal_name || rejectTarget.name}</span> uchun
              rad sababini kiriting (foydalanuvchiga xabar beriladi).
            </p>
            <form onSubmit={submitReject} className="space-y-4">
              <textarea
                rows={3}
                autoFocus
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Masalan: Pasport rasmi noaniq / ma’lumotlar mos kelmadi"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-base focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="flex-1 h-11 rounded-xl text-gray-700 text-sm font-semibold hover:bg-gray-100 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold disabled:opacity-60 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Rad etish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; value?: string | null; span?: boolean }> = ({ label, value, span }) => (
  <div className={span ? 'col-span-2' : ''}>
    <span className="block text-gray-400 font-semibold uppercase tracking-wide text-[9px]">{label}</span>
    <span className="block text-gray-800 font-medium break-words">{value || '—'}</span>
  </div>
);

export default VerificationQueue;
