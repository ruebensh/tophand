// ============================================================================
//  MARKAZIY REKLAMA KONFIGURATSIYASI
// ----------------------------------------------------------------------------
//  Hozircha HEGAYDIR tashqi reklama tarmog'i (masalan Google AdSense) ulanmagan —
//  shuning uchun barcha slotlar chiroyli ichki "placeholder" ko'rsatadi.
//
//  Real reklamani ulash uchun FAQAT shu fayl o'zgaradi:
//    1) `network` ni tanlang ('adsense' | 'custom' | ...).
//    2) `publisherId` va har bir joylashuv uchun `unit` (ad client / slot id) ni
//       kiriting. Keyin AdSlot avtomatik placeholder o'rniga tarmoq kodini chiqaradi.
//
//  Joylashuvlar (placement):
//    - top     : header ostidagi, yopiladigan (dismissible) banner
//    - popular : mashxur qatori o'rnidagi banner (mashxur atribut bo'lmasa)
//    - inline  : e'lonlar gridi ichida, xuddi e'lon kartidek
//    - sidebar : filtr paneli ostidagi blok
// ============================================================================

export type AdPlacement = 'top' | 'popular' | 'inline' | 'sidebar';

export interface AdUnitConfig {
  /** Bu joylashuv umuman ko'rsatilsinmi. */
  enabled: boolean;
  /** Tashqi tarmoq reklama birligi identifikatori. Bo'sh = placeholder. */
  unit?: string;
}

// Tarmoq sozlamalari (keyinchalik AdSlot shu qiymatga qarab real kod render qiladi).
export const AD_NETWORK: 'none' | 'adsense' | 'custom' = 'none';
export const AD_PUBLISHER_ID = ''; // masalan AdSense: 'ca-pub-XXXXXXXXXXXXXXXX'

export const AD_CONFIG: Record<AdPlacement, AdUnitConfig> = {
  top: { enabled: false, unit: '' },
  popular: { enabled: false, unit: '' },
  inline: { enabled: false, unit: '' },
  sidebar: { enabled: false, unit: '' },
};

// Grid ichida har nechta e'londan keyin bitta reklama kartasi qo'yilsin.
export const INLINE_AD_EVERY = 7;

// Har bir joylashuv bo'yicha reklamalarning almashish (rotatsiya) vaqti (millisekundda)
export const AD_ROTATION_INTERVALS: Record<AdPlacement, number> = {
  top: 20000,     // Header banner: 20 soniya
  popular: 15000, // Mashxur qatori: 15 soniya
  inline: 15000,  // E'lonlar orasidagi kartalar: 15 soniya
  sidebar: 15000, // Filtr ostidagi blok: 15 soniya
};

// Placeholder ko'rinishda ko'rsatiladigan matn (tarmoq ulanmaganda).
export const AD_PLACEHOLDER_LABEL = 'Reklama';
