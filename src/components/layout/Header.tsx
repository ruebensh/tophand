import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useNotifications } from '../../context/NotificationContext.tsx';
import {
  Search,
  PlusCircle,
  Bell,
  MessageSquare,
  Bookmark,
  Wallet,
  Shield,
  Settings,
  LogOut,
  User as UserIcon,
  ChevronDown,
  LayoutGrid,
  Map as MapIcon,
  X,
} from 'lucide-react';
import { formatDateAgo, isOfficialAccount, isStaffAccount } from '../../lib/utils.ts';
import { getPublicMonetization } from '../../lib/api.ts';
import { TopHandLogo } from '../common/TopHandLogo.tsx';
import { VerifiedBadge } from '../common/VerifiedBadge.tsx';
import { NearbyMapModal } from '../modals/NearbyMapModal.tsx';

interface HeaderProps {
  onSearch?: (query: string) => void;
  onNavigate: (route: string) => void;
  currentRoute: string;
}

interface TreeNode {
  id: string;
  name_uz: string;
  active_count?: number;
  subs?: TreeNode[];
}

// Mega-daraxt ustunlari — 4 ta kategoriya (listing turi)
const SECTIONS: { type: string; label: string; catalog: 'services' | 'jobs' }[] = [
  { type: 'SERVICE_OFFER', label: 'Xizmatlar', catalog: 'services' },
  { type: 'JOB_OPENING', label: "Ish o'rinlari / Vakansiya", catalog: 'jobs' },
  { type: 'SERVICE_REQUEST', label: 'Buyurtmalar', catalog: 'services' },
  { type: 'JOB_SEEKER', label: 'Rezumelar', catalog: 'jobs' },
];

export const Header: React.FC<HeaderProps> = ({ onSearch, onNavigate, currentRoute }) => {
  const { user, logout, openLoginModal } = useAuth();
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotifications();

  const [searchQuery, setSearchQuery] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMegaOpen, setIsMegaOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [tree, setTree] = useState<{ services: TreeNode[]; jobs: TreeNode[] }>({ services: [], jobs: [] });
  // Wallet is only shown once monetization switches to PAID (hidden during the FREE_TEST / bepul davr).
  const [walletVisible, setWalletVisible] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/categories/tree?catalog_id=services').then((r) => r.json()).catch(() => []),
      fetch('/api/categories/tree?catalog_id=jobs').then((r) => r.json()).catch(() => []),
    ]).then(([services, jobs]) => {
      setTree({
        services: Array.isArray(services) ? services : [],
        jobs: Array.isArray(jobs) ? jobs : [],
      });
    });
  }, []);

  useEffect(() => {
    getPublicMonetization()
      .then((m) => setWalletVisible(m.mode === 'PAID'))
      .catch(() => setWalletVisible(false));
  }, []);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const megaRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click + Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setIsUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setIsNotificationsOpen(false);
      if (megaRef.current && !megaRef.current.contains(e.target as Node)) setIsMegaOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsMegaOpen(false); setIsUserMenuOpen(false); setIsNotificationsOpen(false); }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) onSearch(searchQuery);
  };

  const go = (route: string) => {
    setIsMegaOpen(false);
    onNavigate(route);
  };

  const handleNotificationClick = (notif: any) => {
    markAsRead(notif.id);
    setIsNotificationsOpen(false);
    if (notif.link) onNavigate(notif.link);
  };

  return (
    <header className="sticky top-0 z-40 bg-white pt-safe">
      {/* ── Tier 2: Main bar ── */}
      <div className="border-b border-[#EBECF0]">
        <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-8 h-16 flex items-center gap-2 sm:gap-3">
          {/* Brand Logo */}
          <div
            onClick={() => onNavigate('/')}
            className="flex items-center cursor-pointer shrink-0 select-none py-1 hover:opacity-90 transition-opacity"
            title="tophand.uz — Asosiy sahifa"
          >
            <TopHandLogo size="md" showText={true} imgClassName="w-8 h-8 sm:w-9 sm:h-9 object-contain bg-transparent" alt="tophand.uz" />
          </div>

          {/* Barcha kategoriyalar — mega button (Avito style) */}
          <div className="relative hidden lg:block" ref={megaRef}>
            <button
              type="button"
              onClick={() => setIsMegaOpen((v) => !v)}
              className={`flex items-center gap-1.5 h-10 px-4 rounded-xl font-semibold text-sm transition-colors cursor-pointer th-accent-bg text-white ${isMegaOpen ? 'opacity-90' : ''}`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Barcha kategoriyalar</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMegaOpen ? 'rotate-180' : ''}`} />
            </button>

            {isMegaOpen && (
              <div className="absolute left-0 top-full pt-2 z-50">
                <div className="w-[min(1100px,92vw)] bg-white rounded-2xl border border-gray-100 shadow-2xl p-4 max-h-[72vh] overflow-y-auto">
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                    {SECTIONS.map((section) => {
                      const nodes = tree[section.catalog];
                      return (
                        <div key={section.type} className="border-t-2 th-accent-border pt-2">
                          <button
                            type="button"
                            onClick={() => go(`/?type=${section.type}`)}
                            className="w-full text-left font-bold text-[13px] mb-1.5 th-accent-text hover:underline cursor-pointer"
                          >
                            {section.label}
                          </button>
                          <div className="space-y-1.5">
                            {nodes.length === 0 && (
                              <p className="text-[11px] text-gray-400 italic">Kategoriyalar yo‘q</p>
                            )}
                            {nodes.map((parent) => (
                              <div key={parent.id}>
                                <button
                                  type="button"
                                  onClick={() => go(`/?type=${section.type}&category=${parent.id}`)}
                                  className="text-[12px] font-semibold text-[#172B4D] hover:text-[#1673E6] text-left cursor-pointer truncate"
                                >
                                  {parent.name_uz}
                                </button>
                                {parent.subs && parent.subs.length > 0 && (
                                  <div className="mt-0.5 ml-2 pl-2 border-l border-gray-100 space-y-0.5">
                                    {parent.subs.map((sub) => (
                                      <button
                                        key={sub.id}
                                        type="button"
                                        onClick={() => go(`/?type=${section.type}&category=${sub.id}`)}
                                        className="block w-full text-left text-[11px] text-[#5E6C84] hover:text-[#1673E6] cursor-pointer truncate"
                                      >
                                        {sub.name_uz}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => go('/categories')}
                    className="mt-3 w-full px-3 py-2.5 rounded-xl text-sm font-bold th-accent-text hover:bg-gray-50 text-center transition-colors cursor-pointer"
                  >
                    Barcha kategoriyalar →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Xarita tugmasi — region selector o'rnini bosadi (barcha vakansiyalar xaritada) */}
          <button
            type="button"
            onClick={() => setIsMapOpen(true)}
            className="flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-semibold text-[#172B4D] hover:bg-gray-50 border border-[#EBECF0] transition-colors cursor-pointer shrink-0"
            title="Barcha e'lonlar xaritada"
          >
            <MapIcon className="w-4 h-4 th-accent-text" />
            <span className="hidden sm:inline">Xarita</span>
          </button>

          {/* Search — butun sahifalarda (home'da ham) */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden md:flex items-center flex-1 max-w-sm lg:max-w-xl mx-1 lg:mx-3 bg-[#F2F3F5] hover:bg-[#EDEFF2] focus-within:bg-white border border-transparent focus-within:border-[#1673E6] focus-within:ring-2 focus-within:ring-blue-100 rounded-full px-4 py-2 transition-all"
          >
            <button type="submit" className="shrink-0 text-[#5E6C84]" aria-label="Qidirish">
              <Search className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Kasb, usta yoki xizmat qidirish..."
              className="w-full bg-transparent text-sm text-[#172B4D] placeholder-[#5E6C84] focus:outline-hidden mx-2 min-w-0"
            />
          </form>

          {/* Right: Action Buttons & User Menu */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto md:ml-0">
            <button
              type="button"
              onClick={() => onNavigate('/saved')}
              aria-label="Saqlangan e'lonlar"
              className="hidden sm:flex p-2 text-[#5E6C84] hover:text-[#1673E6] hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
              title="Saqlanganlar"
            >
              <Bookmark className="w-5 h-5" />
            </button>

            {user && (
              <button
                onClick={() => onNavigate('/chat')}
                className={`p-2 rounded-lg transition-colors hidden sm:flex ${currentRoute === '/chat' ? 'bg-blue-50 text-blue-600' : 'text-[#5E6C84] hover:text-[#1673E6] hover:bg-gray-50'}`}
                title="Suhbatlar"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            )}

            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => { if (!user) openLoginModal(); else setIsNotificationsOpen(!isNotificationsOpen); }}
                aria-label="Bildirishnomalar"
                className="relative p-2 text-[#5E6C84] hover:text-[#1673E6] hover:bg-gray-50 rounded-lg transition-colors focus:outline-hidden cursor-pointer"
                title="Bildirishnomalar"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden z-50">
                  <div className="p-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <span className="font-bold text-sm text-gray-900">Bildirishnomalar</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead} className="text-xs text-[#1673E6] font-semibold hover:underline">
                        Barchasini o‘qilgan qilish
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-gray-400">Hozircha hech qanday bildirishnoma yo‘q</div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3.5 hover:bg-gray-50 cursor-pointer transition-colors flex items-start gap-3 ${!n.read_at ? 'bg-blue-50/30' : ''}`}
                        >
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.read_at ? 'bg-[#1673E6]' : 'bg-transparent'}`} />
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-gray-900">{n.title}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">{n.body}</p>
                            <span className="text-[10px] text-gray-400 mt-1 block">{formatDateAgo(n.created_at)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => { if (!user) openLoginModal(() => onNavigate('/create')); else onNavigate('/create'); }}
              className="hidden md:flex th-accent-bg hover:opacity-90 active:opacity-90 text-white font-semibold text-sm px-4 sm:px-5 h-10 rounded-xl transition-opacity shadow-2xs cursor-pointer items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              <span>E’lon joylash</span>
            </button>

            {user ? (
              <div className="relative hidden sm:block" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-1.5 p-1 sm:pr-2.5 rounded-full hover:bg-gray-100 transition-colors focus:outline-hidden"
                >
                  <img
                    src={user.profile_photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
                    alt={user.name}
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-blue-500/20"
                  />
                  <span className="hidden lg:block text-xs font-semibold text-gray-800 max-w-[100px] truncate">{user.name.split(' ')[0]}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 hidden lg:block" />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-gray-100 shadow-xl py-1.5 z-50 divide-y divide-gray-100">
                    <div className="p-3">
                      <p className="font-bold text-xs text-gray-900 truncate">{user.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {user.telegram_username ? `@${user.telegram_username}` : `ID: ${user.telegram_id}`}
                      </p>
                      <div className="mt-1 flex items-center gap-1">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold">{user.role}</span>
                        {isOfficialAccount(user) ? (
                          <VerifiedBadge size="xs" showLabel={true} variant="official" labelText="Rasmiy" tooltip="TopHand rasmiy hisobi" />
                        ) : isStaffAccount(user) ? (
                          <VerifiedBadge size="xs" showLabel={true} variant="staff" labelText="Moderator" tooltip="TopHand moderatori (staff)" />
                        ) : user.verification_status === 'VERIFIED' ? (
                          <VerifiedBadge size="xs" showLabel={true} labelText="Tasdiqlangan" tooltip="TopHand tomonidan pasport orqali tasdiqlangan profil" />
                        ) : null}
                      </div>
                    </div>
                    <div className="py-1">
                      <button onClick={() => { setIsUserMenuOpen(false); onNavigate(`/profile/${user.id}`); }} className="w-full px-3.5 py-2 text-xs text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-gray-400" /> Mening profilim
                      </button>
                      <button onClick={() => { setIsUserMenuOpen(false); onNavigate('/saved'); }} className="w-full px-3.5 py-2 text-xs text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <Bookmark className="w-4 h-4 text-gray-400" /> Saqlangan e’lonlar
                      </button>
                      <button onClick={() => { setIsUserMenuOpen(false); onNavigate('/chat'); }} className="w-full px-3.5 py-2 text-xs text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-gray-400" /> Suhbatlar
                      </button>
                      {walletVisible && (
                        <button onClick={() => { setIsUserMenuOpen(false); onNavigate('/wallet'); }} className="w-full px-3.5 py-2 text-xs text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-gray-400" /> Balans va to‘lovlar
                        </button>
                      )}
                    </div>
                    {(user.role === 'MODERATOR' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                      <div className="py-1 bg-amber-50/50">
                        <button onClick={() => { setIsUserMenuOpen(false); onNavigate('/moderator'); }} className="w-full px-3.5 py-2 text-xs text-left font-semibold text-amber-800 hover:bg-amber-100/50 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-amber-600" /> Moderator paneli
                        </button>
                        {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                          <button onClick={() => { setIsUserMenuOpen(false); onNavigate('/admin'); }} className="w-full px-3.5 py-2 text-xs text-left font-semibold text-blue-800 hover:bg-blue-100/50 flex items-center gap-2">
                            <Settings className="w-4 h-4 text-blue-600" /> Admin boshqaruvi
                          </button>
                        )}
                      </div>
                    )}
                    <div className="py-1">
                      <button onClick={() => { setIsUserMenuOpen(false); logout(); }} className="w-full px-3.5 py-2 text-xs text-left font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                        <LogOut className="w-4 h-4 text-rose-500" /> Chiqish
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => openLoginModal()}
                className="hidden sm:flex px-4 py-2 rounded-full border border-[#1673E6] text-[#1673E6] hover:bg-blue-50 text-xs sm:text-sm font-bold transition-colors"
              >
                Kirish
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobil qidiruv qatori (telefonlarda doim ko'rinadi) ── */}
      <div className="md:hidden px-3 pb-2.5 bg-white">
        <div className="flex items-center gap-2">
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center flex-1 min-w-0 bg-[#F2F3F5] focus-within:bg-white border border-transparent focus-within:border-[#1673E6] rounded-full px-3.5 h-11 transition-all"
          >
            <Search className="w-5 h-5 shrink-0 text-[#5E6C84]" />
            <input
              type="text"
              inputMode="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Kasb, usta yoki xizmat qidirish..."
              className="w-full bg-transparent text-[15px] text-[#172B4D] placeholder-[#5E6C84] focus:outline-hidden mx-2 min-w-0"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} aria-label="Tozalash" className="shrink-0 text-[#5E6C84] p-1">
                <X className="w-4 h-4" />
              </button>
            )}
          </form>
          <button
            type="button"
            onClick={() => onNavigate('/categories')}
            aria-label="Kategoriyalar"
            className="shrink-0 flex items-center justify-center h-11 w-11 rounded-full border border-[#EBECF0] bg-white text-[#1673E6] active:bg-blue-50"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Global map modal — barcha e'lonlar xaritada */}
      <NearbyMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onOpenListing={(id) => { setIsMapOpen(false); onNavigate(`/listing/${id}`); }}
      />
    </header>
  );
};
