import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../lib/api.ts';
import { useI18n } from '../i18n/IntlContext.tsx';
import {
  Shield,
  ArrowLeft,
  BarChart3,
  Users as UsersIcon,
  Building2,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface LeadUser {
  id: string;
  name: string;
  telegram_username?: string | null;
  role: string;
  verification_status?: string;
  is_banned?: number | boolean;
  ban_type?: string | null;
  region_name?: string | null;
  listings_count?: number;
}

interface LeadOrg {
  id: string;
  name: string;
  verification_status: string;
  owner_name?: string;
}

interface PersonalStats {
  window_days: number;
  totals: {
    total: number;
    approvals: number;
    removals: number;
    bans: number;
    role_changes: number;
    verifications: number;
  };
  series: { day: string; count: number }[];
}

interface TeamRow {
  id: string;
  name: string;
  role: string;
  total: number;
  approvals: number;
  removals: number;
  bans: number;
  verifications: number;
}

// Bosh moderator (LEAD_MOD) uchun alohida panel. Admin panelidagi taqiqlangan
// bo'limlar (platforma, kategoriyalar, filtrlar, monetizatsiya, reklamalar,
// audit, Excel) BU YERDA YO'Q. Faqat: skoplangan statistika, foydalanuvchilar
// (ban/moderator tayinlash) va tashkilotlar tasdigi. Kundalik moderatsiya
// navbati `/moderator` panelida (LEAD_MOD MODERATOR darajasidan yuqori).
export const ChiefModeratorPage: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<'stats' | 'users' | 'organizations'>('stats');

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/')}
            className="p-2 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-500 cursor-pointer"
            title={t('admin.backHome')}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-fuchsia-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-950">{t('admin.leadPanelTitle')}</h1>
              <p className="text-xs text-gray-500">{t('admin.leadPanelSub')}</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => onNavigate('/moderator')}
          className="px-3.5 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold transition-colors cursor-pointer"
        >
          {t('admin.leadToModPanel')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 mb-6 overflow-x-auto pb-1">
        {[
          { id: 'stats', label: t('admin.leadTabStats'), icon: BarChart3 },
          { id: 'users', label: t('admin.leadTabUsers'), icon: UsersIcon },
          { id: 'organizations', label: t('admin.leadTabOrgs'), icon: Building2 },
        ].map((tb) => {
          const Icon = tb.icon;
          const active = tab === tb.id;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id as any)}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors shrink-0 cursor-pointer ${
                active ? 'border-fuchsia-600 text-fuchsia-600' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tb.label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'stats' && <StatsSection />}
      {tab === 'users' && <UsersSection />}
      {tab === 'organizations' && <OrganizationsSection />}
    </div>
  );
};

// ─── Statistika (shaxsiy + jamoa, tab'lar bilan) ──────────────────────────
const StatsSection: React.FC = () => {
  const { t } = useI18n();
  const [mode, setMode] = useState<'mine' | 'team'>('mine');
  const [mine, setMine] = useState<PersonalStats | null>(null);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === 'mine') setMine(await apiRequest<PersonalStats>('/api/lead/stats/mine'));
      else setTeam(await apiRequest<TeamRow[]>('/api/lead/stats/team'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = mine
    ? [
        { label: t('admin.leadStatTotal'), value: mine.totals.total },
        { label: t('admin.leadStatApprovals'), value: mine.totals.approvals },
        { label: t('admin.leadStatRemovals'), value: mine.totals.removals },
        { label: t('admin.leadStatBans'), value: mine.totals.bans },
        { label: t('admin.leadStatRoles'), value: mine.totals.role_changes },
        { label: t('admin.leadStatVerifs'), value: mine.totals.verifications },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-full border border-gray-200 p-1 bg-white">
          <button
            onClick={() => setMode('mine')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer ${mode === 'mine' ? 'bg-fuchsia-600 text-white' : 'text-gray-600'}`}
          >
            {t('admin.leadStatsMine')}
          </button>
          <button
            onClick={() => setMode('team')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer ${mode === 'team' ? 'bg-fuchsia-600 text-white' : 'text-gray-600'}`}
          >
            {t('admin.leadStatsTeam')}
          </button>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> {t('admin.teamRefresh')}
        </button>
      </div>

      <p className="text-[11px] text-gray-400">{t('admin.leadWindow30')}</p>

      {mode === 'mine' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {cards.map((c) => (
            <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-xs p-4">
              <div className="text-2xl font-bold text-gray-950">{c.value}</div>
              <div className="text-[11px] text-gray-500 mt-1">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {mode === 'team' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase">
                <tr>
                  <th className="p-3">{t('admin.thUser')}</th>
                  <th className="p-3">{t('admin.thRole')}</th>
                  <th className="p-3">{t('admin.leadStatTotal')}</th>
                  <th className="p-3">{t('admin.leadStatApprovals')}</th>
                  <th className="p-3">{t('admin.leadStatRemovals')}</th>
                  <th className="p-3">{t('admin.leadStatBans')}</th>
                  <th className="p-3">{t('admin.leadStatVerifs')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {team.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-400">{loading ? '…' : t('admin.leadNoData')}</td></tr>
                )}
                {team.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/60">
                    <td className="p-3 font-bold text-gray-900">{r.name}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[10px] font-bold">{r.role}</span></td>
                    <td className="p-3 font-bold">{r.total}</td>
                    <td className="p-3">{r.approvals}</td>
                    <td className="p-3">{r.removals}</td>
                    <td className="p-3">{r.bans}</td>
                    <td className="p-3">{r.verifications}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Foydalanuvchilar: ban/unban + moderator tayinlash ────────────────────
const STAFF_MANAGEABLE = ['USER', 'INTERN_MOD', 'MODERATOR'];

const UsersSection: React.FC = () => {
  const { t } = useI18n();
  const [rows, setRows] = useState<LeadUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const qs = q.trim() ? `?search=${encodeURIComponent(q.trim())}` : '';
      setRows(await apiRequest<LeadUser[]>(`/api/lead/users${qs}`));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('');
  }, [load]);

  const setRole = async (id: string, role: string) => {
    if (!confirm(t('admin.roleChangeConfirm', { role }))) return;
    try {
      await apiRequest(`/api/lead/users/${id}/role`, { method: 'POST', body: JSON.stringify({ role }) });
      alert(t('admin.roleUpdated'));
      load(search);
    } catch (err: any) {
      alert(err.message || t('common.error'));
    }
  };

  const toggleBan = async (u: LeadUser) => {
    try {
      if (u.is_banned) {
        await apiRequest(`/api/lead/users/${u.id}/unban`, { method: 'POST' });
      } else {
        const reason = window.prompt(t('admin.banReasonPrompt'));
        if (!reason) return;
        await apiRequest(`/api/lead/users/${u.id}/ban`, { method: 'POST', body: JSON.stringify({ reason }) });
      }
      load(search);
    } catch (err: any) {
      alert(err.message || t('common.error'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(search)}
          placeholder={t('common.search')}
          className="flex-1 text-sm outline-none bg-transparent"
        />
        <button onClick={() => load(search)} className="px-3 py-1.5 rounded-full bg-fuchsia-600 text-white text-xs font-bold cursor-pointer">{t('common.search')}</button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase">
              <tr>
                <th className="p-3">{t('admin.thUser')}</th>
                <th className="p-3">Telegram</th>
                <th className="p-3">{t('admin.thRole')}</th>
                <th className="p-3">{t('admin.thStatus')}</th>
                <th className="p-3 text-right">{t('admin.thActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">{loading ? '…' : t('admin.usersEmpty')}</td></tr>
              )}
              {rows.map((u) => {
                const manageable = STAFF_MANAGEABLE.includes(u.role);
                return (
                  <tr key={u.id} className="hover:bg-gray-50/60">
                    <td className="p-3">
                      <span className="font-bold text-gray-900 block">{u.name}</span>
                      <span className="text-[10px] text-gray-400 font-mono">ID: {u.id}</span>
                    </td>
                    <td className="p-3 font-mono text-[11px]">{u.telegram_username ? `@${u.telegram_username}` : '—'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${u.role === 'LEAD_MOD' ? 'bg-fuchsia-100 text-fuchsia-800' : u.role === 'MODERATOR' ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'}`}>{u.role}</span>
                    </td>
                    <td className="p-3">
                      {u.is_banned ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">{u.ban_type} BAN</span>
                      ) : (
                        <span className="text-emerald-600 font-bold text-[10px]">{t('status.active')}</span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      {manageable && u.role === 'USER' && (
                        <>
                          <button onClick={() => setRole(u.id, 'MODERATOR')} className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-[11px] font-bold cursor-pointer">{t('admin.leadAppointMod')}</button>
                          <button onClick={() => setRole(u.id, 'INTERN_MOD')} className="px-2.5 py-1 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 text-[11px] font-medium cursor-pointer">{t('admin.leadAppointIntern')}</button>
                        </>
                      )}
                      {manageable && u.role === 'INTERN_MOD' && (
                        <>
                          <button onClick={() => setRole(u.id, 'MODERATOR')} className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-[11px] font-bold cursor-pointer">{t('admin.leadAppointMod')}</button>
                          <button onClick={() => setRole(u.id, 'USER')} className="px-2.5 py-1 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 text-[11px] font-medium cursor-pointer">{t('admin.leadRevokeToUser')}</button>
                        </>
                      )}
                      {manageable && u.role === 'MODERATOR' && (
                        <button onClick={() => setRole(u.id, 'USER')} className="px-2.5 py-1 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 text-[11px] font-medium cursor-pointer">{t('admin.leadRevokeToUser')}</button>
                      )}
                      {manageable && (
                        <button onClick={() => toggleBan(u)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${u.is_banned ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'}`}>
                          {u.is_banned ? t('admin.unbanBtn') : t('admin.banBtn')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── Tashkilotlar tasdigi ─────────────────────────────────────────────────
const OrganizationsSection: React.FC = () => {
  const { t } = useI18n();
  const [rows, setRows] = useState<LeadOrg[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await apiRequest<LeadOrg[]>('/api/lead/organizations'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleVerify = async (o: LeadOrg) => {
    const nextVerify = o.verification_status !== 'VERIFIED';
    try {
      await apiRequest(`/api/lead/organizations/${o.id}/verify`, { method: 'POST', body: JSON.stringify({ verify: nextVerify }) });
      load();
    } catch (err: any) {
      alert(err.message || t('common.error'));
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase">
            <tr>
              <th className="p-3">{t('admin.thOrg') || t('admin.leadTabOrgs')}</th>
              <th className="p-3">{t('admin.thOwner')}</th>
              <th className="p-3">{t('admin.thStatus')}</th>
              <th className="p-3 text-right">{t('admin.thActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-gray-400">{loading ? '…' : t('admin.leadNoData')}</td></tr>
            )}
            {rows.map((o) => {
              const verified = o.verification_status === 'VERIFIED';
              return (
                <tr key={o.id} className="hover:bg-gray-50/60">
                  <td className="p-3 font-bold text-gray-900">{o.name}</td>
                  <td className="p-3 text-gray-500">{o.owner_name || '—'}</td>
                  <td className="p-3">
                    {verified ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold"><CheckCircle2 className="w-3 h-3" />{t('admin.badgeVerified')}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold"><XCircle className="w-3 h-3" />{o.verification_status}</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => toggleVerify(o)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${verified ? 'border border-gray-200 text-gray-700 hover:bg-gray-100' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
                      {verified ? t('admin.orgUnverified') : t('admin.orgVerified')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ChiefModeratorPage;
