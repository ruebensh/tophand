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
  favicon_light_url: string;
  favicon_dark_url: string;
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
  favicon_light_url: '/favicon-light.png',
  favicon_dark_url: '/favicon-dark.png',
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

  // Favicon — sayt logo'sidan MUSTAQIL. Ikkita variantni prefers-color-scheme
  // media-query orqali qo'llaymiz: yorug' tab uchun light, qorong'i tab uchun dark.
  const applyFavicon = (lightUrl: string, darkUrl: string, version: string) => {
    try {
      const sep = (u: string) => (u.includes('?') ? '&' : '?');
      // Mavjud <link> ni butunlay o'chirib, yangi nod sifatida qo'shamiz. Bu
      // Chrome'da tab ikonkasini jonli qayta chizishni majburlaydi (faqat href
      // o'zgartirish ba'zan repaint qilmaydi).
      const swap = (id: string, media: string, href: string) => {
        document.querySelectorAll(`link#${id}`).forEach((n) => n.remove());
        const el = document.createElement('link');
        el.id = id;
        el.rel = 'icon';
        el.type = 'image/png';
        if (media) el.media = media;
        el.href = href;
        document.head.appendChild(el);
      };
      swap('favicon-light', '(prefers-color-scheme: light)', `${lightUrl}${sep(lightUrl)}v=${version}`);
      swap('favicon-dark', '(prefers-color-scheme: dark)', `${darkUrl}${sep(darkUrl)}v=${version}`);

      let touch = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
      if (!touch) {
        touch = document.createElement('link');
        touch.rel = 'apple-touch-icon';
        document.head.appendChild(touch);
      }
      touch.href = `${lightUrl}${sep(lightUrl)}v=${version}`;
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
          setVersion(Date.now().toString());
        }
        // Favicon sayt logo'sidan mustaqil — light/dark variantlarni qo'llaymiz.
        applyFavicon(
          data.favicon_light_url || DEFAULT_BRANDING.favicon_light_url,
          data.favicon_dark_url || DEFAULT_BRANDING.favicon_dark_url,
          Date.now().toString()
        );
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
    // Eslatma: sayt logosi endi favicon'ga ta'sir QILMAYDI — favicon alohida boshqariladi.
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
