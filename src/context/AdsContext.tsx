// ============================================================================
//  AdsContext — reklama slotlarining "yonib/o'chishi" uchun yagona manba.
// ----------------------------------------------------------------------------
//  Sozlamalar backend'dan (/api/monetization/public → `ads`) o'qiladi, shuning
//  uchun admin panel "Monetizatsiya" bo'limidagi toggle'lar real vaqtda saytga
//  ta'sir qiladi. Hisoblangan holat kelgunicha BARCHA slotlar O'CHIQ saqlanadi
//  (default all-off) — ya'ni hozircha hech qanday reklama ko'rsatilmaydi.
// ============================================================================

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getPublicMonetization, getActiveAds } from '../lib/api.ts';
import type { AdCampaignBuckets } from '../types/index.ts';

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

const EMPTY_BUCKETS: AdCampaignBuckets = { top: [], popular: [], inline: [], sidebar: [] };

interface AdsContextValue {
  ads: AdsSettings;
  campaigns: AdCampaignBuckets;
  refresh: () => Promise<void>;
}

const AdsContext = createContext<AdsContextValue>({ ads: OFF, campaigns: EMPTY_BUCKETS, refresh: async () => {} });

export const AdsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ads, setAds] = useState<AdsSettings>(OFF);
  const [campaigns, setCampaigns] = useState<AdCampaignBuckets>(EMPTY_BUCKETS);

  const refresh = useCallback(async () => {
    // Monetizatsiya toggle'lari va aktiv kampaniyalarni parallel yuklaymiz.
    const [monRes, adsRes] = await Promise.allSettled([getPublicMonetization(), getActiveAds()]);

    if (monRes.status === 'fulfilled') {
      const a = monRes.value?.ads;
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
    } else {
      setAds(OFF);
    }

    setCampaigns(
      adsRes.status === 'fulfilled' && adsRes.value
        ? {
            top: adsRes.value.top || [],
            popular: adsRes.value.popular || [],
            inline: adsRes.value.inline || [],
            sidebar: adsRes.value.sidebar || [],
          }
        : EMPTY_BUCKETS
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <AdsContext.Provider value={{ ads, campaigns, refresh }}>{children}</AdsContext.Provider>;
};

export function useAds(): AdsContextValue {
  return useContext(AdsContext);
}
