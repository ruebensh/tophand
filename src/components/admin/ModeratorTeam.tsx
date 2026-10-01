import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../lib/api.ts';
import { Users2, RefreshCw, Save, MessageSquare, CheckCircle2, XCircle } from 'lucide-react';

interface ModeratorRow {
  id: string;
  name: string;
  role: string;
  telegram_username?: string;
  level: string;
  max_open_tasks: number;
  specialty_catalogs: string[];
  regions: string[];
  langs: string[];
  can_message_users: boolean;
  is_active: boolean;
  open_tasks: number;
}

const LEVELS = ['INTERN_MOD', 'MODERATOR', 'LEAD_MOD'];

export const ModeratorTeam: React.FC = () => {
  const [rows, setRows] = useState<ModeratorRow[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [mods, st] = await Promise.all([
        apiRequest<ModeratorRow[]>('/api/moderation/moderators'),
        apiRequest<any[]>('/api/moderation/moderators/stats').catch(() => []),
      ]);
      setRows(mods || []);
      setStats(st || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const patchRow = (id: string, patch: Partial<ModeratorRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = async (row: ModeratorRow) => {
    try {
      await apiRequest(`/api/moderation/moderators/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          level: row.level,
          max_open_tasks: Number(row.max_open_tasks),
          specialty_catalogs: row.specialty_catalogs || [],
          regions: row.regions || [],
          langs: row.langs || [],
          can_message_users: !!row.can_message_users,
          is_active: !!row.is_active,
        }),
      });
      alert('Saqlandi');
    } catch (err: any) {
      alert(err.message || 'Saqlashda xatolik');
    }
  };

  const statFor = (id: string) => stats.find((s) => s.moderator_id === id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs">
        <div className="flex items-center gap-2">
          <Users2 className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-bold text-sm text-gray-900">Jamoa va moderatsiya taqsimoti</h3>
            <p className="text-[11px] text-gray-500">Moderator darajalari, ish hajmi (capacity), ixtisoslik va xabar yuborish ruxsati</p>
          </div>
        </div>
        <button onClick={fetchAll} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Yangilash
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase">
              <tr>
                <th className="p-3">Moderator</th>
                <th className="p-3">Daraja</th>
                <th className="p-3">Max ochiq</th>
                <th className="p-3">Hozirgi</th>
                <th className="p-3">Ixtisoslik (catalog)</th>
                <th className="p-3">Hududlar</th>
                <th className="p-3">Xabar</th>
                <th className="p-3">Faol</th>
                <th className="p-3">Hal qilingan</th>
                <th className="p-3 text-right">Saqlash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && (
                <tr><td colSpan={10} className="p-8 text-center text-gray-400">{loading ? 'Yuklanmoqda...' : 'Moderatorlar yoq. Avval rol bering.'}</td></tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/60">
                  <td className="p-3">
                    <span className="font-bold text-gray-900 block">{row.name}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{row.role}</span>
                  </td>
                  <td className="p-3">
                    <select value={row.level} onChange={(e) => patchRow(row.id, { level: e.target.value })} className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[11px]">
                      {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    <input type="number" min={1} value={row.max_open_tasks} onChange={(e) => patchRow(row.id, { max_open_tasks: Number(e.target.value) })} className="w-16 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[11px]" />
                  </td>
                  <td className="p-3 font-bold text-gray-700">{row.open_tasks}</td>
                  <td className="p-3">
                    <input type="text" defaultValue={(row.specialty_catalogs || []).join(',')} onBlur={(e) => patchRow(row.id, { specialty_catalogs: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="services,jobs" className="w-28 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[11px]" />
                  </td>
                  <td className="p-3">
                    <input type="text" defaultValue={(row.regions || []).join(',')} onBlur={(e) => patchRow(row.id, { regions: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="region_id" className="w-28 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[11px]" />
                  </td>
                  <td className="p-3">
                    <button onClick={() => patchRow(row.id, { can_message_users: !row.can_message_users })} className={`p-1 rounded-lg ${row.can_message_users ? 'text-emerald-600' : 'text-gray-300'}`}>
                      {row.can_message_users ? <CheckCircle2 className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                    </button>
                  </td>
                  <td className="p-3">
                    <button onClick={() => patchRow(row.id, { is_active: !row.is_active })} className={`p-1 rounded-lg ${row.is_active ? 'text-emerald-600' : 'text-rose-400'}`}>
                      {row.is_active ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    </button>
                  </td>
                  <td className="p-3 font-bold text-gray-700">{statFor(row.id)?.tasks_resolved || 0}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => save(row)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] cursor-pointer">
                      <Save className="w-3.5 h-3.5" /> Saqlash
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ModeratorTeam;
