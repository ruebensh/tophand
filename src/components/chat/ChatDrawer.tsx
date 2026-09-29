import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest, uploadImageFile } from '../../lib/api.ts';
import {
  X,
  Send,
  Image as ImageIcon,
  MoreVertical,
  ShieldAlert,
  Ban,
  AlertTriangle,
  Check,
  CheckCheck,
} from 'lucide-react';
import { formatDateAgo } from '../../lib/utils.ts';
import { ReportModal } from '../modals/ReportModal.tsx';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string;
  listingId?: string;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  onClose,
  conversationId: initialConvId,
  listingId,
}) => {
  const { user } = useAuth();

  const [activeConvId, setActiveConvId] = useState<string | undefined>(initialConvId);
  const [conversationData, setConversationData] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [partner, setPartner] = useState<any>(null);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; title: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or fetch conversation
  useEffect(() => {
    if (!isOpen) return;

    const initChat = async () => {
      try {
        let convId = initialConvId;

        // If no convId but listingId, start or get conversation
        if (!convId && listingId) {
          const res = await apiRequest<any>('/api/chat/start', {
            method: 'POST',
            body: JSON.stringify({ listing_id: listingId }),
          });
          convId = res.id;
          setActiveConvId(convId);
        }

        if (convId) {
          const data = await apiRequest<any>(`/api/chat/conversations/${convId}`);
          setConversationData(data.conversation);
          setMessages(data.messages);
          setPartner(data.partner);
        }
      } catch (err: any) {
        console.error('Failed to init chat:', err);
      }
    };

    initChat();
  }, [isOpen, initialConvId, listingId]);

  // Poll for new messages every 4 seconds while chat is open
  useEffect(() => {
    if (!isOpen || !activeConvId) return;

    const interval = setInterval(async () => {
      try {
        const data = await apiRequest<any>(`/api/chat/conversations/${activeConvId}`);
        setMessages(data.messages);
      } catch (err) {
        // Silent poll error
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isOpen, activeConvId]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || !activeConvId || isSending) return;

    const sendingText = text.trim();
    setText('');
    setIsSending(true);

    try {
      const msg = await apiRequest(`/api/chat/conversations/${activeConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: sendingText }),
      });
      setMessages((prev) => [...prev, msg]);
    } catch (err: any) {
      alert(err.message || 'Xabar yuborishda xatolik');
      setText(sendingText);
    } finally {
      setIsSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConvId) return;

    setIsUploading(true);
    try {
      const imageUrl = await uploadImageFile(file);
      const msg = await apiRequest(`/api/chat/conversations/${activeConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: 'Rasm yuborildi', attachment_url: imageUrl }),
      });
      setMessages((prev) => [...prev, msg]);
    } catch (err: any) {
      alert(err.message || 'Rasm yuklashda xatolik');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleBlockUser = async () => {
    if (!partner) return;
    if (!confirm(`${partner.name}ni bloklamoqchimisiz?`)) return;

    try {
      await apiRequest('/api/chat/block', {
        method: 'POST',
        body: JSON.stringify({ blocked_user_id: partner.id }),
      });
      alert('Foydalanuvchi bloklandi');
      setShowMenu(false);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg h-[90vh] max-h-[680px] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white z-10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {partner && (
              <img
                src={partner.profile_photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${partner.name}`}
                alt={partner.name}
                className="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-gray-200"
              />
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-gray-900 truncate">
                {partner?.name || 'TopHand Suhbat'}
              </h3>
              <p className="text-[11px] text-gray-400 truncate">
                {partner?.telegram_username ? `@${partner.telegram_username}` : 'TopHand muloqot'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Action menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title="Amallar"
                aria-label="Amallar menyusi"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-1 w-44 bg-white rounded-2xl border border-gray-100 shadow-xl py-1 z-30">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      if (activeConvId) {
                        setReportTarget({ id: activeConvId, title: 'Ushbu suhbat bo‘yicha shikoyat' });
                      }
                    }}
                    className="w-full px-3.5 py-2 text-xs text-left font-medium text-amber-700 hover:bg-amber-50 flex items-center gap-2"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Shikoyat qilish
                  </button>
                  <button
                    onClick={handleBlockUser}
                    className="w-full px-3.5 py-2 text-xs text-left font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Foydalanuvchini bloklash
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Section 28 Context Banner: "Siz '...' e'loni bo'yicha yozmoqdasiz" */}
        {conversationData && (
          <div className="px-4 py-2 bg-blue-50/70 border-b border-blue-100 text-xs text-blue-900 flex items-center justify-between shrink-0">
            <span className="truncate">
              Siz <strong className="font-semibold">"{conversationData.listing_title}"</strong> e’loni bo‘yicha yozmoqdasiz.
            </span>
            <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-blue-200/60 font-bold ml-2">
              TopHand Chat
            </span>
          </div>
        )}

        {/* Safety Disclaimer Header (Section 71) */}
        <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-100 text-[11px] text-gray-500 flex items-center justify-center gap-1 shrink-0 text-center">
          <ShieldAlert className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>TopHand orqali yozish — xavfsizroq aloqa usuli.</span>
        </div>

        {/* Messages timeline */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/40">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center p-6">
              <span className="text-3xl mb-2">💬</span>
              <p className="text-xs font-semibold text-gray-700">Hozircha xabarlar yo‘q</p>
              <p className="text-[11px] text-gray-400 mt-1 max-w-xs">
                Ushbu e’lon bo‘yicha birinchi xabarni yozing va kelishuv shartlarini muhokama qiling.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_user_id === user?.id;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed shadow-2xs ${
                      isMine
                        ? 'bg-blue-600 text-white rounded-br-xs'
                        : 'bg-white text-gray-900 border border-gray-100 rounded-bl-xs'
                    }`}
                  >
                    {/* Image Attachment (Section 27) */}
                    {msg.attachment_url && (
                      <div className="mb-2 rounded-xl overflow-hidden bg-black/5">
                        <img
                          src={msg.attachment_url}
                          alt="Attachment"
                          className="w-full max-h-60 object-cover cursor-pointer hover:opacity-90"
                          onClick={() => window.open(msg.attachment_url, '_blank')}
                        />
                      </div>
                    )}

                    {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

                    <div
                      className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                        isMine ? 'text-blue-100' : 'text-gray-400'
                      }`}
                    >
                      <span>{formatDateAgo(msg.created_at)}</span>
                      {isMine && (
                        <span>
                          {msg.read_at ? (
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
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 bg-white border-t border-gray-100 flex items-center gap-2 shrink-0"
        >
          {/* Image button */}
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
            className="p-2 rounded-full text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="Rasm yuborish"
            aria-label="Rasm biriktirish"
          >
            <ImageIcon className={`w-5 h-5 ${isUploading ? 'animate-pulse text-blue-600' : ''}`} />
          </button>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Xabar yozing..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-xs sm:text-sm text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />

          <button
            type="submit"
            disabled={!text.trim() || isSending}
            className="p-2.5 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-colors disabled:opacity-40 disabled:pointer-events-none"
            title="Yuborish"
            aria-label="Xabarni yuborish"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {reportTarget && (
        <ReportModal
          isOpen={Boolean(reportTarget)}
          onClose={() => setReportTarget(null)}
          targetType="CONVERSATION"
          targetId={reportTarget.id}
          targetTitle={reportTarget.title}
        />
      )}
    </div>
  );
};
