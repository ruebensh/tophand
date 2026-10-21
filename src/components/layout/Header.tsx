import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext.tsx';
import { useNotifications } from '../../context/NotificationContext.tsx';
import RichText from '../common/RichText.tsx';
import {
  Search,
  PlusCircle,
  Bell,
  MessageSquare,
  Heart,
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
import { getPublicMonetization, getCatalogs, getCategoryTree } from '../../lib/api.ts';
import type { Catalog, Category, Notification } from '../../types/index.ts';
import { TopHandLogo } from '../common/TopHandLogo.tsx';
import { VerifiedBadge } from '../common/VerifiedBadge.tsx';
import { CategoryChip } from '../common/CategoryIcon.tsx';
import { NearbyMapModal } from '../modals/NearbyMapModal.tsx';
import { useI18n } from '../../i18n/IntlContext.tsx';
import { LocaleSwitcher } from '../common/LocaleSwitcher.tsx';

interface HeaderProps {
  onNavigate: (route: string) => void;
  currentRoute: string;
}

// Mega-menyu: bitta kategoriya ro'yxati shu sondan ortiq bo'lsa "Yana N ta" bilan yig'iladi.
const MEGA_SUB_LIMIT = 6;

// Katalog bo'yicha barqaror rang toni (HomePage sektor gridi bilan mos).
const CAT_TONE: Record<string, string> = {
  transport: 'blue', realty: 'amber', jobs: 'violet', services: 'teal',
  personal: 'rose', 'home-dacha': 'orange', parts: 'cyan', electronics: 'indigo',
  hobby: 'lime', animals: 'emerald', business: 'sky', business360: 'fuchsia', handmade: 'red',
};

// Mega-menyu katalog relsidagi ikonka — iloji bo'lsa /catalogs/<id>.png rasmi
// (bosh sahifa katalog kartochkalari bilan bir xil), aks holda CategoryChip.
const CatalogRailIcon: React.FC<{ catalogId: string; icon: string; tone: string; mobile?: boolean }> = ({
  catalogId,
  icon,
  tone,
  mobile,
}) => {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      <img
        src={`/catalogs/${catalogId}.png`}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${mobile ? 'h-9 w-9' : 'h-8 w-8'} shrink-0 object-contain mix-blend-multiply`}
      />
    );
  }
  return <CategoryChip name={icon} size="sm" tone={tone} />;
};

export const Header: React.FC<HeaderProps> = ({ onNavigate, currentRoute }) => {
  const { user, logout, openLoginModal } = useAuth();
  const { notifications, unreadCount, markAllAsRead, markAsRead, refreshNotifications } = useNotifications();
  const { t, localized } = useI18n();

  const [searchQuery, setSearchQuery] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifPos, setNotifPos] = useState<{ top: number; right: number } | null>(null);
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);
  const [isMegaOpen, setIsMegaOpen] = useState(false);
  const [megaKey, setMegaKey] = useState(0);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [megaCatalogId, setMegaCatalogId] = useState<string>('');
  const [megaTree, setMegaTree] = useState<Category[]>([]);
  // Kengaytirilgan ("Yana N ta" bosilgan) ota-kategoriyalar to'plami
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  // Wallet is only shown once monetization switches to PAID (hidden during the FREE_TEST / bepul davr).
  const [walletVisible, setWalletVisible] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 15;
      setIsScrolled((prev) => (prev !== scrolled ? scrolled : prev));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Joriy katalog konteksti (URL ?catalog=) — bo'lsa, mega-menyu shu katalogga
  // qaytariladi va tugma "Barcha kategoriyalar" bo'lib o'zgaradi.
  const activeCatalogId = React.useMemo(() => {
    const qi = currentRoute.indexOf('?');
    if (qi < 0) return '';
    return new URLSearchParams(currentRoute.slice(qi + 1)).get('catalog') || '';
  }, [currentRoute]);
  const activeCatalogName = localized(catalogs.find((c) => c.id === activeCatalogId) || null);

  // Joriy kategoriya konteksti (URL ?category=) — bo'lsa, mega-menyu shu
  // kategoriyaning subkategoriyalarini ko'rsatadi va tugma "Subkategoriyalar" bo'ladi.
  const activeCategoryId = React.useMemo(() => {
    const qi = currentRoute.indexOf('?');
    if (qi < 0) return '';
    return new URLSearchParams(currentRoute.slice(qi + 1)).get('category') || '';
  }, [currentRoute]);

  // megaTree'dan joriy kategoriyani (ota yoki shu kategoriyaning o'zi) topib,
  // ko'rsatiladigan subkategoriyalar ro'yxatini aniqlaymiz.
  const subContext = React.useMemo(() => {
    if (!activeCategoryId || megaTree.length === 0) return null;
    const direct = megaTree.find((p) => p.id === activeCategoryId);
    if (direct && direct.subs && direct.subs.length > 0) {
      return { parentId: direct.id, parentName: localized(direct), subs: direct.subs };
    }
    for (const p of megaTree) {
      const isChild = (p.subs || []).some((s) => s.id === activeCategoryId);
      if (isChild && p.subs && p.subs.length > 0) {
        return { parentId: p.id, parentName: localized(p), subs: p.subs };
      }
    }
    return null;
  }, [activeCategoryId, megaTree]);

  // 13 katalog ro'yxatini bir marta yuklash
  useEffect(() => {
    getCatalogs()
      .then((cats) => {
        setCatalogs(cats);
        if (cats.length > 0) setMegaCatalogId(cats[0].id);
      })
      .catch(() => setCatalogs([]));
  }, []);

  // Katalog konteksti o'zgarganda mega-menyuni shu katalogga moslashtirish.
  useEffect(() => {
    if (activeCatalogId) setMegaCatalogId(activeCatalogId);
  }, [activeCatalogId]);

  // Tanlangan katalog daraxtini lazy-yuklash
  useEffect(() => {
    if (!megaCatalogId) {
      setMegaTree([]);
      return;
    }
    setExpandedParents(new Set());
    getCategoryTree(megaCatalogId)
      .then((t) => setMegaTree(Array.isArray(t) ? t : []))
      .catch(() => setMegaTree([]));
  }, [megaCatalogId]);

  useEffect(() => {
    getPublicMonetization()
      .then((m) => setWalletVisible(m.mode === 'PAID'))
      .catch(() => setWalletVisible(false));
  }, []);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const megaRef = useRef<HTMLDivElement>(null);
  const megaMobileRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click + Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setIsUserMenuOpen(false);
      const notifTarget = e.target as Node;
      const notifInside =
        (notifRef.current && notifRef.current.contains(notifTarget)) ||
        (notifPanelRef.current && notifPanelRef.current.contains(notifTarget));
      if (!notifInside) setIsNotificationsOpen(false);
      const megaTarget = e.target as Node;
      const megaInside =
        (megaRef.current && megaRef.current.contains(megaTarget)) ||
        (megaMobileRef.current && megaMobileRef.current.contains(megaTarget));
      if (!megaInside) setIsMegaOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsMegaOpen(false); setIsUserMenuOpen(false); setIsNotificationsOpen(false); setSelectedNotif(null); }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  // Dropdown'ni portal orqali body'ga chiqaramiz — sticky toolbar (z-40) ortida
  // qolmasligi uchun. Joylashuvni qo'ng'iroq tugmasi rect'idan hisoblaymiz.
  const updateNotifPos = () => {
    const el = notifRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setNotifPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
  };

  useEffect(() => {
    if (!isNotificationsOpen) return;
    updateNotifPos();
    const onMove = () => updateNotifPos();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNotificationsOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Boshqa sahifaga o'tmaymiz — joriy sahifa kontenti ichida qidirishni
    // darhol qo'llaymiz (debounce kutmasdan, remountsiz).
    window.dispatchEvent(new CustomEvent('tophand:search', { detail: searchQuery }));
  };

  const go = (route: string) => {
    setIsMegaOpen(false);
    onNavigate(route);
  };

  const openMega = () => {
    setIsMegaOpen((v) => {
      if (!v) setMegaKey((k) => k + 1);
      return !v;
    });
  };

  // Bitta ota-kategoriyaning ochiq/yopiq holatini almashtirish
  const toggleParent = (id: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNotificationClick = (notif: Notification) => {
    markAsRead(notif.id);
    setIsNotificationsOpen(false);
    setSelectedNotif(notif);
  };

  // Mega-menyu tanasi — desktop (dropdown) va mobil (to'liq ekran) uchun umumiy.
  const renderMegaBody = (mobile = false) => {
    const linkCatalog = activeCatalogId || megaCatalogId;

    // Kategoriyalar ustunlari (ikkala rejimda ham bir xil).
    // Stagger counter — har bir element 20ms kechikish oladi
    let staggerIdx = 0;
    const tree = (
      <div className={`${mobile ? 'columns-1' : 'columns-2 xl:columns-3'} gap-x-6`}>
        {megaTree.length === 0 && (
          <p className="text-[11px] text-gray-400 italic">{t('nav.loadingCategories')}</p>
        )}
        {megaTree.map((parent) => {
          const subs = parent.subs || [];
          const isExpanded = expandedParents.has(parent.id);
          const visibleSubs = isExpanded ? subs : subs.slice(0, MEGA_SUB_LIMIT);
          const hiddenCount = subs.length - MEGA_SUB_LIMIT;
          const parentDelay = staggerIdx++ * 22;
          return (
            <div key={parent.id} className="break-inside-avoid mb-4">
              <button
                type="button"
                onClick={() => go(`/?catalog=${linkCatalog}&category=${parent.id}`)}
                className="mega-parent-item text-[12px] font-bold text-[#172B4D] hover:text-[#1673E6] text-left cursor-pointer truncate"
                style={{ '--mi': `${parentDelay}ms` } as React.CSSProperties}
              >
                {localized(parent)}
              </button>
              {subs.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {visibleSubs.map((sub, si) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => go(`/?catalog=${linkCatalog}&category=${sub.id}`)}
                      className="mega-sub-item block w-full text-left text-[11px] text-[#5E6C84] hover:text-[#1673E6] cursor-pointer truncate"
                      style={{ '--si': `${parentDelay + 12 + si * 16}ms` } as React.CSSProperties}
                    >
                      {localized(sub)}
                    </button>
                  ))}
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleParent(parent.id)}
                      className="block w-full text-left text-[11px] font-semibold text-[#1673E6] hover:underline cursor-pointer mt-0.5"
                    >
                      {isExpanded ? t('nav.collapse') : t('nav.moreCount', { n: hiddenCount })}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );

    // Kategoriya konteksti — joriy kategoriya ichida: faqat uning subkategoriyalari.
    if (subContext) {
      return (
        <div className={`flex-1 overflow-y-auto p-5 ${mobile ? 'pb-[calc(var(--mobile-nav-h)+16px+env(safe-area-inset-bottom))]' : ''}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => go(`/?catalog=${linkCatalog}&category=${subContext.parentId}`)}
              className="truncate text-sm font-extrabold text-[#1673E6] hover:underline cursor-pointer"
            >
              {subContext.parentName} {t('nav.viewAllSuffix')}
            </button>
            <button
              type="button"
              onClick={() => go(`/?catalog=${linkCatalog}`)}
              className="shrink-0 text-[11px] font-semibold text-[#5E6C84] hover:text-[#1673E6] cursor-pointer"
            >
              {t('nav.allCategories')}
            </button>
          </div>
          <div className={`${mobile ? 'columns-1' : 'columns-2 xl:columns-3'} gap-x-6`}>
            {subContext.subs.map((sub, si) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => go(`/?catalog=${linkCatalog}&category=${sub.id}`)}
                className="mega-parent-item break-inside-avoid mb-2 block w-full text-left text-[12px] font-medium text-[#172B4D] hover:text-[#1673E6] cursor-pointer truncate"
                style={{ '--mi': `${si * 24}ms` } as React.CSSProperties}
              >
                {localized(sub)}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Katalog konteksti — faqat shu katalog daraxti, to'liq kenglikda (rail yo'q).
    if (activeCatalogId) {
      return (
        <div className={`flex-1 overflow-y-auto p-5 ${mobile ? 'pb-[calc(var(--mobile-nav-h)+16px+env(safe-area-inset-bottom))]' : ''}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => go(`/?catalog=${activeCatalogId}`)}
              className="truncate text-sm font-extrabold text-[#1673E6] hover:underline cursor-pointer"
            >
              {activeCatalogName || t('nav.catalog')} {t('nav.viewAllSuffix')}
            </button>
            <button
              type="button"
              onClick={() => go('/')}
              className="shrink-0 text-[11px] font-semibold text-[#5E6C84] hover:text-[#1673E6] cursor-pointer"
            >
              {t('nav.allCatalogs')}
            </button>
          </div>
          {tree}
        </div>
      );
    }

    // Standart — chapda 13 katalog reli, o'ngda tanlangan katalog daraxti.
    return (
      <>
        {/* Chap: 13 katalog ro'yxati */}
        <div className={`${mobile ? 'w-[78px] shrink-0' : 'w-60 shrink-0'} border-r border-gray-100 bg-[#F9FAFB] overflow-y-auto py-2 ${mobile ? 'pb-[calc(var(--mobile-nav-h)+12px+env(safe-area-inset-bottom))]' : ''}`}>
          {catalogs.map((cat, ci) => (
            <button
              key={cat.id}
              type="button"
              onMouseEnter={() => { if (!mobile) setMegaCatalogId(cat.id); }}
              onClick={() => setMegaCatalogId(cat.id)}
              className={`mega-cat-item w-full flex transition-colors cursor-pointer ${
                mobile ? 'flex-col items-center gap-1 px-1.5 py-2.5 text-center' : 'items-center gap-2.5 px-3 py-2 text-left'
              } ${megaCatalogId === cat.id ? 'bg-white text-[#1673E6] font-bold' : 'text-[#172B4D] hover:bg-white/70'}`}
              style={{ '--mi': `${ci * 28}ms` } as React.CSSProperties}
            >
              <CatalogRailIcon catalogId={cat.id} icon={cat.icon} tone={CAT_TONE[cat.id]} mobile={mobile} />
              <span className={mobile ? 'text-[9px] leading-tight line-clamp-2' : 'text-[13px] truncate'}>{localized(cat)}</span>
            </button>
          ))}
        </div>

        {/* O'ng: tanlangan katalog daraxti */}
        <div className={`flex-1 overflow-y-auto p-5 ${mobile ? 'pb-[calc(var(--mobile-nav-h)+16px+env(safe-area-inset-bottom))]' : ''}`}>
          <button
            type="button"
            onClick={() => go(`/?catalog=${megaCatalogId}`)}
            className="text-sm font-extrabold text-[#1673E6] hover:underline mb-3 cursor-pointer"
          >
            {localized(catalogs.find((c) => c.id === megaCatalogId) || null)} {t('nav.viewAllSuffix')}
          </button>
          {tree}
        </div>
      </>
    );
  };

  return (
    <>
      {/* ── Tier-1: Brend qatori — oddiy oqim (scroll'da tepaga chiqib ketadi) ── */}
      <header className="relative z-30 bg-white pt-safe border-b border-[#EBECF0]">
        <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-8 h-16 flex items-center gap-2 sm:gap-3">
          {/* Brand Logo */}
          <div
            onClick={() => onNavigate('/')}
            className="flex items-center cursor-pointer shrink-0 select-none py-1 hover:opacity-90 transition-opacity"
            title={t('nav.brandTitle')}
          >
            <TopHandLogo size="md" showText={true} imgClassName="w-8 h-8 sm:w-9 sm:h-9 object-contain bg-transparent" alt="tophand.uz" />
          </div>

          {/* Right: Action Buttons & User Menu */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => onNavigate('/saved')}
              aria-label={t('nav.savedListings')}
              className="hidden sm:flex p-2 text-[#5E6C84] hover:text-[#1673E6] hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
              title={t('nav.saved')}
            >
              <Heart className="w-5 h-5" />
            </button>

            {user && (
              <button
                onClick={() => onNavigate('/chat')}
                className={`p-2 rounded-lg transition-colors hidden sm:flex ${currentRoute === '/chat' ? 'bg-blue-50 text-blue-600' : 'text-[#5E6C84] hover:text-[#1673E6] hover:bg-gray-50'}`}
                title={t('nav.chat')}
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            )}

            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => { if (!user) openLoginModal(); else { const next = !isNotificationsOpen; setIsNotificationsOpen(next); if (next) updateNotifPos(); } }}
                aria-label={t('nav.notifications')}
                className="relative p-2 text-[#5E6C84] hover:text-[#1673E6] hover:bg-gray-50 rounded-lg transition-colors focus:outline-hidden cursor-pointer"
                title={t('nav.notifications')}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotificationsOpen && createPortal(
                <div
                  ref={notifPanelRef}
                  style={{ position: 'fixed', top: notifPos?.top ?? 0, right: notifPos?.right ?? 8, zIndex: 120 }}
                  className="mega-panel-enter w-80 sm:w-96 bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden"
                >
                  <div className="p-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <span className="font-bold text-sm text-gray-900">{t('nav.notifications')}</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead} className="text-xs text-[#1673E6] font-semibold hover:underline">
                        {t('nav.markAllRead')}
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-gray-400">{t('nav.noNotifications')}</div>
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
                            <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2"><RichText text={n.body} linkClassName="text-[#1673E6] underline underline-offset-2 break-all" /></p>
                            <span className="text-[10px] text-gray-400 mt-1 block">{formatDateAgo(n.created_at)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>,
                document.body
              )}
            </div>

            {selectedNotif && createPortal(
              <div
                className="fixed inset-0 flex items-center justify-center p-4 apple-backdrop"
                style={{ zIndex: 200 }}
                onClick={() => setSelectedNotif(null)}
              >
                <div
                  className="w-full max-w-md bg-white rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.25)] border border-white/60 overflow-hidden apple-modal"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
                    <span className="font-bold text-sm text-gray-900">{selectedNotif.title}</span>
                    <button onClick={() => setSelectedNotif(null)} className="p-1.5 -mr-1.5 rounded-lg hover:bg-gray-100 text-gray-500 shrink-0 cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-5">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line"><RichText text={selectedNotif.body} linkClassName="text-[#1673E6] underline underline-offset-2 break-all" /></p>
                    <span className="mt-3 block text-[11px] text-gray-400">{formatDateAgo(selectedNotif.created_at)}</span>
                  </div>
                  {selectedNotif.link && (
                    <div className="px-5 pb-5">
                      <button
                        onClick={() => {
                          const link = selectedNotif.link;
                          const isChat = selectedNotif.type === 'NEW_CHAT_MESSAGE' || (link || '').startsWith('/chat');
                          setSelectedNotif(null);
                          setIsNotificationsOpen(false);
                          if (link) {
                            onNavigate(link);
                            // Chatga o'tganda qo'ng'iroqchani darhol sinxronlaymiz.
                            if (isChat) refreshNotifications();
                          }
                        }}
                        className="w-full py-2.5 rounded-xl th-accent-bg text-white text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        {selectedNotif.type === 'NEW_CHAT_MESSAGE' || (selectedNotif.link || '').startsWith('/chat')
                          ? t('nav.notifReadInChat')
                          : t('nav.notifOpen')}
                      </button>
                    </div>
                  )}
                </div>
              </div>,
              document.body
            )}

            <button
              onClick={() => { if (!user) openLoginModal(() => onNavigate('/create')); else onNavigate('/create'); }}
              className="hidden md:flex th-accent-bg hover:opacity-90 active:opacity-90 text-white font-semibold text-sm px-4 sm:px-5 h-10 rounded-xl transition-opacity shadow-2xs cursor-pointer items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              <span>{t('nav.createListing')}</span>
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
                  <div className="mega-panel-enter absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-gray-100 shadow-2xl py-1.5 z-50 divide-y divide-gray-100">
                    <div className="p-3">
                      <p className="font-bold text-xs text-gray-900 truncate">{user.name}</p>
                      {/* QA-06: Telegram username bo'lmasa — email ko'rsatamiz; u ham
                          bo'lmasa qatorni yashiramiz (ichki ID raqamini ochmaymiz). */}
                      {user.telegram_username ? (
                        <p className="text-[11px] text-gray-400 truncate">@{user.telegram_username}</p>
                      ) : user.email ? (
                        <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                      ) : null}
                      <div className="mt-1 flex items-center gap-1">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold">{user.role}</span>
                        {isOfficialAccount(user) ? (
                          <VerifiedBadge size="xs" showLabel={true} variant="official" labelText={t('badge.official')} tooltip={t('badge.officialTooltip')} />
                        ) : isStaffAccount(user) ? (
                          <VerifiedBadge size="xs" showLabel={true} variant="staff" labelText={t('badge.staff')} tooltip={t('badge.staffTooltip')} />
                        ) : user.verification_status === 'VERIFIED' ? (
                          <VerifiedBadge size="xs" showLabel={true} labelText={t('badge.verified')} tooltip={t('badge.verifiedTooltip')} />
                        ) : null}
                      </div>
                    </div>
                    <div className="py-1">
                      <button onClick={() => { setIsUserMenuOpen(false); onNavigate(`/profile/${user.id}`); }} className="w-full px-3.5 py-2 text-xs text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-gray-400" /> {t('nav.myProfile')}
                      </button>
                      <button onClick={() => { setIsUserMenuOpen(false); onNavigate('/saved'); }} className="w-full px-3.5 py-2 text-xs text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <Heart className="w-4 h-4 text-gray-400" /> {t('nav.savedListings')}
                      </button>
                      <button onClick={() => { setIsUserMenuOpen(false); onNavigate('/chat'); }} className="w-full px-3.5 py-2 text-xs text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-gray-400" /> {t('nav.chat')}
                      </button>
                      {walletVisible && (
                        <button onClick={() => { setIsUserMenuOpen(false); onNavigate('/wallet'); }} className="w-full px-3.5 py-2 text-xs text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-gray-400" /> {t('nav.wallet')}
                        </button>
                      )}
                    </div>
                    {(user.role === 'MODERATOR' || user.role === 'LEAD_MOD' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                      <div className="py-1 bg-amber-50/50">
                        <button onClick={() => { setIsUserMenuOpen(false); onNavigate('/moderator'); }} className="w-full px-3.5 py-2 text-xs text-left font-semibold text-amber-800 hover:bg-amber-100/50 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-amber-600" /> {t('nav.moderatorPanel')}
                        </button>
                        {(user.role === 'LEAD_MOD' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                          <button onClick={() => { setIsUserMenuOpen(false); onNavigate('/lead'); }} className="w-full px-3.5 py-2 text-xs text-left font-semibold text-fuchsia-800 hover:bg-fuchsia-100/50 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-fuchsia-600" /> {t('nav.chiefPanel')}
                          </button>
                        )}
                        {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                          <button onClick={() => { setIsUserMenuOpen(false); onNavigate('/admin'); }} className="w-full px-3.5 py-2 text-xs text-left font-semibold text-blue-800 hover:bg-blue-100/50 flex items-center gap-2">
                            <Settings className="w-4 h-4 text-blue-600" /> {t('nav.adminPanel')}
                          </button>
                        )}
                      </div>
                    )}
                    <div className="py-1">
                      <button onClick={() => { setIsUserMenuOpen(false); logout(); }} className="w-full px-3.5 py-2 text-xs text-left font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                        <LogOut className="w-4 h-4 text-rose-500" /> {t('nav.logout')}
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
                {t('nav.login')}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Toolbar: qidiruv + kataloglar/xarita — sticky; header tepaga ketgach,
          uning o'rnini bosib tepada qoladi. MobileNav bilan uyg'unlashgan Liquid Glassmorphism. ── */}
      <div className={`sticky top-0 z-40 transition-all duration-300 ${isScrolled ? 'bg-white/60 backdrop-blur-md shadow-xs' : 'bg-transparent'}`}>
        <div className={`max-w-[1440px] w-full mx-auto px-3 sm:px-8 transition-all duration-300 ${isScrolled ? 'py-1 sm:py-2' : 'py-2 sm:py-3'}`}>
          <div
            className={`flex w-full items-center gap-1.5 sm:gap-2 rounded-[28px] border transition-all duration-300 ${
              isScrolled
                ? 'border-white/80 bg-gradient-to-r from-white/85 via-white/70 to-white/80 backdrop-blur-xl shadow-[0_12px_36px_-8px_rgba(22,115,230,0.18),0_4px_16px_rgba(0,0,0,0.06)] py-1.5 px-2 sm:px-3'
                : 'border-white/75 bg-gradient-to-r from-white/75 via-white/55 to-white/65 backdrop-blur-lg shadow-[0_8px_26px_-6px_rgba(22,115,230,0.12),0_2px_10px_rgba(0,0,0,0.04)] py-2 sm:py-2.5 px-2.5 sm:px-4'
            }`}
            style={{
              boxShadow: isScrolled
                ? 'inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 2px rgba(22, 115, 230, 0.1), 0 12px 34px -8px rgba(22, 115, 230, 0.18)'
                : 'inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.9), inset 0 -1px 1px rgba(22, 115, 230, 0.08), 0 8px 24px -6px rgba(22, 115, 230, 0.12)',
            }}
          >
          {/* Barcha kataloglar — 3D TopHand Glass tugma */}
          <div className="relative shrink-0" ref={megaRef}>
            <button
              type="button"
              onClick={openMega}
              className={`flex items-center gap-1.5 h-10 px-2.5 sm:px-4 rounded-2xl font-bold text-xs sm:text-sm text-white transition-all duration-300 cursor-pointer ${
                isMegaOpen ? 'scale-95' : 'hover:scale-[1.02] active:scale-95'
              }`}
              style={{
                background: 'linear-gradient(145deg, #1E82EE 0%, #1673E6 48%, #125FD0 100%)',
                border: '1.5px solid rgba(255, 255, 255, 0.85)',
                boxShadow:
                  '0 0 0 1.5px rgba(22, 115, 230, 0.45), 0 4px 12px rgba(22, 115, 230, 0.4), inset 0 2px 3px rgba(255, 255, 255, 0.9), inset 0 -2px 3px rgba(0, 0, 0, 0.2)',
              }}
            >
              <LayoutGrid className="w-5 h-5 sm:w-4 sm:h-4 shrink-0 drop-shadow-xs" />
              <span className="hidden sm:inline">{subContext ? t('nav.subcategories') : activeCatalogId ? t('nav.categories') : t('nav.catalogs')}</span>
              <ChevronDown className={`hidden sm:block w-3.5 h-3.5 transition-transform ${isMegaOpen ? 'rotate-180' : ''}`} />
            </button>

            {isMegaOpen && (
              <div className="absolute left-0 top-full pt-2 z-50 hidden lg:block">
                <div key={megaKey} className="mega-panel-enter w-[min(1100px,92vw)] bg-white/95 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_20px_50px_rgba(0,0,0,0.12)] p-0 max-h-[74vh] overflow-hidden flex">
                  {renderMegaBody(false)}
                </div>
              </div>
            )}
          </div>

          {/* Qidiruv — Kristall Shisha Input */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center flex-1 min-w-0 h-10 bg-white/60 hover:bg-white/80 focus-within:bg-white border border-white/80 focus-within:border-[#1673E6] focus-within:ring-2 focus-within:ring-blue-100 rounded-full px-3.5 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <button type="submit" className="shrink-0 text-[#1673E6]" aria-label={t('nav.search')}>
              <Search className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>
            <input
              type="text"
              inputMode="search"
              value={searchQuery}
              onChange={(e) => {
                const v = e.target.value;
                setSearchQuery(v);
                window.dispatchEvent(new CustomEvent('tophand:search', { detail: v }));
              }}
              placeholder={t('nav.searchPlaceholder')}
              className="w-full bg-transparent text-[15px] sm:text-sm font-medium text-[#0f172a] placeholder-[#64748b] focus:outline-hidden mx-2 min-w-0"
            />
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(''); window.dispatchEvent(new CustomEvent('tophand:search', { detail: '' })); }} aria-label={t('nav.clear')} className="shrink-0 text-[#64748b] hover:text-[#0f172a] p-1">
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Til almashtgich */}
          <LocaleSwitcher />

          {/* Xarita tugmasi — Shisha Kapsula */}
          <button
            type="button"
            onClick={() => setIsMapOpen(true)}
            className="flex items-center gap-1.5 h-10 w-10 sm:w-auto sm:px-3 justify-center shrink-0 rounded-2xl text-xs sm:text-sm font-bold text-[#0f172a] bg-white/70 hover:bg-white/95 border border-white/80 hover:border-[#1673E6]/60 shadow-2xs transition-all cursor-pointer active:scale-95"
            title={t('nav.mapAllListings')}
          >
            <MapIcon className="w-5 h-5 sm:w-4 sm:h-4 text-[#1673E6] shrink-0" />
            <span className="hidden sm:inline">{t('nav.map')}</span>
          </button>
          </div>
        </div>
      </div>

      {/* Mobil to'liq ekran kategoriyalar modal — xuddi shu mega-menyu (lg dan pastda) */}
      {isMegaOpen && (
        <div ref={megaMobileRef} key={`mobile-${megaKey}`} className="lg:hidden fixed inset-0 z-50 bg-white flex flex-col apple-sheet">
          <div className="pt-2">
            <div className="apple-grabber" />
          </div>
          <div className="flex items-center justify-between px-4 h-12 shrink-0 border-b border-gray-100">
            <span className="flex items-center gap-2 font-extrabold text-sm text-[#172B4D]">
              <LayoutGrid className="w-4 h-4 th-accent-text" /> {subContext ? t('nav.allSubcategories') : activeCatalogId ? t('nav.allCategories') : t('nav.allCatalogs')}
            </span>
            <button
              type="button"
              onClick={() => setIsMegaOpen(false)}
              aria-label={t('nav.close')}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex overflow-hidden">{renderMegaBody(true)}</div>
        </div>
      )}

      {/* Global map modal — barcha e'lonlar xaritada */}
      <NearbyMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onOpenListing={(id) => { setIsMapOpen(false); onNavigate(`/listing/${id}`); }}
      />
    </>
  );
};
