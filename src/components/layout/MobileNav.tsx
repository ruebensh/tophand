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
  const [bubbleWidth, setBubbleWidth] = useState(62);
  const [ready, setReady] = useState(false);
  const [isFlowing, setIsFlowing] = useState(false);
  const [flowDirection, setFlowDirection] = useState<'left' | 'right' | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const prevIndexRef = useRef<number>(-1);

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

  // Suvdek oqib o'tish (liquid water flow) holatlari
  useEffect(() => {
    if (prevIndexRef.current >= 0 && activeIndex >= 0 && prevIndexRef.current !== activeIndex) {
      const dir = activeIndex > prevIndexRef.current ? 'right' : 'left';
      setFlowDirection(dir);
      setIsFlowing(true);
      setIsSettling(false);

      const flowTimer = setTimeout(() => {
        setIsFlowing(false);
        setIsSettling(true);
      }, 400);

      const settleTimer = setTimeout(() => {
        setIsSettling(false);
        setFlowDirection(null);
      }, 720);

      return () => {
        clearTimeout(flowTimer);
        clearTimeout(settleTimer);
      };
    }
    if (activeIndex >= 0) {
      prevIndexRef.current = activeIndex;
    }
  }, [activeIndex]);

  // Faol tabletka koordinatalari
  useEffect(() => {
    const compute = () => {
      if (!navRef.current) return;
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

      const targetWidth = Math.min(Math.max(btnRect.width - 6, 54), 66);
      setBubbleWidth(targetWidth);
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
        /* ── Rasmdagi Haqiqiy Kristall Shaffof Shisha (Pure Liquid Glassmorphism) ── */

        /* Asosiy suzuvchi kapsula: qora EMAS! Toza, tiniq muzlagan shisha (iOS Glass) */
        .mnav-bar {
          position: relative;
          height: 64px;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.42) 0%,
            rgba(240, 246, 255, 0.24) 50%,
            rgba(225, 238, 255, 0.32) 100%
          );
          backdrop-filter: blur(10px) saturate(160%);
          -webkit-backdrop-filter: blur(10px) saturate(160%);
          border: 1.5px solid rgba(255, 255, 255, 0.75);
          border-radius: 34px;
          display: flex;
          align-items: stretch;
          box-shadow:
            inset 0 2px 2px 0 rgba(255, 255, 255, 0.95),
            inset 0 -1.5px 2px rgba(14, 165, 233, 0.12),
            0 14px 38px -8px rgba(14, 165, 233, 0.24),
            0 4px 16px rgba(15, 23, 42, 0.08);
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          overflow: visible;
        }

        .mnav-bar:active {
          transform: scale(0.985);
        }

        /* Yuqori qirradagi specular nur chizig'i */
        .mnav-bar::before {
          content: '';
          position: absolute;
          left: 14px;
          right: 14px;
          top: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.95), transparent);
          pointer-events: none;
          z-index: 1;
        }

        /* Shisha yuzasidagi glossy parlak nuri */
        .mnav-bar::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 34px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0) 50%);
          pointer-events: none;
          z-index: 1;
        }

        /* ── SUVDEK OQIB O'TISH (Metaball / Gooey Liquid Suyuqligi) ── */
        .mnav-water-goo {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 9;
          filter: url(#mnav-water-goo) drop-shadow(0 10px 24px rgba(22, 115, 230, 0.48));
        }

        /* Suyuqlik tomchilari — TopHand brend ko'k massasi */
        .mnav-water-blob {
          position: absolute;
          top: 8px;
          height: 48px;
          border-radius: 24px;
          background: linear-gradient(145deg, #1E82EE 0%, #1673E6 50%, #125FD0 100%);
          will-change: left, transform, width;
        }

        /* 1. Markaziy cho'ziluvchi suv massasi */
        .mnav-blob-center {
          transition: left 400ms cubic-bezier(0.25, 1, 0.35, 1),
                      transform 340ms cubic-bezier(0.2, 1, 0.3, 1),
                      width 300ms ease;
        }
        .mnav-blob-center.flowing-right {
          transform: scaleX(1.36) scaleY(0.78) skewX(8deg);
        }
        .mnav-blob-center.flowing-left {
          transform: scaleX(1.36) scaleY(0.78) skewX(-8deg);
        }

        /* 2. Oldinda otiluvchi tez tomchi (Lead blob) */
        .mnav-blob-lead {
          width: 36px;
          height: 36px;
          top: 14px;
          border-radius: 50%;
          transition: left 340ms cubic-bezier(0.2, 1.25, 0.4, 1);
        }

        /* 3. Orqada cho'zilib uziluvchi tomchi (Trail blob) */
        .mnav-blob-trail {
          width: 28px;
          height: 28px;
          top: 18px;
          border-radius: 50%;
          transition: left 560ms cubic-bezier(0.35, 1, 0.25, 1);
        }

        /* 4. Sochilib chiquvchi mayda suv zarrasi (Splash droplet) */
        .mnav-splash-drop {
          position: absolute;
          top: 22px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #1673E6;
          opacity: 0;
          transition: left 460ms cubic-bezier(0.4, 1, 0.3, 1), opacity 240ms ease;
        }
        .mnav-splash-drop.active {
          opacity: 0.9;
          transform: scale(0.9);
        }

        /* ── RASMDAGI 3D SHISHA TABLETKA (TopHand Brand Glass Pillow) ── */
        .mnav-aqua-pillow {
          position: absolute;
          top: 8px;
          height: 48px;
          border-radius: 24px;
          background: linear-gradient(
            145deg,
            #1E82EE 0%,
            #1673E6 50%,
            #125FD0 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.4);
          /* Nozik 3D jilo va ko'k aura — oq pardasiz, tiniq va to'yingan */
          box-shadow:
            0 0 0 2px rgba(22, 115, 230, 0.3),
            0 4px 0 0 rgba(17, 79, 174, 0.35),
            0 10px 24px -2px rgba(22, 115, 230, 0.5),
            inset 0 1px 1px rgba(255, 255, 255, 0.35),
            inset 0 -2px 3px rgba(0, 0, 0, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: left 400ms cubic-bezier(0.25, 1, 0.35, 1),
                      width 300ms ease,
                      transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
          z-index: 12;
          pointer-events: none;
          will-change: left, transform;
        }

        /* Oqayotgan paytda cho'zilish */
        .mnav-aqua-pillow.flowing-right {
          transform: scaleX(1.3) scaleY(0.82) skewX(6deg);
        }
        .mnav-aqua-pillow.flowing-left {
          transform: scaleX(1.3) scaleY(0.82) skewX(-6deg);
        }

        /* Manzilga yetganda suv to'lqinlanishi (ripple impact) */
        @keyframes water-settle {
          0% {
            transform: scale(1.18, 0.84);
          }
          40% {
            transform: scale(0.92, 1.08);
          }
          70% {
            transform: scale(1.04, 0.98);
          }
          100% {
            transform: scale(1, 1);
          }
        }
        .mnav-aqua-pillow.settling {
          animation: water-settle 0.45s cubic-bezier(0.2, 1, 0.3, 1) forwards;
        }

        /* Suv halqasi (caustic water ripple) */
        @keyframes water-ripple {
          0% {
            opacity: 0.85;
            transform: scale(0.85);
          }
          100% {
            opacity: 0;
            transform: scale(1.55);
          }
        }
        .mnav-caustic-ring {
          position: absolute;
          inset: -4px;
          border-radius: 28px;
          border: 2px solid rgba(22, 115, 230, 0.65);
          opacity: 0;
          pointer-events: none;
        }
        .mnav-caustic-ring.ripple {
          animation: water-ripple 0.5s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
        }

        .mnav-aqua-pillow svg {
          color: #ffffff;
          stroke-width: 2.4px;
          position: relative;
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
        }

        /* Nav tugmalari */
        .mnav-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          cursor: pointer;
          position: relative;
          z-index: 15;
          -webkit-tap-highlight-color: transparent;
          gap: 2px;
        }

        .mnav-btn-icon {
          width: 22px;
          height: 22px;
          color: #334155;
          transition: opacity 180ms, color 180ms, transform 180ms;
          filter: drop-shadow(0 1px 1px rgba(255, 255, 255, 0.8));
        }

        /* Faol bo'lganda orqa fondagi ikona yashirinadi — ustidagi shisha pillow ko'rsatadi */
        .mnav-btn-icon.active {
          opacity: 0;
          transform: scale(0.7);
        }

        .mnav-btn-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.01em;
          color: #475569;
          transition: opacity 180ms, color 180ms;
          white-space: nowrap;
          text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
        }

        .mnav-btn-label.active {
          opacity: 0;
        }

        .mnav-badge {
          position: absolute;
          top: 10px;
          right: calc(50% - 16px);
          width: 8px;
          height: 8px;
          background: #ef4444;
          border-radius: 50%;
          border: 1.5px solid #ffffff;
          box-shadow: 0 0 6px rgba(239, 68, 68, 0.7);
        }

        @media (prefers-reduced-motion: reduce) {
          .mnav-blob-center, .mnav-blob-lead, .mnav-blob-trail, .mnav-aqua-pillow {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>

      {/* Suyuq suv (metaball) filtri */}
      <svg aria-hidden width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="mnav-water-goo" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -12"
              result="goo"
            />
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
            {/* ── SUVDEK OQIB O'TUVCHI SUYUQ METABALL QATLAMI ── */}
            {ready && activeIndex >= 0 && (
              <div className="mnav-water-goo">
                {/* 1. Orqada tortilib qoluvchi tomchi */}
                <span
                  className="mnav-water-blob mnav-blob-trail"
                  style={{
                    left: flowDirection === 'right' ? bubbleLeft - 24 : flowDirection === 'left' ? bubbleLeft + 24 : bubbleLeft,
                    marginLeft: -14,
                  }}
                />

                {/* 2. Markaziy cho'ziluvchi suv massasi */}
                <span
                  className={`mnav-water-blob mnav-blob-center${
                    isFlowing && flowDirection ? ` flowing-${flowDirection}` : ''
                  }`}
                  style={{
                    left: bubbleLeft,
                    width: bubbleWidth,
                    marginLeft: -bubbleWidth / 2,
                  }}
                />

                {/* 3. Oldinga intiluvchi yetakchi tomchi */}
                <span
                  className="mnav-water-blob mnav-blob-lead"
                  style={{
                    left: flowDirection === 'right' ? bubbleLeft + 20 : flowDirection === 'left' ? bubbleLeft - 20 : bubbleLeft,
                    marginLeft: -18,
                  }}
                />

                {/* 4. Sochiluvchi kichik tomchi zarrasi */}
                <span
                  className={`mnav-splash-drop${isFlowing ? ' active' : ''}`}
                  style={{
                    left: flowDirection === 'right' ? bubbleLeft - 36 : flowDirection === 'left' ? bubbleLeft + 36 : bubbleLeft,
                    marginLeft: -7,
                  }}
                />
              </div>
            )}

            {/* ── RASMDAGI 3D SHISHA TABLETKA (Aqua Glass Pillow) ── */}
            {ready && activeIndex >= 0 && ActiveIcon && (
              <div
                className={`mnav-aqua-pillow${
                  isFlowing && flowDirection ? ` flowing-${flowDirection}` : ''
                }${isSettling ? ' settling' : ''}`}
                style={{
                  left: bubbleLeft,
                  width: bubbleWidth,
                  marginLeft: -bubbleWidth / 2,
                }}
              >
                {/* Suv to'lqin halqasi */}
                <span className={`mnav-caustic-ring${isSettling ? ' ripple' : ''}`} />

                {/* Markaziy sof oq ikona */}
                <ActiveIcon style={{ width: 23, height: 23 }} />
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
                  aria-label={item.label}
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
