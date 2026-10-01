import React, { useState, useEffect } from 'react';
import { Report } from '../types/index.ts';
import { apiRequest } from '../lib/api.ts';
import {
  Shield,
  CheckCircle,
  Eye,
  AlertTriangle,
  ArrowLeft,
  Flame,
  FileText,
  BookOpen,
  Plus,
  Trash2,
  Ban,
  X,
  MessageSquare,
  Star,
  Layers,
  Sparkles,
} from 'lucide-react';
import { formatDateAgo } from '../lib/utils.ts';
import { ModerationQueue } from '../components/moderator/ModerationQueue.tsx';
import { VerificationQueue } from '../components/moderator/VerificationQueue.tsx';
import { StaffMessaging } from '../components/admin/StaffMessaging.tsx';
import { Inbox, Send } from 'lucide-react';

interface ModeratorDashboardPageProps {
  onNavigate: (route: string) => void;
  onOpenListing: (id: string) => void;
}

export const ModeratorDashboardPage: React.FC<ModeratorDashboardPageProps> = ({
  onNavigate,
  onOpenListing,
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'auto_flagged' | 'reports' | 'profanity_words' | 'messaging' | 'verifications'>('queue');

  // 1. Auto-flagged state
  const [autoFlaggedList, setAutoFlaggedList] = useState<any[]>([]);
  const [autoFlagStatusFilter, setAutoFlagStatusFilter] = useState<string>('PENDING');
  const [isAutoFlagLoading, setIsAutoFlagLoading] = useState(false);
  const [selectedFlagForAction, setSelectedFlagForAction] = useState<any>(null);
  const [flagActionType, setFlagActionType] = useState<'BAN_USER' | 'DELETE_CONTENT' | 'DISMISS'>('BAN_USER');
  const [flagBanDays, setFlagBanDays] = useState(7);
  const [flagActionReason, setFlagActionReason] = useState('');
  const [isFlagActionSubmitting, setIsFlagActionSubmitting] = useState(false);

  // 2. Reports state
  const [reports, setReports] = useState<Report[]>([]);
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('PENDING');
  const [isReportsLoading, setIsReportsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportActionType, setReportActionType] = useState<
    'HIDE_LISTING' | 'RESTORE_LISTING' | 'REMOVE_LISTING' | 'WARN_USER' | 'TEMP_BAN_USER' | 'DISMISS_REPORT'
  >('HIDE_LISTING');
  const [reportActionReason, setReportActionReason] = useState('');
  const [reportBanDays, setReportBanDays] = useState(7);
  const [isReportSubmitting, setIsReportSubmitting] = useState(false);

  // 3. Profanity words state
  const [profanityWords, setProfanityWords] = useState<any[]>([]);
  const [newWord, setNewWord] = useState('');
  const [newWordSeverity, setNewWordSeverity] = useState('HIGH');
  const [isWordLoading, setIsWordLoading] = useState(false);
  const [isAddingWord, setIsAddingWord] = useState(false);
  const [wordSearch, setWordSearch] = useState('');

  // Fetch Auto-flagged
  const fetchAutoFlagged = async () => {
    setIsAutoFlagLoading(true);
    try {
      const url = autoFlagStatusFilter
        ? `/api/moderation/auto-flagged?status=${autoFlagStatusFilter}`
        : '/api/moderation/auto-flagged';
      const data = await apiRequest<any[]>(url);
      setAutoFlaggedList(data);
    } catch (err) {
      console.error('Failed to load auto-flagged content:', err);
    } finally {
      setIsAutoFlagLoading(false);
    }
  };

  // Fetch Reports
  const fetchReports = async () => {
    setIsReportsLoading(true);
    try {
      const url = reportStatusFilter
        ? `/api/moderation/reports?status=${reportStatusFilter}`
        : '/api/moderation/reports';
      const list = await apiRequest<Report[]>(url);
      setReports(list);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setIsReportsLoading(false);
    }
  };

  // Fetch Profanity Words
  const fetchProfanityWords = async () => {
    setIsWordLoading(true);
    try {
      const data = await apiRequest<any[]>('/api/moderation/profanity-words');
      setProfanityWords(data);
    } catch (err) {
      console.error('Failed to load profanity words:', err);
    } finally {
      setIsWordLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'auto_flagged') fetchAutoFlagged();
    if (activeTab === 'reports') fetchReports();
    if (activeTab === 'profanity_words') fetchProfanityWords();
  }, [activeTab, autoFlagStatusFilter, reportStatusFilter]);

  // Handle Auto-flagged Action
  const handleResolveFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFlagForAction) return;

    setIsFlagActionSubmitting(true);
    try {
      await apiRequest(`/api/moderation/auto-flagged/${selectedFlagForAction.id}/action`, {
        method: 'POST',
        body: JSON.stringify({
          action: flagActionType,
          reason: flagActionReason.trim() || 'Moderator qarori',
          ban_days: flagBanDays,
        }),
      });

      alert('Qoidabuzarlik bo‘yicha chora muvaffaqiyatli ko‘rildi!');
      setSelectedFlagForAction(null);
      setFlagActionReason('');
      fetchAutoFlagged();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    } finally {
      setIsFlagActionSubmitting(false);
    }
  };

  // Handle Report Action
  const handleTakeReportAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport || !reportActionReason.trim()) {
      alert('Sabab ko‘rsatilishi shart');
      return;
    }

    setIsReportSubmitting(true);
    try {
      await apiRequest('/api/moderation/action', {
        method: 'POST',
        body: JSON.stringify({
          report_id: selectedReport.id,
          action: reportActionType,
          target_type: selectedReport.target_type,
          target_id: selectedReport.target_id,
          reason: reportActionReason.trim(),
          ban_days: reportActionType === 'TEMP_BAN_USER' ? reportBanDays : undefined,
        }),
      });

      alert('Shikoyat bo‘yicha chora ko‘rildi va audit jurnaliga qayd etildi');
      setSelectedReport(null);
      setReportActionReason('');
      fetchReports();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    } finally {
      setIsReportSubmitting(false);
    }
  };

  // Handle Add Profanity Word
  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;

    setIsAddingWord(true);
    try {
      await apiRequest('/api/moderation/profanity-words', {
        method: 'POST',
        body: JSON.stringify({
          word: newWord.trim(),
          severity: newWordSeverity,
        }),
      });
      setNewWord('');
      fetchProfanityWords();
    } catch (err: any) {
      alert(err.message || 'So‘zni qo‘shishda xatolik');
    } finally {
      setIsAddingWord(false);
    }
  };

  // Handle Delete Profanity Word
  const handleDeleteWord = async (wordId: string, wordText: string) => {
    if (!confirm(`"${wordText}" so‘zini taqiqlangan so‘zlar lug‘atidan o‘chirmoqchimisiz?`)) return;
    try {
      await apiRequest(`/api/moderation/profanity-words/${wordId}`, { method: 'DELETE' });
      fetchProfanityWords();
    } catch (err: any) {
      alert(err.message || 'O‘chirishda xatolik');
    }
  };

  const filteredWords = profanityWords.filter((w) =>
    w.word.toLowerCase().includes(wordSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/')}
            className="p-2 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-500 cursor-pointer"
            title="Asosiy sahifaga qaytish"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-600" />
              <h1 className="text-xl font-bold text-gray-950">TopHand Moderator Boshqaruv Paneli</h1>
            </div>
            <p className="text-xs text-gray-500">
              Shikoyatlardan oldin avtomatik aniqlangan qoidabuzarliklar, sharhlar, chatlar va so‘zlar filtri
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-2xl border border-gray-200 text-xs font-bold flex-wrap">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-gray-600 hover:text-gray-950'
            }`}
          >
            <Inbox className="w-3.5 h-3.5 text-blue-600" />
            <span>Navbatim</span>
          </button>

          <button
            onClick={() => setActiveTab('auto_flagged')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'auto_flagged'
                ? 'bg-white text-rose-600 shadow-xs'
                : 'text-gray-600 hover:text-gray-950'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-600" />
            <span>Avto-aniqlanganlar</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-gray-600 hover:text-gray-950'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Foydalanuvchi shikoyatlari</span>
          </button>

          <button
            onClick={() => setActiveTab('profanity_words')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'profanity_words'
                ? 'bg-white text-purple-600 shadow-xs'
                : 'text-gray-600 hover:text-gray-950'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-600" />
            <span>Taqiqlangan so‘zlar</span>
          </button>

          <button
            onClick={() => setActiveTab('messaging')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'messaging'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-gray-600 hover:text-gray-950'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-blue-600" />
            <span>Xabar yuborish</span>
          </button>

          <button
            onClick={() => setActiveTab('verifications')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'verifications'
                ? 'bg-white text-emerald-600 shadow-xs'
                : 'text-gray-600 hover:text-gray-950'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tasdiqlar</span>
          </button>
        </div>
      </div>

      {/* 0. MODERATION QUEUE TAB (Faza 17) */}
      {activeTab === 'queue' && <ModerationQueue onOpenListing={onOpenListing} />}

      {/* MESSAGING TAB (Faza 18) */}
      {activeTab === 'messaging' && <StaffMessaging />}

      {/* VERIFICATIONS TAB — tasdiq nishoni arizalari (moderator + admin) */}
      {activeTab === 'verifications' && <VerificationQueue />}

      {/* 1. AUTO-FLAGGED TAB */}
      {activeTab === 'auto_flagged' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs">
            <div>
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-600" />
                <span>Avtomatik senzura va taqiqlangan so‘zlar navbati</span>
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                E’lonlar, sharhlar yoki chat xabarlarida so‘kinish, haqorat yoki firibgarlik so‘zlari aniqlanganda darhol bu yerga tushadi.
              </p>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200 text-xs font-semibold">
              {[
                { id: 'PENDING', label: 'Kutilmoqda' },
                { id: 'RESOLVED_BANNED', label: 'Ban berilgan' },
                { id: 'RESOLVED_CLEARED', label: 'O‘chirilgan' },
                { id: 'DISMISSED', label: 'Rad etilgan' },
                { id: '', label: 'Barchasi' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setAutoFlagStatusFilter(f.id)}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer text-[11px] ${
                    autoFlagStatusFilter === f.id
                      ? 'bg-rose-600 text-white font-bold'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {isAutoFlagLoading ? (
            <div className="p-12 text-center text-xs text-gray-400">Qoidabuzarliklar navbati yuklanmoqda...</div>
          ) : autoFlaggedList.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center max-w-sm mx-auto shadow-xs">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <h3 className="font-bold text-sm text-gray-900">Qoidabuzarliklar mavjud emas</h3>
              <p className="text-xs text-gray-500 mt-1">
                Avto-filtr tomonidan kutilayotgan shubhali xabarlar yoki e’lonlar topilmadi.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-700">
                  <thead className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase">
                    <tr>
                      <th className="p-3.5">Manba</th>
                      <th className="p-3.5">Foydalanuvchi</th>
                      <th className="p-3.5">Aniqlangan so‘zlar</th>
                      <th className="p-3.5">Matn parchasi</th>
                      <th className="p-3.5">Vaqt</th>
                      <th className="p-3.5">Holat</th>
                      <th className="p-3.5 text-right">Moderator amali</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {autoFlaggedList.map((item) => {
                      const sourceBadgeMap: Record<string, { label: string; bg: string; icon: any }> = {
                        LISTING: { label: 'E’lon', bg: 'bg-blue-100 text-blue-800', icon: Layers },
                        REVIEW: { label: 'Sharh / Fikr', bg: 'bg-purple-100 text-purple-800', icon: Star },
                        CHAT_MESSAGE: { label: 'Chat xabari', bg: 'bg-amber-100 text-amber-800', icon: MessageSquare },
                      };
                      const sourceBadge = sourceBadgeMap[item.source_type] || { label: item.source_type, bg: 'bg-gray-100 text-gray-800', icon: FileText };

                      const IconComp = sourceBadge.icon;
                      const isPending = item.status === 'PENDING';

                      return (
                        <tr key={item.id} className="hover:bg-rose-50/30 transition-colors">
                          <td className="p-3.5 font-bold">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${sourceBadge.bg}`}>
                              <IconComp className="w-3 h-3" />
                              <span>{sourceBadge.label}</span>
                            </span>
                          </td>

                          <td className="p-3.5">
                            <span className="font-bold text-gray-900 block">{item.user_name}</span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {item.telegram_username ? `@${item.telegram_username}` : `ID: ${item.user_id}`}
                            </span>
                            {item.user_is_banned ? (
                              <span className="block text-[9px] font-bold text-rose-600">Bloklangan</span>
                            ) : null}
                          </td>

                          <td className="p-3.5">
                            <div className="flex flex-wrap gap-1">
                              {Array.isArray(item.matched_words) &&
                                item.matched_words.map((w: string, idx: number) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-mono font-bold text-[10px]"
                                  >
                                    "{w}"
                                  </span>
                                ))}
                            </div>
                          </td>

                          <td className="p-3.5 max-w-sm">
                            <p className="text-gray-800 font-medium line-clamp-2 bg-gray-50 p-2 rounded-xl border border-gray-100 italic">
                              "{item.content_snippet}"
                            </p>
                          </td>

                          <td className="p-3.5 text-gray-400 whitespace-nowrap">
                            {formatDateAgo(item.created_at)}
                          </td>

                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                item.status === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800 animate-pulse'
                                  : item.status === 'RESOLVED_BANNED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : item.status === 'RESOLVED_CLEARED'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>

                          <td className="p-3.5 text-right">
                            {isPending ? (
                              <button
                                onClick={() => {
                                  setSelectedFlagForAction(item);
                                  setFlagActionType('BAN_USER');
                                  setFlagActionReason(`Taqiqlangan so‘zlar: ${JSON.stringify(item.matched_words)}`);
                                }}
                                className="px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shadow-xs cursor-pointer transition-colors"
                              >
                                Chora ko‘rish
                              </button>
                            ) : (
                              <span className="text-[11px] text-gray-400 font-medium">
                                {item.action_taken || 'Hal qilingan'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. USER REPORTS TAB */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs">
            <div>
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Foydalanuvchilar tomonidan yuborilgan shikoyatlar</span>
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Firibgarlik, noaniq narx yoki haqorat sababli tushgan murojaatlar
              </p>
            </div>

            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200 text-xs font-semibold">
              {[
                { id: 'PENDING', label: 'Kutilmoqda' },
                { id: 'RESOLVED', label: 'Hal qilingan' },
                { id: 'DISMISSED', label: 'Rad etilgan' },
                { id: '', label: 'Barchasi' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setReportStatusFilter(f.id)}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer text-[11px] ${
                    reportStatusFilter === f.id
                      ? 'bg-amber-600 text-white font-bold'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {isReportsLoading ? (
            <div className="p-12 text-center text-xs text-gray-400">Shikoyatlar yuklanmoqda...</div>
          ) : reports.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center max-w-sm mx-auto shadow-xs">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <h3 className="font-bold text-sm text-gray-900">Shikoyatlar mavjud emas</h3>
              <p className="text-xs text-gray-500 mt-1">Hozirda barcha shikoyatlar to‘liq ko‘rib chiqilgan.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-700">
                  <thead className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase">
                    <tr>
                      <th className="p-3.5">Obyekt turi</th>
                      <th className="p-3.5">Shikoyat sababi</th>
                      <th className="p-3.5">Tafsilot</th>
                      <th className="p-3.5">Shikoyatchi</th>
                      <th className="p-3.5">Vaqt</th>
                      <th className="p-3.5">Holat</th>
                      <th className="p-3.5 text-right">Amal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reports.map((rep) => {
                      const isPending = rep.status === 'PENDING';
                      return (
                        <tr key={rep.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="p-3.5 font-bold text-gray-900">
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 font-mono text-[10px]">
                              {rep.target_type}
                            </span>
                          </td>

                          <td className="p-3.5 font-bold text-rose-600">
                            {rep.reason}
                          </td>

                          <td className="p-3.5 max-w-xs">
                            <p className="line-clamp-1 text-gray-800 font-medium">
                              {rep.target_data?.title || rep.target_data?.name || rep.target_data?.text || rep.target_id}
                            </p>
                            {rep.description && (
                              <p className="text-[11px] text-gray-400 line-clamp-1 italic">
                                "{rep.description}"
                              </p>
                            )}
                          </td>

                          <td className="p-3.5">
                            <span className="font-medium text-gray-900">{rep.reporter_name}</span>
                            {rep.reporter_username && (
                              <span className="block text-[10px] text-gray-400 font-mono">@{rep.reporter_username}</span>
                            )}
                          </td>

                          <td className="p-3.5 text-gray-400 whitespace-nowrap">
                            {formatDateAgo(rep.created_at)}
                          </td>

                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isPending
                                  ? 'bg-amber-100 text-amber-800'
                                  : rep.status === 'RESOLVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {rep.status}
                            </span>
                          </td>

                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => {
                                setSelectedReport(rep);
                                setReportActionType(rep.target_type === 'LISTING' ? 'HIDE_LISTING' : 'WARN_USER');
                              }}
                              className="px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition-colors cursor-pointer shadow-xs"
                            >
                              Ko‘rib chiqish
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. PROFANITY WORDS TAB */}
      {activeTab === 'profanity_words' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Add new word form */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs h-fit">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-sm text-gray-900">Yangi so‘z qo‘shish</h3>
              </div>
              <p className="text-[11px] text-gray-500 mb-4">
                Ushbu so‘z kiritilgan e’lon, sharh yoki chat xabarlari avtomatik moderatorga yo‘naltiriladi.
              </p>

              <form onSubmit={handleAddWord} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Taqiqlangan so‘z / ibora
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Masalan: firibgar, haromi..."
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-purple-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Qat’iylik darajasi (Severity)
                  </label>
                  <select
                    value={newWordSeverity}
                    onChange={(e) => setNewWordSeverity(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden font-medium"
                  >
                    <option value="HIGH">HIGH (Yuqori - zudlik bilan bloklash)</option>
                    <option value="MEDIUM">MEDIUM (O‘rtacha - tekshirish)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isAddingWord || !newWord.trim()}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAddingWord ? 'Qo‘shilmoqda...' : 'Lug‘atga qo‘shish'}</span>
                </button>
              </form>
            </div>

            {/* List of words */}
            <div className="md:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <span className="font-bold text-sm text-gray-900">
                  Taqiqlangan so‘zlar bazasi ({profanityWords.length} ta)
                </span>
                <input
                  type="text"
                  placeholder="So‘zlar orasidan qidirish..."
                  value={wordSearch}
                  onChange={(e) => setWordSearch(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs max-w-xs focus:outline-hidden"
                />
              </div>

              <div className="p-4 max-h-[500px] overflow-y-auto">
                {isWordLoading ? (
                  <div className="p-8 text-center text-xs text-gray-400">Lug‘at yuklanmoqda...</div>
                ) : filteredWords.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-400">Mos so‘z topilmadi</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {filteredWords.map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold"
                      >
                        <span className="font-mono">{item.word}</span>
                        <span className="text-[9px] px-1 py-0.2 bg-rose-200/60 rounded text-rose-800 font-bold uppercase">
                          {item.severity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteWord(item.id, item.word)}
                          className="text-rose-400 hover:text-rose-700 cursor-pointer p-0.5"
                          title="Lug‘atdan o‘chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUTO-FLAG ACTION MODAL */}
      {selectedFlagForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <Flame className="w-6 h-6" />
                <h3 className="font-extrabold text-base text-gray-950">
                  Avto-aniqlangan qoidabuzarlikni ko‘rib chiqish
                </h3>
              </div>
              <button
                onClick={() => setSelectedFlagForAction(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 text-xs mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-700">Foydalanuvchi:</span>
                <span className="font-extrabold text-gray-950">{selectedFlagForAction.user_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-700">Aniqlangan so‘zlar:</span>
                <span className="font-mono font-bold text-rose-700">
                  {JSON.stringify(selectedFlagForAction.matched_words)}
                </span>
              </div>
              <div>
                <span className="font-bold text-gray-700 block mb-1">Matn parchasi:</span>
                <p className="bg-white p-2.5 rounded-xl border border-rose-200/80 italic text-gray-900">
                  "{selectedFlagForAction.content_snippet}"
                </p>
              </div>
            </div>

            <form onSubmit={handleResolveFlag} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Ko‘riladigan chora
                </label>
                <select
                  value={flagActionType}
                  onChange={(e) => setFlagActionType(e.target.value as any)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-hidden"
                >
                  <option value="BAN_USER">Foydalanuvchiga vaqtinchalik BAN berish</option>
                  <option value="DELETE_CONTENT">Ushbu nojo‘ya kontentni butunlay o‘chirish</option>
                  <option value="DISMISS">Asossiz deb topish (Rad etish / Tozalash)</option>
                </select>
              </div>

              {flagActionType === 'BAN_USER' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Bloklash muddati (kun)
                  </label>
                  <select
                    value={flagBanDays}
                    onChange={(e) => setFlagBanDays(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-hidden"
                  >
                    <option value={1}>1 kun</option>
                    <option value={3}>3 kun</option>
                    <option value={7}>7 kun (Tavsiya etiladi)</option>
                    <option value={14}>14 kun</option>
                    <option value={30}>30 kun</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Qaror sababi (Foydalanuvchiga va auditga)
                </label>
                <textarea
                  rows={2}
                  value={flagActionReason}
                  onChange={(e) => setFlagActionReason(e.target.value)}
                  placeholder="Qaror izohini kiriting..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-medium focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedFlagForAction(null)}
                  className="flex-1 py-2.5 rounded-full border border-gray-200 text-xs font-semibold hover:bg-gray-50 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isFlagActionSubmitting}
                  className="flex-1 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  {isFlagActionSubmitting ? 'Qaror saqlanmoqda...' : 'Qarorni tasdiqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USER REPORT ACTION MODAL */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-100">
            <h3 className="font-extrabold text-base text-gray-950 mb-1">
              Shikoyatni ko‘rib chiqish (#{selectedReport.id.slice(-6)})
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Obyekt: <strong className="text-gray-900 font-semibold">{selectedReport.target_type}</strong> (ID: {selectedReport.target_id})
            </p>

            {/* Target Preview */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs mb-4">
              <span className="font-bold text-gray-700 block mb-1">Tekshirilayotgan obyekt tafsiloti:</span>
              <p className="font-semibold text-gray-900">
                {selectedReport.target_data?.title || selectedReport.target_data?.name || selectedReport.target_data?.text || 'Ma’lumot topilmadi'}
              </p>
              {selectedReport.target_type === 'LISTING' && (
                <button
                  type="button"
                  onClick={() => onOpenListing(selectedReport.target_id)}
                  className="mt-2 text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>E’lonni ochish</span>
                </button>
              )}
            </div>

            <form onSubmit={handleTakeReportAction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Amalni tanlang
                </label>
                <select
                  value={reportActionType}
                  onChange={(e) => setReportActionType(e.target.value as any)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-hidden"
                >
                  {selectedReport.target_type === 'LISTING' && (
                    <>
                      <option value="HIDE_LISTING">E’lonni yashirish (STATUS: HIDDEN)</option>
                      <option value="REMOVE_LISTING">E’lonni butunlay o‘chirish (STATUS: REMOVED)</option>
                      <option value="RESTORE_LISTING">E’lonni qayta tiklash (STATUS: ACTIVE)</option>
                    </>
                  )}
                  <option value="WARN_USER">Foydalanuvchiga ogohlantirish yuborish</option>
                  <option value="TEMP_BAN_USER">Foydalanuvchini vaqtincha bloklash</option>
                  <option value="DISMISS_REPORT">Shikoyatni asossiz deb topish (Rad etish)</option>
                </select>
              </div>

              {reportActionType === 'TEMP_BAN_USER' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Bloklash muddati (kun)
                  </label>
                  <select
                    value={reportBanDays}
                    onChange={(e) => setReportBanDays(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-hidden"
                  >
                    <option value={1}>1 kun</option>
                    <option value={3}>3 kun</option>
                    <option value={7}>7 kun</option>
                    <option value={14}>14 kun</option>
                    <option value={30}>30 kun</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Sabab (Majburiy) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={reportActionReason}
                  onChange={(e) => setReportActionReason(e.target.value)}
                  placeholder="Foydalanuvchiga bildirishnoma va audit jurnali uchun sabab..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-medium focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="flex-1 py-2.5 rounded-full border border-gray-200 text-xs font-semibold hover:bg-gray-50 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isReportSubmitting}
                  className="flex-1 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  {isReportSubmitting ? 'Bajarilmoqda...' : 'Amalni tasdiqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModeratorDashboardPage;
