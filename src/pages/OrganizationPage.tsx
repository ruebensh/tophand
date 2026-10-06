import React, { useState, useEffect } from 'react';
import { Organization } from '../types/index.ts';
import { apiRequest } from '../lib/api.ts';
import { ListingCard } from '../components/listings/ListingCard.tsx';
import { Building2, ShieldCheck, Globe, Phone, MapPin, Plus } from 'lucide-react';
import { VerifiedBadge } from '../components/common/VerifiedBadge.tsx';
import { Translated } from '../components/common/Translated.tsx';
import { useI18n } from '../i18n/IntlContext.tsx';

interface OrganizationPageProps {
  orgId: string;
  onNavigate: (route: string) => void;
  onOpenListing: (id: string) => void;
}

export const OrganizationPage: React.FC<OrganizationPageProps> = ({
  orgId,
  onNavigate,
  onOpenListing,
}) => {
  const { t } = useI18n();
  const [org, setOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiRequest<Organization>(`/api/organizations/${orgId}`)
      .then(setOrg)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [orgId]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse space-y-4">
        <div className="w-full h-44 bg-gray-200 rounded-3xl" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h3 className="font-bold text-base text-gray-900">{t('org.notFound')}</h3>
        <button
          onClick={() => onNavigate('/')}
          className="mt-4 px-5 py-2 rounded-full bg-blue-600 text-white text-xs font-bold"
        >
          {t('org.backHome')}
        </button>
      </div>
    );
  }

  const isOwnerOrAdmin = org.user_membership_role === 'OWNER' || org.user_membership_role === 'ADMIN';

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Org Banner */}
      <div className="bg-white rounded-3xl border border-gray-100 p-4 sm:p-6 shadow-xs mb-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4 sm:gap-6">
            {org.logo_url ? (
              <img
                src={org.logo_url}
                alt={org.name}
                className="w-20 h-20 rounded-2xl object-cover ring-2 ring-gray-100"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-2xl">
                <Building2 className="w-10 h-10" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
                  {org.name}
                </h1>
                {org.verification_status === 'VERIFIED' ? (
                  <VerifiedBadge
                    size="sm"
                    variant="emerald"
                    showLabel={true}
                    labelText={t('org.verifiedLabel')}
                    tooltip={t('org.verifiedTooltip')}
                  />
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-medium">
                    {t('org.unverified')}
                  </span>
                )}
              </div>

              {/* Location & Contact Meta */}
              <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                {org.district_name && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <span>
                      {org.address ? `${org.address}, ` : ''}
                      {org.district_name}, {org.region_name}
                    </span>
                  </div>
                )}

                {org.website && (
                  <a
                    href={org.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{org.website.replace(/^https?:\/\//, '')}</span>
                  </a>
                )}

                {org.phone && (
                  <div className="flex items-center gap-1 text-gray-600 font-medium">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span>{org.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {isOwnerOrAdmin && (
            <button
              onClick={() => onNavigate('/create')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{t('org.newVacancy')}</span>
            </button>
          )}
        </div>

        {org.description && (
          <div className="mt-6 pt-6 border-t border-gray-100 text-xs sm:text-sm text-gray-700 leading-relaxed max-w-3xl">
            <Translated text={org.description} as="p" />
          </div>
        )}
      </div>

      {/* Active Listings Header */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900 tracking-tight">
          {t('org.activeListings')} ({org.listings?.length || 0})
        </h2>
      </div>

      {!org.listings || org.listings.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center text-xs text-gray-500 max-w-sm mx-auto">
          {t('org.noActiveListings')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {org.listings.map((l) => (
            <ListingCard key={l.id} listing={l} onClick={() => onOpenListing(l.id)} />
          ))}
        </div>
      )}
    </div>
  );
};
