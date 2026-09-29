import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../lib/api.ts';

export interface PlatformBranding {
  prefix_text: string;
  prefix_color: string;
  suffix_text: string;
  suffix_color: string;
  domain_suffix: string;
  domain_color: string;
  tagline: string;
  logo_url: string;
}

const DEFAULT_BRANDING: PlatformBranding = {
  prefix_text: 'top',
  prefix_color: '#111827',
  suffix_text: 'hand',
  suffix_color: '#1673E6',
  domain_suffix: '.uz',
  domain_color: '#1673E6',
  tagline: 'Mahalliy Xizmatlar va Ish Bozori Platformasi',
  logo_url: '/TOPHAND.uz (1).png',
};

interface LogoContextType {
  logoUrl: string;
  version: string;
  fullLogoSrc: string;
  branding: PlatformBranding;
  isLoading: boolean;
  refreshLogo: () => Promise<void>;
  updateActiveLogo: (newUrl: string, updatedAt?: string) => void;
  updateBranding: (newBranding: Partial<PlatformBranding>) => void;
}

const LogoContext = createContext<LogoContextType>({
  logoUrl: DEFAULT_BRANDING.logo_url,
  version: '1',
  fullLogoSrc: DEFAULT_BRANDING.logo_url,
  branding: DEFAULT_BRANDING,
  isLoading: false,
  refreshLogo: async () => {},
  updateActiveLogo: () => {},
  updateBranding: () => {},
});

export const LogoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<PlatformBranding>(DEFAULT_BRANDING);
  const [logoUrl, setLogoUrl] = useState<string>(DEFAULT_BRANDING.logo_url);
  const [version, setVersion] = useState<string>(() => Date.now().toString());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const syncFavicon = (urlWithVersion: string) => {
    try {
      const iconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement;
      if (iconLink) iconLink.href = urlWithVersion;
      const touchIconLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
      if (touchIconLink) touchIconLink.href = urlWithVersion;
    } catch {
      // Ignored
    }
  };

  const fetchActiveBrand = useCallback(async () => {
    try {
      const data = await apiRequest<PlatformBranding>('/api/settings/branding');
      if (data) {
        setBranding((prev) => ({ ...prev, ...data }));
        if (data.logo_url) {
          setLogoUrl(data.logo_url);
          const v = Date.now().toString();
          setVersion(v);
          syncFavicon(`${data.logo_url}?v=${v}`);
        }
      }
    } catch (err) {
      console.warn('Could not fetch branding from server:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveBrand();
  }, [fetchActiveBrand]);

  const updateActiveLogo = useCallback((newUrl: string, updatedAt?: string) => {
    setLogoUrl(newUrl);
    setBranding((prev) => ({ ...prev, logo_url: newUrl }));
    const newVersion = updatedAt ? new Date(updatedAt).getTime().toString() : Date.now().toString();
    setVersion(newVersion);
    syncFavicon(`${newUrl}?v=${newVersion}`);
  }, []);

  const updateBranding = useCallback((newBranding: Partial<PlatformBranding>) => {
    setBranding((prev) => ({ ...prev, ...newBranding }));
    if (newBranding.logo_url) {
      setLogoUrl(newBranding.logo_url);
    }
  }, []);

  const fullLogoSrc = logoUrl.includes('?') ? `${logoUrl}&v=${version}` : `${logoUrl}?v=${version}`;

  return (
    <LogoContext.Provider
      value={{
        logoUrl,
        version,
        fullLogoSrc,
        branding,
        isLoading,
        refreshLogo: fetchActiveBrand,
        updateActiveLogo,
        updateBranding,
      }}
    >
      {children}
    </LogoContext.Provider>
  );
};

export const useLogo = () => useContext(LogoContext);
