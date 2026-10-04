// ============================================================================
//  AdsContext — reklama slotlarining "yonib/o'chishi" uchun yagona manba.
// ----------------------------------------------------------------------------
//  Sozlamalar backend'dan (/api/monetization/public → `ads`) o'qiladi, shuning
//  uchun admin panel "Monetizatsiya" bo'limidagi toggle'lar real vaqtda saytga
//  ta'sir qiladi. Hisoblangan holat kelgunicha BARCHA slotlar O'CHIQ saqlanadi
//  (default all-off) — ya'ni hozircha hech qanday reklama ko'rsatilmaydi.
// ============================================================================

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getPublicMonetization } from '../lib/api.ts';

export interface AdsSettings {
  enabled: boolean;
  top: boolean;
  popular: boolean;
  inline: boolean;
  sidebar: boolean;
  inlineEvery: number;
}

// Xavfsiz zaxira: server javob bermasa ham hech narsa ko'rsatilmaydi.
const OFF: AdsSettings = {
  enabled: false, top: false, popular: false, inline: false, sidebar: false, inlineEvery: 7,
};

interface AdsContextValue {
  ads: AdsSettings;
  refresh: () => Promise<void>;
}

const AdsContext = createContext<AdsContextValue>({ ads: OFF, refresh: async () => {} });

export const AdsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ads, setAds] = useState<AdsSettings>(OFF);

  const refresh = useCallback(async () => {
    try {
      const data = await getPublicMonetization();
      const a = data?.ads;
      setAds(
        a
          ? {
              enabled: Boolean(a.enabled),
              top: Boolean(a.top),
              popular: Boolean(a.popular),
              inline: Boolean(a.inline),
              sidebar: Boolean(a.sidebar),
              inlineEvery: Number(a.inline_every) > 0 ? Number(a.inline_every) : 7,
            }
          : OFF
      );
    } catch {
      setAds(OFF);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <AdsContext.Provider value={{ ads, refresh }}>{children}</AdsContext.Provider>;
};

export function useAds(): AdsContextValue {
  return useContext(AdsContext);
}
