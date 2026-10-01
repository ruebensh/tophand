import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../lib/api.ts';
import { Send, RefreshCw, Users, ListChecks, Globe2, Sparkles, Search } from 'lucide-react';

type Scope = 'all' | 'selected' | 'filter';

interface Template { id: string; title: string; body: string; }
interface HistoryRow { id: string; scope: string; mode: string; recipient_count: number; subject?: string; body: string; created_at: string; sender_name?: string; }
interface PickableUser { id: string; name: string; telegram_username?: string; role: string; is_banned: number; region_name?: string; listings_count?: number; }

interface StaffMessagingProps {
  /** Pre-selected user ids (e.g. passed from the users table). */
  initialUserIds?: string[];
}

export const StaffMessaging: React.FC<StaffMessagingProps> = ({ initialUserIds }) => {
  const [scope, setScope] = useState<Scope>(initialUserIds && initialUserIds.length ? 'selected' : 'all');
  const [selectedIds, setSelectedIds] = useState<string>((initialUserIds || []).join(', '));
  const [filterRole, setFilterRole] = useState('USER');
  const [filterRegion, setFilterRegion] = useState('');
  const [mode, setMode] = useState<'BROADCAST' | 'PER_USER'>('BROADCAST');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const [users, setUsers] = useState<PickableUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [noAccess, setNoAccess] = useState(false);

  const selectedIdList = selectedIds.split(',').map((s) => s.trim()).filter(Boolean);

  const toggleUser = (id: string) => {
    const set = new Set(selectedIdList);
    if (set.has(id)) set.delete(id); else set.add(id);
    setSelectedIds(Array.from(set).join(', '));
  };

  const loadUsers = useCallback(async (q: string) => {
    setLoadingUsers(true);
    try {
      const data = await apiRequest<PickableUser[]>(`/api/messaging/users?search=${encodeURIComponent(q)}`);
      setUsers(data || []);
      setNoAccess(false);
    } catch (err: any) {
      if (typeof err?.message === 'string' && err.message.toLowerCase().includes('ruxsat')) setNoAccess(true);
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [tpl, hist] = await Promise.all([
        apiRequest<Template[]>('/api/messaging/templates').catch(() => []),
        apiRequest<HistoryRow[]>('/api/messaging/history').catch(() => []),
      ]);
      setTemplates(tpl || []);
      setHistory(hist || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    load();
    loadUsers('');
  }, [load, loadUsers]);

  useEffect(() => {
    if (scope === 'selected' && users.length === 0) loadUsers(userSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  useEffect(() => {
    if (initialUserIds && initialUserIds.length) {
      setSelectedIds(initialUserIds.join(', '));
      setScope('selected');
    }
  }, [initialUserIds]);

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (t) {
      setSubject(t.title);
      setBody(t.body);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) { setMsg("Xabar matni bo'sh."); return; }
    const recipients: any = {};
    if (scope === 'all') recipients.all = true;
    else if (scope === 'selected') {
      const ids = selectedIds.split(',').map((s) => s.trim()).filter(Boolean);
      if (!ids.length) { setMsg('Hech qanday foydalanuvchi tanlanmadi.'); return; }
      recipients.user_ids = ids;
    } else {
      recipients.filter = { role: filterRole || undefined, region_id: filterRegion || undefined };
    }

    setSending(true);
    setMsg('');
    try {
      const res = await apiRequest<{ sent: number }>('/api/messaging/send', {
        method: 'POST',
        body: JSON.stringify({ recipients, mode, subject: subject.trim() || undefined, body: body.trim(), link: link.trim() || undefined }),
      });
      setMsg(`${res.sent} ta foydalanuvchiga yuborildi.`);
      setBody(''); setSubject(''); setLink('');
      load();
    } catch (err: any) {
      setMsg(err?.message || 'Yuborishda xatolik');
    } finally {
      setSending(false);
    }
  };

  const scopeBtns: { id: Scope; label: string; icon: any }[] = [
    { id: 'all', label: 'Barchasiga', icon: Globe2 },
    { id: 'selected', label: 'Tanlanganlar', icon: ListChecks },
    { id: 'filter', label: 'Filtr bo‘yicha', icon: Users },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Composer */}
      <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-xs p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Send className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-sm text-gray-900">TopHand nomidan xabar yuborish</h3>
        </div>

        {noAccess && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-[11px] font-bold">
            Sizda xabar yuborish ruxsati yo'q. Administrator "Jamoa" bo'limida sizga "Xabar" ruxsatini berishi kerak.
          </div>
        )}

        {templates.length > 0 && (
          <div className="mb-4">
            <label className="block text-[11px] font-bold text-gray-600 mb-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Shablon (canned response)
            </label>
            <select onChange={(e) => applyTemplate(e.target.value)} defaultValue="" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs">
              <option value="" disabled>Shablonni tanlang...</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-4">
          {/* Scope */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1.5">Qamrov</label>
            <div className="flex gap-2">
              {scopeBtns.map((b) => {
                const Icon = b.icon;
                return (
                  <button key={b.id} type="button" onClick={() => setScope(b.id)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${scope === b.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                    <Icon className="w-3.5 h-3.5" /> {b.label}
                  </button>
                );
              })}
            </div>
          </div>

          {scope === 'selected' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); loadUsers(userSearch); } }}
                    placeholder="Ism, username yoki Telegram ID bo'yicha qidirish..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-hidden focus:border-blue-600"
                  />
                </div>
                <button type="button" onClick={() => loadUsers(userSearch)} className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shrink-0">Qidirish</button>
              </div>

              <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                {loadingUsers && <div className="p-4 text-center text-xs text-gray-400">Yuklanmoqda...</div>}
                {!loadingUsers && users.length === 0 && <div className="p-4 text-center text-xs text-gray-400">Foydalanuvchi topilmadi.</div>}
                {!loadingUsers && users.map((u) => (
                  <label key={u.id} className="flex items-center gap-2.5 p-2.5 hover:bg-blue-50/50 cursor-pointer">
                    <input type="checkbox" checked={selectedIdList.includes(u.id)} onChange={() => toggleUser(u.id)} className="w-4 h-4 accent-blue-600 shrink-0 cursor-pointer" />
                    <img src={u.telegram_username ? `https://api.dicebear.com/7.x/initials/svg?seed=${u.telegram_username}` : `https://api.dicebear.com/7.x/initials/svg?seed=${u.name}`} alt="" className="w-7 h-7 rounded-full border border-gray-200 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-gray-900 truncate">{u.name}</span>
                        {u.is_banned ? <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">BLOK</span> : null}
                        {u.role !== 'USER' && <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{u.role}</span>}
                      </div>
                      <span className="text-[10px] text-gray-400">{u.telegram_username ? `@${u.telegram_username}` : u.id} · {u.region_name || 'hududsiz'} · {u.listings_count || 0} e'lon</span>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-gray-600">Tanlangan: {selectedIdList.length} ta</span>
                {selectedIdList.length > 0 && <button type="button" onClick={() => setSelectedIds('')} className="text-rose-600 font-bold hover:underline cursor-pointer">Tozalash</button>}
              </div>

              <details className="text-[11px]">
                <summary className="text-gray-400 cursor-pointer select-none">IDlarni qo'lda kiritish</summary>
                <input value={selectedIds} onChange={(e) => setSelectedIds(e.target.value)} placeholder="usr_abc, usr_def" className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono" />
              </details>
            </div>
          )}

          {scope === 'filter' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs">
                <option value="">Har qanday rol</option>
                <option value="USER">USER</option>
                <option value="MODERATOR">MODERATOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <input value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} placeholder="Viloyat ID (ixtiyoriy)" className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs" />
            </div>
          )}

          {/* Mode */}
          <div className="flex items-center gap-3 text-xs">
            <span className="font-bold text-gray-600">Rejim:</span>
            <label className="inline-flex items-center gap-1 cursor-pointer"><input type="radio" checked={mode === 'BROADCAST'} onChange={() => setMode('BROADCAST')} /> Bitta xabar (broadcast)</label>
            <label className="inline-flex items-center gap-1 cursor-pointer"><input type="radio" checked={mode === 'PER_USER'} onChange={() => setMode('PER_USER')} /> Har biriga alohida ({'{{name}}'})</label>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Mavzu</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Masalan: Texnik xizmat ko'rsatish" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs" />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Xabar matni <span className="text-rose-500">*</span></label>
            <textarea rows={5} required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Foydalanuvchiga bildirishnoma sifatida yetib boradi..." className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs" />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Havola (ixtiyoriy, masalan: /wallet)</label>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/listing/..." className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs" />
          </div>

          {msg && <div className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-xl p-2.5">{msg}</div>}

          <button type="submit" disabled={sending || noAccess} className="w-full py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-2">
            <Send className="w-4 h-4" /> {sending ? 'Yuborilmoqda...' : 'Yuborish'}
          </button>
        </form>
      </div>

      {/* History */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <span className="font-bold text-sm text-gray-900">Yuborilganlar tarixi</span>
          <button onClick={load} className="p-1.5 text-gray-400 hover:text-gray-600 cursor-pointer"><RefreshCw className="w-4 h-4" /></button>
        </div>
        <div className="p-3 space-y-2 max-h-[560px] overflow-y-auto">
          {history.length === 0 && <p className="text-xs text-gray-400 p-4 text-center">Tarix bo'sh.</p>}
          {history.map((h) => (
            <div key={h.id} className="p-3 rounded-2xl border border-gray-100 bg-gray-50/60">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-gray-900 truncate">{h.subject || 'Mavzusiz'}</span>
                <span className="text-[10px] text-gray-400 shrink-0">{new Date(h.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-[11px] text-gray-600 line-clamp-2 mt-0.5">{h.body}</p>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                <span className="px-1.5 py-0.5 rounded bg-white border border-gray-200">{h.mode}</span>
                <span>{h.recipient_count} qabul qiluvchi</span>
                {h.sender_name && <span>· {h.sender_name}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StaffMessaging;
