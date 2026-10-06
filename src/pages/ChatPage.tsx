import React, { useState, useEffect, useRef } from 'react';
import { Conversation } from '../types/index.ts';
import { apiRequest, uploadImageFile } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Send,
  Image as ImageIcon,
  MessageSquare,
  Search,
  MoreVertical,
  Check,
  CheckCheck,
  ShieldAlert,
  Ban,
  AlertTriangle,
} from 'lucide-react';
import { formatDateAgo } from '../lib/utils.ts';
import { ReportModal } from '../components/modals/ReportModal.tsx';
import { useI18n } from '../i18n/IntlContext.tsx';

interface ChatPageProps {
  initialConversationId?: string;
  onNavigate: (route: string) => void;
  onOpenListing: (id: string) => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({
  initialConversationId,
  onNavigate,
  onOpenListing,
}) => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | undefined>(initialConversationId);
  const [activeConv, setActiveConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [partner, setPartner] = useState<any>(null);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [reportTarget, setReportTarget] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load conversations
  const fetchConversations = async () => {
    try {
      const list = await apiRequest<Conversation[]>('/api/chat/conversations');
      setConversations(list);
      // Suhbatlar sahifasi ochilganda oxirgi chat avtomatik ochilmaydi —
      // ro'yxat holatida turadi. Chat faqat bosilganda yoki e'lon sahifasidan
      // (initialConversationId) kelganda ochiladi.
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  // Load messages for selected conversation
  const fetchMessages = async (convId: string) => {
    try {
      const data = await apiRequest<any>(`/api/chat/conversations/${convId}`);
      setActiveConv(data.conversation);
      setMessages(data.messages);
      setPartner(data.partner);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId);
      const interval = setInterval(() => fetchMessages(selectedConvId), 4000);
      return () => clearInterval(interval);
    }
  }, [selectedConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || !selectedConvId || isSending) return;

    const sending = text.trim();
    setText('');
    setIsSending(true);

    try {
      const msg = await apiRequest(`/api/chat/conversations/${selectedConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: sending }),
      });
      setMessages((prev) => [...prev, msg]);
      fetchConversations();
    } catch (err: any) {
      alert(err.message || t('chat.sendError'));
      setText(sending);
    } finally {
      setIsSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConvId) return;

    setIsUploading(true);
    try {
      const url = await uploadImageFile(file);
      const msg = await apiRequest(`/api/chat/conversations/${selectedConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: t('chat.imageSent'), attachment_url: url }),
      });
      setMessages((prev) => [...prev, msg]);
      fetchConversations();
    } catch (err: any) {
      alert(err.message || t('chat.imageError'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleBlockUser = async () => {
    if (!partner) return;
    if (!confirm(t('chat.blockConfirm', { name: partner.name }))) return;

    try {
      await apiRequest('/api/chat/block', {
        method: 'POST',
        body: JSON.stringify({ blocked_user_id: partner.id }),
      });
      alert(t('chat.blocked'));
      setShowMenu(false);
      fetchConversations();
    } catch (err: any) {
      alert(err.message || t('chat.genericError'));
    }
  };

  const filteredConversations = conversations.filter(
    (c) =>
      c.partner_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.listing_title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 py-0 sm:py-6">
      <div className="bg-white border border-gray-100 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 sm:rounded-3xl h-[calc(100dvh-182px)] sm:h-[80vh] sm:min-h-[550px]">
        {/* Left Column: Conversations List */}
        <div className={`border-r border-gray-100 flex flex-col ${selectedConvId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-extrabold text-base text-gray-900 mb-3">{t('chat.title')}</h2>
            <div className="relative">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder={t('chat.searchPlaceholder')}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                {t('chat.noConversations')}
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = selectedConvId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedConvId(c.id)}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50'
                    }`}
                  >
                    <img
                      src={c.partner_photo || `https://api.dicebear.com/7.x/initials/svg?seed=${c.partner_name}`}
                      alt={c.partner_name}
                      className="w-10 h-10 rounded-2xl object-cover shrink-0 ring-1 ring-gray-200"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className="font-bold text-xs text-gray-900 truncate">{c.partner_name}</h4>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {formatDateAgo(c.last_message_time)}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-blue-700 truncate mb-0.5">
                        {c.listing_title}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">{c.last_message_text}</p>
                    </div>

                    {c.unread_count > 0 && (
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Window */}
        <div className={`md:col-span-2 lg:col-span-3 flex flex-col bg-gray-50/30 ${!selectedConvId ? 'hidden md:flex' : 'flex'}`}>
          {selectedConvId && partner ? (
            <>
              {/* Chat Header */}
              <div className="px-5 py-3 bg-white border-b border-gray-100 flex items-center justify-between z-10 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setSelectedConvId(undefined)}
                    className="md:hidden p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
                  >
                    ←
                  </button>
                  <img
                    src={partner.profile_photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${partner.name}`}
                    alt={partner.name}
                    className="w-9 h-9 rounded-2xl object-cover ring-1 ring-gray-200"
                  />
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm text-gray-900 truncate">
                      {partner.name}
                    </h3>
                    <p className="text-[11px] text-gray-400 truncate">
                      {partner.telegram_username ? `@${partner.telegram_username}` : t('chat.userFallback')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Context listing link */}
                  {activeConv && (
                    <button
                      onClick={() => onOpenListing(activeConv.listing_id)}
                      className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors"
                    >
                      <span>{t('chat.viewListing')}</span>
                    </button>
                  )}

                  {/* Actions dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowMenu(!showMenu)}
                      className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {showMenu && (
                      <div className="absolute right-0 mt-1 w-44 bg-white rounded-2xl border border-gray-100 shadow-xl py-1 z-30">
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            setReportTarget(selectedConvId);
                          }}
                          className="w-full px-3.5 py-2 text-xs text-left font-medium text-amber-700 hover:bg-amber-50 flex items-center gap-2"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {t('chat.report')}
                        </button>
                        <button
                          onClick={handleBlockUser}
                          className="w-full px-3.5 py-2 text-xs text-left font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          {t('chat.block')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Context Banner (Section 28) */}
              {activeConv && (
                <div className="px-4 py-2 bg-blue-50/80 border-b border-blue-100 text-xs text-blue-900 flex items-center justify-between shrink-0">
                  <span className="truncate">
                    {t('chat.contextBanner', { title: activeConv.listing_title })}
                  </span>
                  <button
                    onClick={() => onOpenListing(activeConv.listing_id)}
                    className="sm:hidden text-xs text-blue-600 font-bold ml-2 shrink-0"
                  >
                    {t('chat.listingShort')}
                  </button>
                </div>
              )}

              {/* Messages timeline */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => {
                  const isMine = m.sender_user_id === user?.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl p-3 text-xs leading-relaxed shadow-2xs ${
                          isMine
                            ? 'bg-blue-600 text-white rounded-br-xs'
                            : 'bg-white text-gray-900 border border-gray-100 rounded-bl-xs'
                        }`}
                      >
                        {m.attachment_url && (
                          <div className="mb-2 rounded-xl overflow-hidden">
                            <img
                              src={m.attachment_url}
                              alt="Attachment"
                              className="w-full max-h-64 object-cover"
                            />
                          </div>
                        )}
                        {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                        <div
                          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                            isMine ? 'text-blue-100' : 'text-gray-400'
                          }`}
                        >
                          <span>{formatDateAgo(m.created_at)}</span>
                          {isMine && (
                            <span>
                              {m.read_at ? (
                                <CheckCheck className="w-3.5 h-3.5 text-blue-200" />
                              ) : (
                                <Check className="w-3 h-3 text-blue-300" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 bg-white border-t border-gray-100 flex items-center gap-2 shrink-0"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-full text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition-colors"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>

                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t('chat.inputPlaceholder')}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-xs sm:text-sm text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />

                <button
                  type="submit"
                  disabled={!text.trim() || isSending}
                  className="p-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-center p-8">
              <MessageSquare className="w-12 h-12 stroke-[1.5] mb-2 text-gray-300" />
              <h3 className="font-bold text-sm text-gray-700">{t('chat.selectTitle')}</h3>
              <p className="text-xs text-gray-400 max-w-xs mt-1">
                {t('chat.selectBody')}
              </p>
            </div>
          )}
        </div>
      </div>

      {reportTarget && (
        <ReportModal
          isOpen={Boolean(reportTarget)}
          onClose={() => setReportTarget(null)}
          targetType="CONVERSATION"
          targetId={reportTarget}
          targetTitle={t('chat.reportConversationTitle')}
        />
      )}
    </div>
  );
};
