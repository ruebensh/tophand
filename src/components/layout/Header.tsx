import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useNotifications } from '../../context/NotificationContext.tsx';
import {
  Search,
  PlusCircle,
  Bell,
  MessageSquare,
  Bookmark,
  Shield,
  Settings,
  LogOut,
  User as UserIcon,
  CheckCircle,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { formatDateAgo } from '../../lib/utils.ts';
import { TopHandLogo } from '../common/TopHandLogo.tsx';
import { VerifiedBadge } from '../common/VerifiedBadge.tsx';

interface HeaderProps {
  onSearch?: (query: string) => void;
  onNavigate: (route: string) => void;
  currentRoute: string;
}

export const Header: React.FC<HeaderProps> = ({ onSearch, onNavigate, currentRoute }) => {
  const { user, logout, openLoginModal } = useAuth();
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotifications();

  const [searchQuery, setSearchQuery] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(() => {});
  }, []);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    }
  };

  const handleNotificationClick = (notif: any) => {
    markAsRead(notif.id);
    setIsNotificationsOpen(false);
    if (notif.link) {
      onNavigate(notif.link);
    }
  };

  const isHomePage =
    currentRoute === '/' || currentRoute === '' || currentRoute.startsWith('/?');

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#EBECF0]">
      <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-8 h-16 sm:h-[68px] flex items-center justify-between">
        {/* Left: Brand Logo & Project Name */}
        <div className="flex items-center">
          <div
            onClick={() => onNavigate('/')}
            className="flex items-center cursor-pointer shrink-0 select-none py-1 hover:opacity-90 transition-opacity bg-transparent"
            style={{ backgroundColor: 'transparent' }}
            title="tophand.uz — Asosiy sahifa"
          >
            <TopHandLogo
              size="md"
              showText={true}
              imgClassName="w-8 h-8 sm:w-9 sm:h-9 object-contain bg-transparent"
              alt="tophand.uz"
            />
          </div>
        </div>

        {/* Center: Desktop Search Bar — FAQAT ichki sahifalarda ko‘rsatiladi.
            Bosh sahifada dublikat bo'lmasligi uchun yashiriladi (u yerda asosiy qidiruv bor) */}
        {!isHomePage ? (
          <form
            onSubmit={handleSearchSubmit}
            className="hidden md:flex items-center flex-1 max-w-sm lg:max-w-md mx-4 lg:mx-8 bg-[#F9FAFB] border border-[#EBECF0] rounded-xl px-3.5 py-2 focus-within:border-[#1673E6] focus-within:bg-white transition-all shadow-2xs"
          >
            <Search className="w-4 h-4 text-[#5E6C84] shrink-0 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Kasb, usta yoki xizmat qidirish..."
              className="w-full bg-transparent text-xs text-[#172B4D] placeholder-[#5E6C84] focus:outline-hidden"
            />
          </form>
        ) : (
          <div className="flex-1" />
        )}

        {/* Right: Action Buttons & User Menu */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Saved / Bookmarks — Mobilda pastki panelda borligi uchun yashiriladi */}
          <button
            type="button"
            onClick={() => onNavigate('/saved')}
            aria-label="Saqlangan e'lonlar"
            className="hidden sm:flex p-2 text-[#5E6C84] hover:text-[#1673E6] hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
            title="Saqlanganlar"
          >
            <Bookmark className="w-5 h-5" />
          </button>

          {/* Notifications Bell (Variation 23 with red badge) */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  openLoginModal();
                } else {
                  setIsNotificationsOpen(!isNotificationsOpen);
                }
              }}
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

            {/* Notifications Dropdown */}
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden z-50">
                <div className="p-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <span className="font-bold text-sm text-gray-900">Bildirishnomalar</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-[#1673E6] font-semibold hover:underline"
                    >
                      Barchasini o‘qilgan qilish
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400">
                      Hozircha hech qanday bildirishnoma yo‘q
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3.5 hover:bg-gray-50 cursor-pointer transition-colors flex items-start gap-3 ${
                          !n.read_at ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            !n.read_at ? 'bg-[#1673E6]' : 'bg-transparent'
                          }`}
                        />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-gray-900">{n.title}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">{n.body}</p>
                          <span className="text-[10px] text-gray-400 mt-1 block">
                            {formatDateAgo(n.created_at)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Prominent "E'lon joylash" / "Post Job/Service" button (Hidden on mobile viewports per spec) */}
          <button
            onClick={() => {
              if (!user) {
                openLoginModal(() => onNavigate('/create'));
              } else {
                onNavigate('/create');
              }
            }}
            className="hidden md:flex bg-[#1673E6] hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm px-4 sm:px-5 py-2 rounded-md transition-colors shadow-2xs cursor-pointer items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" />
            <span>E’lon joylash</span>
          </button>

          {/* Chat Icon Button */}
            {user && (
              <button
                onClick={() => onNavigate('/chat')}
                className={`p-2 rounded-full transition-colors hidden sm:flex ${
                  currentRoute === '/chat' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Suhbatlar"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            )}

            {/* User Account / Login Button — Mobilda pastki panelda borligi uchun yashiriladi */}
            {user ? (
              <div className="relative hidden sm:block" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-1.5 p-1 sm:pr-2.5 rounded-full hover:bg-gray-100 transition-colors focus:outline-hidden"
                >
                  <img
                    src={user.profile_photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500/20"
                  />
                  <span className="hidden sm:block text-xs font-semibold text-gray-800 max-w-[100px] truncate">
                    {user.name.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 hidden sm:block" />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-gray-100 shadow-xl py-1.5 z-50 divide-y divide-gray-100">
                    <div className="p-3">
                      <p className="font-bold text-xs text-gray-900 truncate">{user.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {user.telegram_username ? `@${user.telegram_username}` : `ID: ${user.telegram_id}`}
                      </p>
                      <div className="mt-1 flex items-center gap-1">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold">
                          {user.role}
                        </span>
                        {user.is_profile_complete && (
                          <VerifiedBadge
                            size="xs"
                            showLabel={true}
                            labelText="Tasdiqlangan profil"
                            tooltip="TopHand tomonidan to‘liq tasdiqlangan profil"
                          />
                        )}
                      </div>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onNavigate(`/profile/${user.id}`);
                        }}
                        className="w-full px-3.5 py-2 text-xs text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <UserIcon className="w-4 h-4 text-gray-400" />
                        Mening profilim
                      </button>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onNavigate('/saved');
                        }}
                        className="w-full px-3.5 py-2 text-xs text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Bookmark className="w-4 h-4 text-gray-400" />
                        Saqlangan e’lonlar
                      </button>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onNavigate('/chat');
                        }}
                        className="w-full px-3.5 py-2 text-xs text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4 text-gray-400" />
                        Suhbatlar
                      </button>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onNavigate('/create-org');
                        }}
                        className="w-full px-3.5 py-2 text-xs text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Layers className="w-4 h-4 text-gray-400" />
                        Tashkilot ochish
                      </button>
                    </div>

                    {/* Staff Links */}
                    {(user.role === 'MODERATOR' || user.role === 'ADMIN') && (
                      <div className="py-1 bg-amber-50/50">
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onNavigate('/moderator');
                          }}
                          className="w-full px-3.5 py-2 text-xs text-left font-semibold text-amber-800 hover:bg-amber-100/50 flex items-center gap-2"
                        >
                          <Shield className="w-4 h-4 text-amber-600" />
                          Moderator paneli
                        </button>
                        {user.role === 'ADMIN' && (
                          <button
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              onNavigate('/admin');
                            }}
                            className="w-full px-3.5 py-2 text-xs text-left font-semibold text-blue-800 hover:bg-blue-100/50 flex items-center gap-2"
                          >
                            <Settings className="w-4 h-4 text-blue-600" />
                            Admin boshqaruvi
                          </button>
                        )}
                      </div>
                    )}

                    <div className="py-1">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full px-3.5 py-2 text-xs text-left font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        Chiqish
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => openLoginModal()}
                className="hidden sm:flex px-4 py-2 rounded-full border border-blue-600 text-blue-600 hover:bg-blue-50 text-xs sm:text-sm font-bold transition-colors"
              >
                Kirish
              </button>
            )}
        </div>
      </div>
    </header>
  );
};
