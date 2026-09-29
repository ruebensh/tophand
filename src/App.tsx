import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { LogoProvider } from './context/LogoContext.tsx';
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
import { OrganizationPage } from './pages/OrganizationPage.tsx';
import { CreateOrganizationPage } from './pages/CreateOrganizationPage.tsx';
import { ModeratorDashboardPage } from './pages/ModeratorDashboardPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { CategoriesPage } from './pages/CategoriesPage.tsx';

// Global Modals
import { TelegramLoginModal } from './components/modals/TelegramLoginModal.tsx';
import { OnboardingModal } from './components/modals/OnboardingModal.tsx';

const AppContent: React.FC = () => {
  const { user, openLoginModal } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<string>(
    (window.location.pathname || '/') + (window.location.search || '')
  );

  // Sync browser popstate (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute((window.location.pathname || '/') + (window.location.search || ''));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (route: string) => {
    window.history.pushState({}, '', route);
    setCurrentRoute(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderRoute = () => {
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

    // 2. Create Listing: /create
    if (currentRoute === '/create') {
      return (
        <CreateListingPage
          onNavigate={navigate}
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

    // 7. Create Organization: /create-org
    if (currentRoute === '/create-org') {
      return (
        <CreateOrganizationPage
          onNavigate={navigate}
          onCreated={(orgId) => navigate(`/org/${orgId}`)}
        />
      );
    }

    // 8. Categories Page: /categories
    if (
      currentRoute === '/categories' ||
      currentRoute.startsWith('/categories') ||
      currentRoute === '/kategoriyalar'
    ) {
      return (
        <CategoriesPage
          onNavigate={navigate}
          onSelectCategory={(categoryId) => navigate(`/?category=${categoryId}`)}
        />
      );
    }

    // 9. Moderator Dashboard: /moderator
    if (currentRoute === '/moderator') {
      if (!user || (user.role !== 'MODERATOR' && user.role !== 'ADMIN')) {
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
      if (!user || user.role !== 'ADMIN') {
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
        key={currentRoute}
        initialType={homeType}
        onNavigate={navigate}
        onOpenListing={(id) => navigate(`/listing/${id}`)}
      />
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50 font-sans text-gray-900 selection:bg-blue-600 selection:text-white overflow-x-hidden w-full max-w-full">
      {/* Global Header */}
      <Header
        onNavigate={navigate}
        currentRoute={currentRoute}
        onSearch={(q) => {
          navigate(`/?search=${encodeURIComponent(q)}`);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16 sm:pb-0">{renderRoute()}</main>

      {/* Global Footer (conditionally hidden on mobile devices) */}
      <div className="hidden md:block">
        <Footer onNavigate={navigate} />
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav currentRoute={currentRoute} onNavigate={navigate} />

      {/* Global Modals */}
      <TelegramLoginModal />
      <OnboardingModal />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <LogoProvider>
          <AppContent />
        </LogoProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
