import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../lib/api.ts';
import { useI18n } from '../../i18n/IntlContext.tsx';
import { Inbox, Hand, CheckCircle2, EyeOff, Trash2, ArrowUpCircle, RefreshCw, ExternalLink } from 'lucide-react';

interface TaskRow {
  id: string;
  title: string;
  status: string;
  type: string;
  priority: string;
  review_status: string;
  claimed_at?: string;
  sla_due_at?: string;
  created_at: string;
  owner_name?: string;
  category_name?: string;
}

const PRIORITY_STYLE: Record<string, string> = {
  P0: 'bg-rose-100 text-rose-800 border-rose-200',
  P1: 'bg-orange-100 text-orange-800 border-orange-200',
  P2: 'bg-amber-100 text-amber-800 border-amber-200',
  P3: 'bg-gray-100 text-gray-600 border-gray-200',
};

function slaLabel(due?: string): { hrs: number; overdue: boolean; danger: boolean } | null {
  if (!due) return null;
  const ms = new Date(due).getTime() - Date.now();
  const hrs = Math.round(ms / 3_600_000);
  if (ms <= 0) return { hrs: Math.abs(hrs), overdue: true, danger: true };
  return { hrs, overdue: false, danger: hrs < 4 };
}

export const ModerationQueue: React.FC<{ onOpenListing: (id: string) => void }> = ({ onOpenListing }) => {
  const { t } = useI18n();
  const [view, setView] = useState<'mine' | 'pool'>('mine');
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const url = view === 'mine' ? '/api/moderation/queue/mine' : '/api/moderation/queue/pool';
      const data = await apiRequest<TaskRow[]>(url);
      setRows(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const act = async (id: string, path: string, body?: any) => {
    try {
      await apiRequest(`/api/moderation/queue/${id}/${path}`, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
      fetchQueue();
    } catch (err: any) {
      alert(err.message || t('mod.mqErrAction'));
    }
  };

  const resolve = (id: string, action: 'APPROVE' | 'HIDE' | 'REMOVE') => {
    const reason = reasons[id] || '';
    act(id, 'resolve', { action, reason });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs">
        <div className="flex items-center gap-2">
          <Inbox className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-bold text-sm text-gray-900">{t('mod.mqTitle')}</h3>
            <p className="text-[11px] text-gray-500">{t('mod.mqSub')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl border border-gray-200 text-xs font-bold">
          <button onClick={() => setView('mine')} className={`px-3 py-1.5 rounded-lg cursor-pointer ${view === 'mine' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600'}`}>{t('mod.mqMine')}</button>
          <button onClick={() => setView('pool')} className={`px-3 py-1.5 rounded-lg cursor-pointer ${view === 'pool' ? 'bg-white text-amber-600 shadow-xs' : 'text-gray-600'}`}>{t('mod.mqPool')}</button>
          <button onClick={fetchQueue} className="px-2 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 cursor-pointer"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        {rows.length === 0 && !loading && (
          <div className="p-12 text-center text-xs text-gray-400">{t('mod.mqEmpty')}</div>
        )}
        <div className="divide-y divide-gray-100">
          {rows.map((r) => {
            const sla = slaLabel(r.sla_due_at);
            return (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${PRIORITY_STYLE[r.priority] || PRIORITY_STYLE.P2}`}>{r.priority}</span>
                    <span className="font-bold text-sm text-gray-900 truncate">{r.title}</span>
                    <button onClick={() => onOpenListing(r.id)} className="text-blue-600 hover:underline inline-flex items-center gap-0.5 text-[11px] cursor-pointer"><ExternalLink className="w-3 h-3" /> {t('mod.mqOpen')}</button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {r.category_name || '—'} · {r.owner_name || '—'} · {t('mod.mqStatus')}: {r.status}
                    {r.review_status === 'ESCALATED' && <span className="ml-1 text-rose-600 font-bold">({t('mod.mqEscalated')})</span>}
                  </p>
                  {sla && <span className={`inline-block mt-1 text-[10px] font-bold ${sla.danger ? 'text-rose-600' : 'text-gray-500'}`}>⏱ {sla.overdue ? t('mod.slaOverdue', { n: sla.hrs }) : t('mod.slaLeft', { n: sla.hrs })}</span>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {view === 'pool' ? (
                    <button onClick={() => act(r.id, 'claim')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] cursor-pointer">
                      <Hand className="w-3.5 h-3.5" /> {t('mod.mqClaim')}
                    </button>
                  ) : (
                    <>
                      <input value={reasons[r.id] || ''} onChange={(e) => setReasons((p) => ({ ...p, [r.id]: e.target.value }))} placeholder={t('mod.mqReasonPh')} className="hidden sm:block w-36 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[11px]" />
                      <button onClick={() => resolve(r.id, 'APPROVE')} title={t('common.confirm')} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 cursor-pointer"><CheckCircle2 className="w-4 h-4" /></button>
                      <button onClick={() => resolve(r.id, 'HIDE')} title={t('mod.mqHide')} className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 cursor-pointer"><EyeOff className="w-4 h-4" /></button>
                      <button onClick={() => resolve(r.id, 'REMOVE')} title={t('common.delete')} className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      <button onClick={() => act(r.id, 'escalate', { reason: reasons[r.id] || t('mod.mqLeadReason') })} title={t('mod.mqEscalate')} className="p-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 cursor-pointer"><ArrowUpCircle className="w-4 h-4" /></button>
                      <button onClick={() => act(r.id, 'release')} title={t('mod.mqReleaseTip')} className="px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-[11px] font-bold hover:bg-gray-50 cursor-pointer">{t('mod.mqRelease')}</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ModerationQueue;
