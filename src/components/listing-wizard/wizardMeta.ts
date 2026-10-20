// ============================================================================
//  wizardMeta — wizard bo'ylab ishlatiladigan statistik ma'lumotlar.
//  Asl CreateListingPage'dagi konstantalar shu yerga ko'chirildi (duplikatdan
//  qochish uchun sahifa ham shu modulni import qiladi).
// ============================================================================

import type { ListingType } from '../../types/index.ts';

// Katalog bo'yicha barqaror rang toni (Header/HomePage bilan mos).
export const CAT_TONE: Record<string, string> = {
  transport: 'blue', realty: 'amber', jobs: 'violet', services: 'teal',
  personal: 'rose', 'home-dacha': 'orange', parts: 'cyan', electronics: 'indigo',
  hobby: 'lime', animals: 'emerald', business: 'sky', business360: 'fuchsia', handmade: 'red',
};

// Listing turi uchun meta (13 katalog bo'ylab umumiy).
export const TYPE_META: Record<ListingType, { label: string; hint: string; emoji: string }> = {
  SELL: { label: 'Sotaman', hint: "Buyumingizni sotuvga joylang", emoji: '🏷️' },
  WANTED: { label: 'Izlayman', hint: "Kerakli narsa bo'yicha so'rov yuboring", emoji: '🔎' },
  RENT_OUT: { label: 'Ijaraga beraman', hint: 'Obyekt yoki uskunani ijaraga bering', emoji: '🔑' },
  RENT_WANTED: { label: 'Ijara izlayman', hint: "Ijaraga olmoqchi bo'lgan narsangiz", emoji: '🏠' },
  SERVICE_OFFER: { label: "Xizmat ko'rsataman", hint: "Ustalik/xizmat taklifingizni joylang", emoji: '🛠️' },
  SERVICE_REQUEST: { label: 'Xizmat izlayman', hint: "Kerakli xizmat uchun so'rov joylang", emoji: '🧰' },
  JOB_OPENING: { label: 'Vakansiya joylash', hint: "Kompaniyangizga xodim izlayapsiz", emoji: '💼' },
  JOB_SEEKER: { label: 'Rezyume (ish izlayman)', hint: "O'zingiz ish qidiryapsiz", emoji: '👤' },
};

// Xizmatlar uchun tezkor "afzalliklar" chiplari.
export const PRESET_FEATURES = [
  "Kafolat beriladi (100%)",
  "Tezkor yetib borish (30–60 daqiqa)",
  "O'z professional asboblari bor",
  "Rasmiy shartnoma va chek",
  "Bepul maslahat va o'lchash",
  "24/7 xizmat ko'rsatish",
  "Tajribali mutaxassis (5+ yil)",
  "Hamyonbop va kelishilgan narx",
];
