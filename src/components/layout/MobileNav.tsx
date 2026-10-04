import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useNotifications } from '../../context/NotificationContext.tsx';
import { Home, Heart, Plus, MessageSquare, User } from 'lucide-react';

interface MobileNavProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  flat?: boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentRoute, onNavigate }) => {
  const { user, openLoginModal } = useAuth();
  const { unreadCount } = useNotifications();
  const navRef = useRef<HTMLDivElement>(null);
  const [bubbleLeft, setBubbleLeft] = useState(0);
  const [ready, setReady] = useState(false);

  const go = (route: string, requireAuth = false) => {
    if (route.startsWith('/profile')) {
      if (!user) {
        openLoginModal();
      } else {
        onNavigate(`/profile/${user.id}`);
      }
      return;
    }
    if (requireAuth && !user) {
      openLoginModal(() => onNavigate(route));
      return;
    }
    onNavigate(route);
  };

  const items = [
    { icon: Home, label: 'Asosiy', route: '/', auth: false, match: currentRoute === '/' },
    { icon: Heart, label: 'Yoqtirilganlar', route: '/saved', auth: true, match: currentRoute === '/saved' },
    { icon: Plus, label: "E'lon", route: '/create', auth: true, match: currentRoute === '/create' },
    { icon: MessageSquare, label: 'Suhbatlar', route: '/chat', auth: true, match: currentRoute === '/chat' },
    { icon: User, label: user ? 'Profil' : 'Kirish', route: '/profile', auth: false, match: currentRoute.startsWith('/profile') },
  ];

  const activeIndex = items.findIndex((i) => i.match);

  // Compute active bubble position
  useEffect(() => {
    if (!navRef.current) return;
    const buttons = navRef.current.querySelectorAll<HTMLButtonElement>('[data-nav-btn]');
    const idx = activeIndex >= 0 ? activeIndex : 0;
    const btn = buttons[idx];
    if (!btn) return;
    const navRect = navRef.current.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setBubbleLeft(btnRect.left - navRect.left + btnRect.width / 2);
    setReady(true);
  }, [activeIndex, currentRoute]);

  const ActiveIcon = activeIndex >= 0 ? items[activeIndex].icon : null;

  return (
    <>
      <style>{`
        .mnav-bar {
          position: relative;
          height: 64px;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(22, 115, 230, 0.14);
          border-radius: 32px;
          display: flex;
          align-items: stretch;
          box-shadow: 0 10px 30px -4px rgba(22, 115, 230, 0.16), 0 4px 12px rgba(0, 0, 0, 0.04);
        }

        .mnav-bubble {
          position: absolute;
          top: -20px;
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, #1673E6 0%, #125FD0 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: translateX(-50%);
          transition: left 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease;
          box-shadow: 0 6px 20px rgba(22, 115, 230, 0.45), 0 0 0 4px rgba(255, 255, 255, 0.95);
          z-index: 10;
          pointer-events: none;
        }

        .mnav-bubble svg {
          color: #ffffff;
          stroke-width: 2.3px;
        }

        .mnav-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          padding-bottom: 8px;
          gap: 3px;
          background: none;
          border: none;
          cursor: pointer;
          position: relative;
          z-index: 5;
          -webkit-tap-highlight-color: transparent;
        }

        .mnav-btn-icon {
          width: 21px;
          height: 21px;
          color: #64748b;
          transition: opacity 200ms, color 200ms, transform 200ms;
        }

        .mnav-btn-icon.active {
          opacity: 0;
          transform: translateY(-4px);
        }

        .mnav-btn-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.01em;
          color: #64748b;
          transition: color 200ms, font-weight 200ms;
          white-space: nowrap;
        }

        .mnav-btn-label.active {
          color: #1673E6;
          font-weight: 700;
        }

        .mnav-badge {
          position: absolute;
          top: 6px;
          right: calc(50% - 16px);
          width: 8px;
          height: 8px;
          background: #ef4444;
          border-radius: 50%;
          border: 1.5px solid #ffffff;
        }
      `}</style>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40">
        <div
          style={{
            padding: '0 16px',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            background: 'transparent',
          }}
        >
          <div className="mnav-bar" ref={navRef}>
            {/* TopHand Blue floating active bubble indicator */}
            {ready && activeIndex >= 0 && ActiveIcon && (
              <div className="mnav-bubble" style={{ left: bubbleLeft }}>
                <ActiveIcon style={{ width: 22, height: 22 }} />
              </div>
            )}

            {/* Nav buttons */}
            {items.map((item, idx) => {
              const Icon = item.icon;
              const active = item.match;
              return (
                <button
                  key={idx}
                  data-nav-btn
                  className="mnav-btn"
                  onClick={() => go(item.route, item.auth)}
                >
                  <Icon className={`mnav-btn-icon${active ? ' active' : ''}`} />
                  <span className={`mnav-btn-label${active ? ' active' : ''}`}>
                    {item.label}
                  </span>
                  {idx === 3 && unreadCount > 0 && !active && (
                    <span className="mnav-badge" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
};

export default MobileNav;
