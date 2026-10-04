import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { LogoProvider } from './context/LogoContext.tsx';
import { AdsProvider } from './context/AdsContext.tsx';
import { GeoProvider } from './context/GeoContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { Header } from './components/layout/Header.tsx';
import { MobileNav } from './components/layout/MobileNav.tsx';
import { Footer } from './components/layout/Footer.tsx';

// Pages
import { HomePage } from './pages/HomePage.tsx';
import { ListingDetailPage } from './pages/ListingDetailPage.tsx';
import { CreateListingPage } from './pages/CreateListingPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { ChatPage } from './pages/ChatPage.tsx';
import { SavedListingsPage } from './pages/SavedListingsPage.tsx';
import { WalletPage } from './pages/WalletPage.tsx';
import { OrganizationPage } from './pages/OrganizationPage.tsx';
import { ModeratorDashboardPage } from './pages/ModeratorDashboardPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { RegionCategoryPage } from './pages/RegionCategoryPage.tsx';
import { LegalPage, type LegalKind } from './pages/LegalPage.tsx';

// Global Modals
import { GoogleLoginModal } from './components/modals/GoogleLoginModal.tsx';
import { ProfileCompletionModal } from './components/modals/ProfileCompletionModal.tsx';
import { ThemeAtmosphere } from './components/theme/ThemeAtmosphere.tsx';

const AppContent: React.FC = () => {
  const { user, openLoginModal } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<string>(
    (window.location.pathname || '/') + (window.location.search || '')
  );
  const [homeStamp, setHomeStamp] = useState(0);

  // Sync browser popstate (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute((window.location.pathname || '/') + (window.location.search || ''));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Butun sahifa (window) vertikal scroll'ini 2x sekinlashtiramiz (faqat desktop
  // g'ildirak; mobil touch tegizmaydi). Ichki aylanadigan konteynerlar (modal,
  // chat, katalog strip) o'z harakatini oladi — ular chekkaga yetgandagina yoki
  // umuman ustida bo'lmaganda sahifaga tegamiz.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;          // pinch-zoom ga aralashmaymiz
      if (e.defaultPrevented) return; // boshqa handler (masalan strip) oldi
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;                 // qator → piksel
      else if (e.deltaMode === 2) dy *= window.innerHeight; // sahifa → piksel
      if (dy === 0) return;
      // Kursor ostida kerakli yo'nalishda aylanadigan ichki ajbor bormi?
      let node = e.target as HTMLElement | null;
      while (node && node !== document.body) {
        const oy = getComputedStyle(node).overflowY;
        const canY =
          (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
          node.scrollHeight > node.clientHeight + 1;
        if (canY) {
          const atTop = node.scrollTop <= 0;
          const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
          if ((dy < 0 && !atTop) || (dy > 0 && !atBottom)) return; // ichki oladi
        }
        node = node.parentElement;
      }
      e.preventDefault();
      window.scrollBy({ top: dy * 0.5, left: 0, behavior: 'instant' });
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  const navigate = (route: string) => {
    window.history.pushState({}, '', route);
    setCurrentRoute(route);
    // Always show a fresh landing page when navigating to home '/'
    // (bumps the key so HomePage remounts and clears in-page filters).
    if (route === '/' || route === '/?') setHomeStamp((n) => n + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderRoute = () => {
    // 0. Huquqiy / axborot sahifalari: /privacy /terms /about /contact
    const legalMap: Record<string, LegalKind> = {
      '/privacy': 'privacy',
      '/terms': 'terms',
      '/about': 'about',
      '/contact': 'contact',
    };
    const legalPath = '/' + currentRoute.split('?')[0].split('/')[1];
    if (legalMap[legalPath]) {
      return <LegalPage kind={legalMap[legalPath]} onNavigate={navigate} />;
    }

    // 1. Listing Detail: /listing/:id
    if (currentRoute.startsWith('/listing/')) {
      const listingId = currentRoute.replace('/listing/', '');
      return (
        <ListingDetailPage
          listingId={listingId}
          onNavigate={navigate}
          onBack={() => navigate('/')}
        />
      );
    }

    // 2. Create Listing: /create (edit mode: /create?edit=:id)
    if (currentRoute === '/create' || currentRoute.startsWith('/create?')) {
      const editParam = currentRoute.includes('edit=')
        ? currentRoute.split('edit=')[1].split('&')[0]
        : undefined;
      return (
        <CreateListingPage
          key={currentRoute}
          onNavigate={navigate}
          editListingId={editParam}
          onCreated={(listingId) => navigate(`/listing/${listingId}`)}
        />
      );
    }

    // 3. User Profile: /profile/:id
    if (currentRoute.startsWith('/profile/')) {
      let targetUserId = currentRoute.replace('/profile/', '');
      if (targetUserId === 'me' && user) {
        targetUserId = user.id;
      }
      return (
        <ProfilePage
          userId={targetUserId}
          onNavigate={navigate}
          onOpenListing={(id) => navigate(`/listing/${id}`)}
        />
      );
    }

    // 4. Chat: /chat
    if (currentRoute.startsWith('/chat')) {
      const urlParams = new URLSearchParams(window.location.search);
      const initialConv = urlParams.get('conv') || undefined;
      return (
        <ChatPage
          initialConversationId={initialConv}
          onNavigate={navigate}
          onOpenListing={(id) => navigate(`/listing/${id}`)}
        />
      );
    }

    // 5. Saved Listings: /saved
    if (currentRoute === '/saved' || currentRoute.startsWith('/saved')) {
      return (
        <SavedListingsPage
          onNavigate={navigate}
          onOpenListing={(id) => navigate(`/listing/${id}`)}
        />
      );
    }

    // 5b. Wallet / Balance: /wallet
    if (currentRoute === '/wallet' || currentRoute.startsWith('/wallet')) {
      return <WalletPage onNavigate={navigate} />;
    }

    // 6. Organization Detail: /org/:id
    if (currentRoute.startsWith('/org/')) {
      const orgId = currentRoute.replace('/org/', '');
      return (
        <OrganizationPage
          orgId={orgId}
          onNavigate={navigate}
          onOpenListing={(id) => navigate(`/listing/${id}`)}
        />
      );
    }

    // 7. Create Organization: removed (Faza 11 — user-facing org creation dropped)

    // 8. Categories Page: removed — kategoriyalar Header mega-menyu (modal) ichida ko'rsatiladi

    // 8b. Hudud landing: /hudud/:regionSlug/:categorySlug?
    if (currentRoute.startsWith('/hudud/')) {
      const pathOnly = currentRoute.split('?')[0];
      const parts = pathOnly.replace(/^\/hudud\/?/, '').split('/').filter(Boolean);
      const regionSlug = parts[0];
      const categorySlug = parts[1];
      if (regionSlug) {
        return (
          <RegionCategoryPage
            key={currentRoute}
            regionSlug={regionSlug}
            categorySlug={categorySlug}
            onNavigate={navigate}
            onOpenListing={(id) => navigate(`/listing/${id}`)}
          />
        );
      }
    }

    // 9. Moderator Dashboard: /moderator
    if (currentRoute === '/moderator') {
      const STAFF_ROLES = ['INTERN_MOD', 'MODERATOR', 'LEAD_MOD', 'ADMIN', 'SUPER_ADMIN'];
      if (!user || !STAFF_ROLES.includes(user.role)) {
        return (
          <div className="max-w-md mx-auto py-16 text-center">
            <h3 className="font-bold text-base text-gray-900">Ruxsat cheklangan</h3>
            <p className="text-xs text-gray-500 mt-1">
              Ushbu sahifaga faqat tayinlangan moderatorlar kira oladi.
            </p>
            <button
              onClick={() => openLoginModal()}
              className="mt-4 px-5 py-2 rounded-full bg-blue-600 text-white text-xs font-bold"
            >
              Moderator hisobiga kirish
            </button>
          </div>
        );
      }
      return (
        <ModeratorDashboardPage
          onNavigate={navigate}
          onOpenListing={(id) => navigate(`/listing/${id}`)}
        />
      );
    }

    // 9. Admin Dashboard: /admin
    if (currentRoute === '/admin') {
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return (
          <div className="max-w-md mx-auto py-16 text-center">
            <h3 className="font-bold text-base text-gray-900">Ruxsat cheklangan</h3>
            <p className="text-xs text-gray-500 mt-1">
              Ushbu sahifaga faqat platforma administratori kira oladi.
            </p>
            <button
              onClick={() => openLoginModal()}
              className="mt-4 px-5 py-2 rounded-full bg-blue-600 text-white text-xs font-bold"
            >
              Admin hisobiga kirish
            </button>
          </div>
        );
      }
      return <AdminDashboardPage onNavigate={navigate} />;
    }

    // Default: Home Page (/)
    const homeType = currentRoute.includes('?type=')
      ? (currentRoute.split('?type=')[1] as any)
      : undefined;

    return (
      <HomePage
        key={`${currentRoute}:${homeStamp}`}
        initialType={homeType}
        onNavigate={navigate}
        onOpenListing={(id) => navigate(`/listing/${id}`)}
      />
    );
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-gray-50/50 font-sans text-gray-900 selection:bg-blue-600 selection:text-white overflow-x-clip w-full max-w-full">
      {/* Mavzu muhiti: hudud foni/naqshi + bayram animatsiyalari (kontent ortasi/ustida) */}
      <ThemeAtmosphere />

      {/* Global Header */}
      <Header
        onNavigate={navigate}
        currentRoute={currentRoute}
      />

      {/* Main Content Area — mobil pastki bar (MobileNav) hamma sahifada turadi,
          shuning uchun kontent ostida bar balandligi kadar joy ochamiz (bar kartalar
          ustidan mingib qolmasligi uchun). */}
      <main className="relative z-10 flex-1 pb-[calc(var(--mobile-nav-h)+8px+env(safe-area-inset-bottom))] sm:pb-0">{renderRoute()}</main>

      {/* Global Footer (conditionally hidden on mobile devices) */}
      <div className="hidden md:block">
        <Footer onNavigate={navigate} />
      </div>

      {/* Mobile Bottom Navigation — hamma sahifada ko'rsatiladi */}
      <MobileNav currentRoute={currentRoute} onNavigate={navigate} />

      {/* Global Modals */}
      <GoogleLoginModal />
      <ProfileCompletionModal />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <LogoProvider>
          <AdsProvider>
            <GeoProvider>
              <ThemeProvider>
                <AppContent />
              </ThemeProvider>
            </GeoProvider>
          </AdsProvider>
        </LogoProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
