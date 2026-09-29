import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { X, Send, ShieldCheck, UserCheck } from 'lucide-react';
import { apiRequest } from '../../lib/api.ts';
import { TopHandLogo } from '../common/TopHandLogo.tsx';

interface Persona {
  id: string;
  name: string;
  role: string;
  telegram_username?: string;
  profile_photo_url?: string;
  bio?: string;
}

export const TelegramLoginModal: React.FC = () => {
  const { isLoginModalOpen, closeLoginModal, loginWithDevPersona, loginWithTelegram, isLoading } = useAuth();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activeTab, setActiveTab] = useState<'telegram' | 'personas'>('personas');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [telegramFirstName, setTelegramFirstName] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (isLoginModalOpen) {
      apiRequest<Persona[]>('/api/auth/personas')
        .then(setPersonas)
        .catch(console.error);
    }
  }, [isLoginModalOpen]);

  if (!isLoginModalOpen) return null;

  const handleCustomTelegramLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramFirstName.trim()) {
      setLoginError('Ismingizni kiriting');
      return;
    }

    try {
      setLoginError('');
      // Generate simulated Telegram widget payload
      const mockTelegramId = Math.floor(10000000 + Math.random() * 90000000);
      await loginWithTelegram({
        id: mockTelegramId,
        first_name: telegramFirstName.trim(),
        username: telegramUsername.replace('@', '').trim() || undefined,
        auth_date: Math.floor(Date.now() / 1000),
      });
    } catch (err: any) {
      setLoginError(err.message || 'Kirishda xatolik');
    }
  };

  const handlePersonaSelect = async (personaId: string) => {
    try {
      setLoginError('');
      await loginWithDevPersona(personaId);
    } catch (err: any) {
      setLoginError(err.message || 'Hisobga kirishda xatolik');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <TopHandLogo variant="icon" size="sm" />
            <div>
              <h3 className="font-bold text-base text-gray-900">TopHand-ga kirish</h3>
              <p className="text-[11px] text-gray-500">Telegram orqali xavfsiz autentifikatsiya</p>
            </div>
          </div>
          <button
            onClick={closeLoginModal}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-6 pt-3 pb-1 flex border-b border-gray-100">
          <button
            type="button"
            onClick={() => setActiveTab('personas')}
            className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-colors ${
              activeTab === 'personas'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Test hisoblar (1-bosishda)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('telegram')}
            className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-colors ${
              activeTab === 'telegram'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Telegram ma’lumotlari
          </button>
        </div>

        {loginError && (
          <div className="mx-6 mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {loginError}
          </div>
        )}

        <div className="p-6">
          {activeTab === 'personas' ? (
            <div>
              <p className="text-xs text-gray-600 mb-3">
                Platformaning har bir rolini tekshirish uchun quyidagi tayyor rollardan birini tanlang:
              </p>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {personas.map((p) => {
                  const roleBadgeColors = {
                    ADMIN: 'bg-purple-100 text-purple-700 border-purple-200',
                    MODERATOR: 'bg-amber-100 text-amber-700 border-amber-200',
                    USER: 'bg-blue-50 text-blue-700 border-blue-200',
                  }[p.role] || 'bg-gray-100 text-gray-700';

                  return (
                    <button
                      key={p.id}
                      onClick={() => handlePersonaSelect(p.id)}
                      disabled={isLoading}
                      className="w-full flex items-center justify-between p-2.5 rounded-2xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50/40 text-left transition-all group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={p.profile_photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${p.name}`}
                          alt={p.name}
                          className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-gray-200"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-gray-900 truncate group-hover:text-blue-600">
                              {p.name}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full border font-bold ${roleBadgeColors}`}>
                              {p.role}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 truncate">
                            {p.telegram_username ? `@${p.telegram_username}` : p.bio || 'Foydalanuvchi'}
                          </p>
                        </div>
                      </div>
                      <UserCheck className="w-4 h-4 text-gray-300 group-hover:text-blue-600 shrink-0 ml-2" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <form onSubmit={handleCustomTelegramLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Ismingiz <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={telegramFirstName}
                  onChange={(e) => setTelegramFirstName(e.target.value)}
                  placeholder="Masalan: Sardor Rahimov"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Telegram Username (ixtiyoriy)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">@</span>
                  <input
                    type="text"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                    placeholder="username"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3.5 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 -rotate-45" />
                  <span>Telegram orqali tasdiqlash</span>
                </button>
              </div>

              <div className="pt-1 flex items-center justify-center gap-1 text-[11px] text-gray-400 text-center">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Parol talab qilinmaydi. Xavfsiz tizim.</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
