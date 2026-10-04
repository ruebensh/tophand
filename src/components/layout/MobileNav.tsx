import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useNotifications } from '../../context/NotificationContext.tsx';
import { Home, Heart, Plus, MessageSquare, User } from 'lucide-react';

interface MobileNavProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  /** listing sahifasida pastki amallar paneli bilan to'qnashmasligi uchun
      FAB ko'tarilishi olib tashlanadi (tekis bar). */
  flat?: boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentRoute, onNavigate, flat = false }) => {
  const { user, openLoginModal } = useAuth();
  const { unreadCount } = useNotifications();

  const handleCreate = () => {
    if (!user) {
      openLoginModal(() => onNavigate('/create'));
    } else {
      onNavigate('/create');
    }
  };

  const handleProfile = () => {
    if (!user) {
      openLoginModal();
    } else {
      onNavigate(`/profile/${user.id}`);
    }
  };

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 px-1 pt-1.5 pb-safe shadow-lg">
      <div className="flex items-center justify-around h-[52px]">
        {/* Asosiy */}
        <button
          onClick={() => onNavigate('/')}
          className={`flex flex-1 min-w-0 flex-col items-center justify-center min-h-[46px] px-1 text-[10px] font-medium transition-colors ${
            currentRoute === '/' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span>Asosiy</span>
        </button>

        {/* Yoqtirilganlar */}
        <button
          onClick={() => {
            if (!user) {
              openLoginModal(() => onNavigate('/saved'));
            } else {
              onNavigate('/saved');
            }
          }}
          className={`flex flex-1 min-w-0 flex-col items-center py-1 px-1 text-[10px] font-medium transition-colors ${
            currentRoute === '/saved' ? 'text-rose-600 font-semibold' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Heart
            className={`w-5 h-5 mb-0.5 ${currentRoute === '/saved' ? 'fill-rose-600' : ''}`}
          />
          <span>Yoqtirilganlar</span>
        </button>

        {/* Elevated Plus Button */}
        <button
          onClick={handleCreate}
          className={`flex flex-1 min-w-0 flex-col items-center ${flat ? '' : '-mt-3'}`}
          aria-label="E’lon joylash"
        >
          <div className={`${flat ? 'w-11 h-11' : 'w-12 h-12'} rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform`}>
            <Plus className="w-6 h-6 stroke-[3]" />
          </div>
          {!flat && (
            <span className="text-[10px] font-bold text-blue-600 mt-0.5">E’lon berish</span>
          )}
        </button>

        {/* Suhbatlar */}
        <button
          onClick={() => {
            if (!user) {
              openLoginModal(() => onNavigate('/chat'));
            } else {
              onNavigate('/chat');
            }
          }}
          className={`relative flex flex-1 min-w-0 flex-col items-center py-1 px-1 text-[10px] font-medium transition-colors ${
            currentRoute === '/chat' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <MessageSquare className="w-5 h-5 mb-0.5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-600 animate-ping" />
          )}
          <span>Suhbatlar</span>
        </button>

        {/* Profil */}
        <button
          onClick={handleProfile}
          className={`flex flex-1 min-w-0 flex-col items-center py-1 px-1 text-[10px] font-medium transition-colors ${
            currentRoute.startsWith('/profile') ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <User className="w-5 h-5 mb-0.5" />
          <span>{user ? 'Profil' : 'Kirish'}</span>
        </button>
      </div>
    </nav>
  );
};
