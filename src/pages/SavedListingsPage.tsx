import React, { useState, useEffect } from 'react';
import { Listing } from '../types/index.ts';
import { apiRequest } from '../lib/api.ts';
import { ListingCard } from '../components/listings/ListingCard.tsx';
import { ChevronLeft, Heart, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useI18n } from '../i18n/IntlContext.tsx';

interface SavedListingsPageProps {
  onNavigate: (route: string) => void;
  onOpenListing: (id: string) => void;
}

export const SavedListingsPage: React.FC<SavedListingsPageProps> = ({
  onNavigate,
  onOpenListing,
}) => {
  const { user, openLoginModal } = useAuth();
  const { t } = useI18n();
  const [savedListings, setSavedListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSaved = async () => {
    if (!user) {
      setSavedListings([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const list = await apiRequest<Listing[]>('/api/saved-listings');
      setSavedListings(list || []);
    } catch (err) {
      console.error('Failed to load saved listings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSaved();
  }, [user]);

  // ListingCard yurakcha orqali save/unsave qiladi; unsaved bo'lsa ro'yxatdan olamiz.
  const handleUnsaved = (listingId: string) => {
    setSavedListings((prev) => prev.filter((item) => item.id !== listingId));
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-2 sm:pb-6 min-h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/')}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
            title={t('saved.backHome')}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 flex items-center gap-2 tracking-tight">
              <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
              <span>{t('nav.savedListings')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {t('saved.subtitle')}
            </p>
          </div>
        </div>

        {savedListings.length > 0 && (
          <span className="text-xs font-bold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full">
            {t('saved.countSaved', { n: savedListings.length })}
          </span>
        )}
      </div>

      {/* Guest / Not logged in state */}
      {!user ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-12 text-center max-w-md mx-auto my-6 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-base text-gray-900">
            {t('saved.loginTitle')}
          </h3>
          <p className="text-xs text-gray-500 mt-2 mb-6 leading-relaxed">
            {t('saved.loginBody')}
          </p>
          <button
            onClick={() => openLoginModal()}
            className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-colors shadow-xs flex items-center justify-center gap-2 mx-auto cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>{t('saved.loginBtn')}</span>
          </button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse"
            >
              <div className="w-full bg-gray-200" style={{ paddingBottom: '75%' }} />
              <div className="p-3 space-y-2">
                <div className="w-1/2 h-4 bg-gray-200 rounded-md" />
                <div className="w-full h-3.5 bg-gray-100 rounded-md" />
                <div className="w-2/3 h-3.5 bg-gray-100 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : savedListings.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-12 text-center max-w-md mx-auto my-6 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto mb-3">
            <Heart className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-base text-gray-900">
            {t('saved.emptyTitle')}
          </h3>
          <p className="text-xs text-gray-500 mt-1.5 mb-6 leading-relaxed">
            {t('saved.emptyBody')}
          </p>
          <button
            onClick={() => onNavigate('/')}
            className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-colors shadow-xs cursor-pointer inline-flex items-center gap-2"
          >
            <span>{t('saved.browseBtn')}</span>
          </button>
        </div>
      ) : (
        /* Asosiy sahifadagidek grid kartalar — yurakcha orqali yoqtirilganlardan olib tashlanadi */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {savedListings.map((l) => (
            <ListingCard
              key={l.id}
              listing={{ ...l, is_saved: true }}
              onClick={() => onOpenListing(l.id)}
              onSaveToggle={(saved) => {
                if (!saved) handleUnsaved(l.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedListingsPage;
