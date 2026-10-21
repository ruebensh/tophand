import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useNotifications } from '../../context/NotificationContext.tsx';
import { Home, Heart, Plus, MessageSquare, User } from 'lucide-react';
import { useI18n } from '../../i18n/IntlContext.tsx';

interface MobileNavProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  flat?: boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentRoute, onNavigate }) => {
  const { user, openLoginModal } = useAuth();
  const { unreadCount } = useNotifications();
  const { t } = useI18n();
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
    { icon: Home, label: t('nav.homeShort'), route: '/', auth: false, match: currentRoute === '/' },
    { icon: Heart, label: t('nav.saved'), route: '/saved', auth: true, match: currentRoute === '/saved' },
    { icon: Plus, label: t('nav.createShort'), route: '/create', auth: true, match: currentRoute === '/create' },
    { icon: MessageSquare, label: t('nav.chat'), route: '/chat', auth: true, match: currentRoute === '/chat' },
    { icon: User, label: user ? t('nav.profile') : t('nav.login'), route: '/profile', auth: false, match: currentRoute.startsWith('/profile') },
  ];

  const activeIndex = items.findIndex((i) => i.match);

  // Compute active bubble position
  useEffect(() => {
    const compute = () => {
      if (!navRef.current) return;
      // If desktop width — reset bubble so it doesn't show on mobile after switching back
      if (window.innerWidth >= 768) {
        setReady(false);
        return;
      }
      const buttons = navRef.current.querySelectorAll<HTMLButtonElement>('[data-nav-btn]');
      const idx = activeIndex >= 0 ? activeIndex : 0;
      const btn = buttons[idx];
      if (!btn) return;
      const navRect = navRef.current.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      setBubbleLeft(btnRect.left - navRect.left + btnRect.width / 2);
      setReady(true);
    };

    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [activeIndex, currentRoute]);

  const ActiveIcon = activeIndex >= 0 ? items[activeIndex].icon : null;

  return (
    <>
      <style>{`
        /* ── Glassmorphism — SALQIN ko'k + oq, glossy aksentlar ──
           Frosted glass + yaltiroq (glossy) nur; blur kamaytirilib tiniqroq qilindi. */
        @keyframes mnav-entrance {
          0% {
            opacity: 0;
            transform: translateY(28px) scale(0.96);
          }
          65% {
            opacity: 1;
            transform: translateY(-3px) scale(1.008);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes mnav-float-pulse {
          0%, 100% {
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.92),
              inset 0 -1px 0 rgba(22, 115, 230, 0.08),
              0 10px 28px -8px rgba(37, 99, 235, 0.18),
              0 4px 12px rgba(148, 163, 184, 0.10);
            transform: translateY(0);
          }
          50% {
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.98),
              inset 0 -1px 0 rgba(22, 115, 230, 0.12),
              0 14px 36px -6px rgba(37, 99, 235, 0.28),
              0 6px 16px rgba(148, 163, 184, 0.14);
            transform: translateY(-1.5px);
          }
        }

        @keyframes mnav-shimmer {
          0%, 15% {
            transform: translateX(-150%) skewX(-20deg);
          }
          30%, 100% {
            transform: translateX(260%) skewX(-20deg);
          }
        }

        .mnav-bar {
          position: relative;
          height: 64px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.68) 0%, rgba(238, 245, 254, 0.56) 50%, rgba(214, 232, 251, 0.50) 100%);
          backdrop-filter: blur(12px) saturate(140%);
          -webkit-backdrop-filter: blur(12px) saturate(140%);
          border: 1px solid rgba(255, 255, 255, 0.78);
          border-radius: 32px;
          display: flex;
          align-items: stretch;
          animation:
            mnav-entrance 0.55s cubic-bezier(0.2, 1, 0.3, 1) backwards,
            mnav-float-pulse 4.5s ease-in-out infinite 0.6s;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          will-change: transform, box-shadow;
          overflow: visible;
        }

        .mnav-bar:active {
          transform: scale(0.985);
        }

        /* Glass yuzasidagi yumshoq yorug'lik (shine) chizig'i */
        .mnav-bar::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.95), transparent);
          pointer-events: none;
          z-index: 1;
        }

        /* Glossy (yaltiroq) shisha parlak — yuqori qismdan pastga so'nuvchi oq nur */
        .mnav-bar::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 32px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0) 44%);
          pointer-events: none;
          z-index: 1;
        }

        /* Pillow bo'ylab vaqti-vaqti bilan yuguruvchi nozik shisha nuri (shimmer) */
        .mnav-shimmer-sweep {
          position: absolute;
          inset: 0;
          border-radius: 32px;
          overflow: hidden;
          pointer-events: none;
          z-index: 2;
        }
        .mnav-shimmer-sweep::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 45%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.42), transparent);
          animation: mnav-shimmer 8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        /* Faol indeks — SUYUQ (gooey/metaball) "puck". Ikkita kechikkan shar
           (lead tezroq, trail sekinroq) harakatda orqada qolib ajraladi; SVG
           #mnav-goo filtri ularni suyuq "tomoq" (neck) bilan birlashtiradi —
           rasmdagidek oqib-cho'zilib o'tish. To'xtaganda bitta doiraga qushiladi. */
        .mnav-goo {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 9;
          filter: url(#mnav-goo) drop-shadow(0 8px 16px rgba(22, 115, 230, 0.4));
        }
        .mnav-blob {
          position: absolute;
          top: -20px;
          left: 0;
          width: 50px;
          height: 50px;
          margin-left: -25px;
          border-radius: 50%;
          background: #1673E6;
          will-change: left;
        }
        .mnav-blob--lead { transition: left 420ms cubic-bezier(0.3, 1.25, 0.5, 1); }
        .mnav-blob--trail { transition: left 620ms cubic-bezier(0.45, 1, 0.3, 1); }

        /* Ikona — filterlanmagan aniq qatlamda (blur'ga uchramaydi), lead bilan
           bir xil yuradi; ustida nozik glossy shine. */
        .mnav-bubble-icon {
          position: absolute;
          top: -20px;
          left: 0;
          width: 50px;
          height: 50px;
          margin-left: -25px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: left 420ms cubic-bezier(0.3, 1.25, 0.5, 1);
          z-index: 11;
          pointer-events: none;
        }
        .mnav-bubble-icon::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 52%);
          pointer-events: none;
        }
        .mnav-bubble-icon svg {
          color: #ffffff;
          stroke-width: 2.3px;
          position: relative;
        }

        @media (prefers-reduced-motion: reduce) {
          .mnav-blob--lead, .mnav-blob--trail, .mnav-bubble-icon { transition: none; }
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

      {/* Gooey (metaball) filtri — MobileNav suyuq animatsiyasi uchun */}
      <svg aria-hidden width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="mnav-goo" x="-60%" y="-120%" width="220%" height="340%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -12" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40">
        <div
          style={{
            padding: '0 16px',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            background: 'transparent',
          }}
        >
          <div className="mnav-bar" ref={navRef}>
            {/* Pillow shisha nuri sweep animatsiyasi */}
            <div className="mnav-shimmer-sweep" />

            {/* TopHand Blue floating active bubble indicator */}
            {/* Suyuq (gooey) massa — ikki kechikkan shar, filter birlashtiradi */}
            {ready && activeIndex >= 0 && ActiveIcon && (
              <>
                <div className="mnav-goo">
                  <span className="mnav-blob mnav-blob--trail" style={{ left: bubbleLeft }} />
                  <span className="mnav-blob mnav-blob--lead" style={{ left: bubbleLeft }} />
                </div>
                {/* Ikona — aniq (filterlanmagan) qatlam */}
                <div className="mnav-bubble-icon" style={{ left: bubbleLeft }}>
                  <ActiveIcon style={{ width: 22, height: 22 }} />
                </div>
              </>
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
