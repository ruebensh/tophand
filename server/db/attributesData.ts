// ─── Per-category attribute schemas (Avito-style structured attributes) ─
// Archetype-based: each catalog maps to a default attribute set, with a few
// high-value per-category overrides (phones, laptops, TVs, clothing…).
// `syncCategoryAttributes()` upserts every category/subcategory's attributes
// into the `category_attributes` table (called from init.ts after seeding).

import { runQuery } from './database.ts';
import { ALL_CATALOG_CATEGORIES } from './categoriesData.ts';

export interface AttributeDef {
  key: string;
  label: string;
  type: 'select' | 'multiselect' | 'number' | 'text' | 'range' | 'bool' | 'year' | 'color';
  options?: string[];
  unit?: string;
  required?: boolean;
  filterable?: boolean;
  // Kategoriya brauzeri uchun kengaytirilgan maydonlar:
  section?: string;                              // filtr guruhi ("Asosiy", "Texnik", ...)
  isPopular?: boolean;                           // "top mashxur" qatorini haydaydi
  popularOrder?: number;                         // mashxur atributlar tartibi
  popularValues?: string[];                      // curate tartiblangan qiymatlar ro'yxati
  meta?: Record<string, any>;                     // UI konfiguratsiyasi (min/max/step, presets, control)
}

function A(
  key: string,
  label: string,
  type: AttributeDef['type'],
  extra: Partial<AttributeDef> = {}
): AttributeDef {
  return { key, label, type, filterable: true, required: false, ...extra };
}

// ─── Archetypes ────────────────────────────────────────────────────────
const GOODS: AttributeDef[] = [
  A('holat', 'Holat', 'select', { options: ['Yangi', 'Ishlatilgan', 'Qayta tiklangan'], required: true }),
  A('brend', 'Brend', 'text'),
  A('model', 'Model', 'text'),
  A('kafolat', 'Kafolat bormi', 'bool'),
];

const VEHICLES: AttributeDef[] = [
  A('yil', 'Yili', 'year', { required: true, unit: 'yil' }),
  A('probeg', 'Probeg', 'number', { unit: 'km' }),
  A('yonilgi', 'Yonilg’i', 'select', { options: ['Benzin', 'Dizel', 'Gaz', 'Gibrid', 'Elektr'] }),
  A('uzatma', 'Uzatmalar qutisi', 'select', { options: ['Mexanika', 'Avtomat', 'Variator', 'Robotlashtirilgan'] }),
  A('korpus', 'Korpus', 'select', { options: ['Sedan', 'Xetchbek', 'Universal', 'Kupe', 'Liftbek', 'Furgon', 'Pikap', 'Krossover'] }),
  A('haydovchi', 'Haydovchi', 'select', { options: ['Old', 'Orqa', 'To’liq'] }),
  A('holat', 'Holat', 'select', { options: ['Yangi', 'Ishlatilgan'], required: true }),
  A('rang', 'Rang', 'color'),
  A('kafolat', 'Kafolat bormi', 'bool'),
];

const REALTY: AttributeDef[] = [
  A('xonalar', 'Xonalar soni', 'number', { required: true }),
  A('maydon', 'Maydon', 'number', { unit: 'm²' }),
  A('qavat', 'Qavat', 'number'),
  A('qavatlar', 'Qavatlar soni', 'number'),
  A('tamir', 'Ta’mir holati', 'select', { options: ['Ta’mirsiz', 'Oltin prosvetka', 'Evro ta’mir', 'Yaxshi holatda'] }),
  A('uy_turi', 'Uy turi', 'select', { options: ['Ko’p qavatli', 'Xususiy uy', 'Yangi qurilish'] }),
  A('uchastka', 'Uchastka maydoni', 'number', { unit: 'sotki' }),
];

const ANIMALS: AttributeDef[] = [
  A('zot', 'Zot', 'text', { required: true }),
  A('yosh', 'Yosh', 'number', { unit: 'oy' }),
  A('jinsi', 'Jinsi', 'select', { options: ['Erkak', 'Urg’ochi'] }),
  A('maqsad', 'Maqsad', 'select', { options: ['Hamroh', 'Plemennoy', 'Uy uchun'] }),
  A('hujjat', 'Hujjat (metrika) bormi', 'bool'),
  A('chip', 'Chiplanganmi', 'bool'),
];

const SERVICES: AttributeDef[] = [
  A('joy', 'Bajarilish joyi', 'select', { options: ['Buyurtmachi oldida', 'Ijrochi oldida', 'Masofaviy'] }),
];

const JOBS: AttributeDef[] = [
  A('zantoklik', 'Bandlik turi', 'multiselect', { options: ['To’liq', 'Qisman', 'Vaqtinchalik', 'Stajirovka'], section: 'Asosiy' }),
  A('grafik', 'Ish grafigi', 'multiselect', { options: ['Qat’iy belgilangan', 'Egiluvchan', 'Smenali', 'Vaxta'], section: 'Asosiy' }),
  A('format', 'Ish formati', 'select', { options: ['Masofaviy', 'Ofis yoki ob’yektda', 'Gibrid', 'Yuruvchi (raz’ezdnoy)'], section: 'Asosiy' }),
  A('tajriba', 'Ish tajribasi', 'select', { options: ['Tajribasiz', '1 yildan', '1–3 yil', '3–6 yil', '6 yildan'], section: 'Asosiy' }),
  A('tolov_muddati', 'To’lov muddati', 'multiselect', { options: ['Har kuni', 'Haftada bir', 'Oyda bir', 'Oyda ikki marta', 'Oyda uch marta'], section: 'Qo’shimcha' }),
];

const HANDMADE: AttributeDef[] = [
  A('material', 'Material', 'select', { options: ['Ipak', 'Paxta', 'Jun', 'Teri', 'Yog’och', 'Kumush', 'Oltin', 'Mis', 'Loy', 'Shisha', 'Temir'], required: true }),
  A('hudud', 'Yasalgan hudud', 'select', { options: ['Marg’ilon', 'Rishton', 'G’ijduvon', 'Toshkent', 'Buxoro', 'Xiva', 'Namangan', 'Qo’qon', 'Shahrisabz'] }),
  A('texnika', 'Texnika', 'select', { options: ['Qo’lda', 'Mashinada', 'Aralash'] }),
  A('guruh', 'Guruh', 'select', { options: ['Tayyor', 'Buyurtma asosida'] }),
  A('olcham', 'O’lcham', 'text', { unit: 'sm' }),
  A('vazn', 'Vazn', 'number', { unit: 'g' }),
  A('rang', 'Rang', 'color'),
  A('muddat', 'Buyurtma muddati', 'number', { unit: 'kun' }),
  A('miqdor', 'Miqdor', 'number', { unit: 'dona' }),
  A('usta', 'Ustaning ismi', 'text'),
];

const BUSINESS_EQUIP: AttributeDef[] = [
  A('holat', 'Holat', 'select', { options: ['Yangi', 'Ishlatilgan'], required: true }),
  A('ishlatilgan', 'Ishlatilgan yili', 'year'),
  A('quvvat', 'Quvvat', 'text'),
  A('brend', 'Brend', 'text'),
  A('model', 'Model', 'text'),
];

// ─── Catalog → default archetype ───────────────────────────────────────
const CATALOG_ARCHETYPE: Record<string, AttributeDef[]> = {
  transport: VEHICLES,
  realty: REALTY,
  jobs: JOBS,
  services: SERVICES,
  personal: GOODS,
  'home-dacha': GOODS,
  parts: GOODS,
  electronics: GOODS,
  hobby: GOODS,
  animals: ANIMALS,
  business: BUSINESS_EQUIP,
  business360: BUSINESS_EQUIP,
  handmade: HANDMADE,
};

// ─── Per-category overrides (extend the GOODS base) ────────────────────
// Flagship kategoriyalar uchun boy, bo'limlarga ajratilgan filtr sxemalari.

// Ommabop avtomobil brendlari — "top mashxur" qatori + marka filtri uchun curate ro'yxat.
const CAR_BRANDS = [
  'Chevrolet', 'Hyundai', 'Kia', 'Toyota', 'Nissan', 'Volkswagen', 'Mercedes-Benz',
  'BMW', 'Lexus', 'Mitsubishi', 'Daewoo', 'Ravon', 'Chery', 'Geely', 'Haval', 'KAMAZ',
];
const PHONE_BRANDS = [
  'iPhone', 'Samsung', 'Xiaomi', 'Redmi', 'Realme', 'Oppo', 'Vivo', 'Huawei',
  'Honor', 'Nokia', 'OnePlus', 'Tecno', 'Infinix',
];

const CATEGORY_OVERRIDES: Record<string, AttributeDef[]> = {
  // ── Transport › Avtomobillar (flagship) ──
  trn_avto: [
    A('marka', 'Marka', 'select', { options: CAR_BRANDS, section: 'Asosiy', isPopular: true, popularOrder: 1, popularValues: CAR_BRANDS }),
    A('model', 'Model', 'text', { section: 'Asosiy' }),
    A('yil', 'Yili', 'range', { unit: 'yil', required: true, section: 'Asosiy', meta: { min: 1990, max: 2026, step: 1, presets: [[2022, 2026], [2018, 2021], [2014, 2017], [2010, 2013]] } }),
    A('korobka', 'Uzatmalar qutisi', 'select', { options: ['Mexanika', 'Avtomat', 'Variator', 'Robotlashtirilgan'], section: 'Texnik' }),
    A('dvigatel', 'Dvigatel yonilg’isi', 'select', { options: ['Benzin', 'Dizel', 'Gaz', 'Gibrid', 'Elektr'], section: 'Texnik' }),
    A('haydov', 'Haydovchi', 'select', { options: ['Old (FWD)', 'Orqa (RWD)', 'To’liq (4WD/AWD)'], section: 'Texnik' }),
    A('probeg', 'Probeg', 'range', { unit: 'km', section: 'Texnik', meta: { min: 0, max: 500000, step: 1000, presets: [[0, 50000], [50000, 100000], [100000, 200000], [200000, 500000]] } }),
    A('korpus', 'Korpus turi', 'multiselect', { options: ['Sedan', 'Xetchbek', 'Universal', 'Kupe', 'Liftbek', 'Furgon', 'Pikap', 'Krossover'], section: 'Texnik' }),
    A('holat', 'Holat', 'multiselect', { options: ['Yangi', 'Ishlatilgan', 'Ichki bozor', 'Chet eldan'], section: 'Holat' }),
    A('qosimcha', 'Qo’shimcha imkoniyatlar', 'multiselect', { options: ['Konditsioner', 'ABS', 'Havo xavfsizligi (airbag)', 'Parktronik', 'Kamera', 'Isitiladigan salon', 'Lyuk', 'Keyless'], section: 'Qo’shimcha' }),
    A('rang', 'Rang', 'color', { section: 'Qo’shimcha' }),
    A('kafolat', 'Kafolat bormi', 'bool', { section: 'Qo’shimcha' }),
    A('strana', 'Marka mamlakati', 'select', { options: ['Germaniya', 'Yaponiya', 'Koreya', 'AQSH', 'Xitoy', 'O’zbekiston', 'Fransiya', 'Italiya', 'Rossiya'], section: 'Asosiy' }),
    A('rul', 'Rul tomoni', 'select', { options: ['Chap', 'O’ng'], section: 'Texnik' }),
    A('dvigatel_hajmi', 'Dvigatel hajmi', 'range', { unit: 'sm³', section: 'Texnik', meta: { min: 0, max: 8000, step: 100 } }),
    A('quvvat', 'Quvvat', 'range', { unit: 'l.k.', section: 'Texnik', meta: { min: 40, max: 1000, step: 10 } }),
    A('turbina', 'Turbina', 'bool', { section: 'Texnik' }),
    A('xarajon', 'Yoqilg’i sarfi (100 km)', 'range', { unit: 'l', section: 'Texnik', meta: { min: 0, max: 30, step: 1 } }),
    A('razgon', '0–100 km/soat tezlanish', 'range', { unit: 'sek', section: 'Texnik', meta: { min: 0, max: 25, step: 1 } }),
    A('orinlar', 'O’rindiqlar soni', 'select', { options: ['2', '4', '5', '6', '7', '8+'], section: 'Texnik' }),
    A('bagajnik', 'Bagajnik hajmi', 'range', { unit: 'l', section: 'Texnik', meta: { min: 0, max: 1000, step: 10 } }),
    A('klirens', 'Klirens', 'range', { unit: 'mm', section: 'Texnik', meta: { min: 80, max: 400, step: 5 } }),
    A('egalar', 'PPT egalar soni', 'select', { options: ['Ahamiyati yo’q', 'Bitta', 'Ikkitagacha', 'Uchtagacha'], section: 'Holat' }),
    A('zararlangan', 'Zarar holati', 'select', { options: ['Barchasi', 'Sinmaganlar', 'Faqat sinmagan'], section: 'Holat' }),
    A('gai_reg', 'GAHDa ro’yxatdan o’tgan', 'select', { options: ['Ahamiyati yo’q', 'Bor', 'Yo’q'], section: 'Holat' }),
    A('sotuvchi', 'Sotuvchi', 'select', { options: ['Barchasi', 'Dilerlar', 'Xususiy'], section: 'Qo’shimcha' }),
    A('kredit', 'Kreditga beriladi', 'bool', { section: 'Qo’shimcha' }),
  ],

  // ── Transport › Yuk mashinalari (fura/gruzovik) ──
  trn_gruz_gruzovik: [
    A('brend', 'Marka', 'select', { options: ['KAMAZ', 'Howo', 'Shacman', 'Mercedes-Benz', 'Volvo', 'MAN', 'Scania', 'DAF', 'Isuzu', 'Hyundai', 'FAW', 'Dongfeng'], section: 'Asosiy', isPopular: true, popularOrder: 1, popularValues: ['KAMAZ', 'Howo', 'Shacman', 'Mercedes-Benz', 'Volvo', 'MAN', 'Isuzu'] }),
    A('model', 'Model', 'text', { section: 'Asosiy' }),
    A('yil', 'Yili', 'range', { unit: 'yil', section: 'Asosiy', meta: { min: 1990, max: 2026, step: 1 } }),
    A('korpus_turi', 'Kuzov turi', 'select', { options: ['Fura (tent)', 'Refrijerator', 'Avtotsisterna', 'Bortli', 'Samosval', 'Tyalga', 'Evakuator', 'Kran'], section: 'Asosiy' }),
    A('holat', 'Holat', 'select', { options: ['Yangi', 'Ishlatilgan'], section: 'Holat' }),
    A('probeg', 'Probeg', 'range', { unit: 'km', section: 'Texnik', meta: { min: 0, max: 1500000, step: 10000 } }),
    A('massa', 'Ruxsat etilgan maksimal massa', 'range', { unit: 't', section: 'Texnik', meta: { min: 0, max: 60, step: 1 } }),
    A('dvigatel_hajmi', 'Dvigatel hajmi', 'range', { unit: 'sm³', section: 'Texnik', meta: { min: 0, max: 16000, step: 500 } }),
    A('quvvat', 'Quvvat', 'range', { unit: 'l.k.', section: 'Texnik', meta: { min: 100, max: 700, step: 10 } }),
    A('yonilgi', 'Yonilg’i', 'select', { options: ['Dizel', 'Benzin', 'Gaz', 'Elektr'], section: 'Texnik' }),
    A('korobka', 'Uzatmalar qutisi', 'select', { options: ['Mexanika', 'Avtomat', 'Robotlashtirilgan'], section: 'Texnik' }),
  ],

  // ── Transport › Moto va moto-texnika ──
  trn_moto: [
    A('brend', 'Brend', 'select', { options: ['Honda', 'Yamaha', 'Suzuki', 'Kawasaki', 'BMW', 'Stels', 'Racer', 'Viper', 'Bajaj'], section: 'Asosiy', isPopular: true, popularOrder: 1, popularValues: ['Honda', 'Yamaha', 'Suzuki', 'Kawasaki', 'Stels', 'Racer', 'Viper'] }),
    A('model', 'Model', 'text', { section: 'Asosiy' }),
    A('yil', 'Yili', 'range', { unit: 'yil', section: 'Asosiy', meta: { min: 1990, max: 2026, step: 1 } }),
    A('dvigatel_hajm', 'Dvigatel hajmi', 'range', { unit: 'sm³', section: 'Texnik', meta: { min: 50, max: 1500, step: 50 } }),
    A('probeg', 'Probeg', 'range', { unit: 'km', section: 'Texnik', meta: { min: 0, max: 100000, step: 1000 } }),
    A('turi', 'Turi', 'multiselect', { options: ['Motosikl', 'Skuter', 'Kvadrotsikl', 'Tur', 'Sport', 'Changgi'], section: 'Texnik' }),
    A('holat', 'Holat', 'select', { options: ['Yangi', 'Ishlatilgan'], section: 'Holat' }),
    A('strana', 'Marka mamlakati', 'select', { options: ['Yaponiya', 'Xitoy', 'Germaniya', 'Italiya', 'AQSH', 'Koreya'], section: 'Asosiy' }),
    A('quvvat', 'Quvvat', 'range', { unit: 'l.k.', section: 'Texnik', meta: { min: 1, max: 250, step: 1 } }),
  ],

  // ── Elektronika › Mobil telefonlar (flagship) ──
  el_phone_mob: [
    A('brend', 'Brend', 'select', { options: PHONE_BRANDS, section: 'Asosiy', isPopular: true, popularOrder: 1, popularValues: PHONE_BRANDS }),
    A('model', 'Model', 'text', { section: 'Asosiy' }),
    A('holat', 'Holat', 'multiselect', { options: ['Yangi', 'Ishlatilgan', 'Qayta tiklangan'], section: 'Holat', required: true }),
    A('xotira', 'O’z xotirasi', 'multiselect', { options: ['16', '32', '64', '128', '256', '512', '1TB'], unit: 'GB', section: 'Texnik' }),
    A('operativ', 'Operativ xotira (RAM)', 'select', { options: ['2', '3', '4', '6', '8', '12', '16'], unit: 'GB', section: 'Texnik' }),
    A('ekran', 'Ekran', 'select', { options: ['5.5 dan kichik', '5.5–6.4', '6.5 dan katta'], section: 'Texnik' }),
    A('rang', 'Rang', 'color', { section: 'Texnik' }),
    A('kafolat', 'Kafolat bormi', 'bool', { section: 'Qo’shimcha' }),
  ],

  el_laptop: [
    ...GOODS,
    A('protsessor', 'Protsessor', 'text', { section: 'Texnik' }),
    A('ram', 'RAM', 'text', { unit: 'GB', section: 'Texnik' }),
    A('ssd', 'SSD/HDD', 'text', { section: 'Texnik' }),
    A('ekran', 'Ekran', 'number', { unit: 'dyuym', section: 'Texnik' }),
  ],
  el_desktop: [
    ...GOODS,
    A('protsessor', 'Protsessor', 'text', { section: 'Texnik' }),
    A('ram', 'RAM', 'text', { unit: 'GB', section: 'Texnik' }),
    A('ssd', 'SSD/HDD', 'text', { section: 'Texnik' }),
  ],
  el_av_tv: [
    ...GOODS,
    A('diagonal', 'Diagonal', 'number', { unit: 'dyuym', section: 'Texnik' }),
    A('ruxsat', 'Ruxsat', 'select', { options: ['HD', 'Full HD', '4K UHD'], section: 'Texnik' }),
    A('smart', 'Smart TV', 'bool', { section: 'Texnik' }),
  ],

  // ── Ko’chmas mulk › Uy-joy sotib olish / ijara (flagship) ──
  rlt_buy: [
    A('uy_turi', 'Uy turi', 'multiselect', { options: ['Ko’p qavatli', 'Xususiy uy', 'Yangi qurilish', 'Xona', 'Uchastka'], section: 'Asosiy', isPopular: true, popularOrder: 1, popularValues: ['Ko’p qavatli', 'Xususiy uy', 'Yangi qurilish', 'Xona'] }),
    A('xonalar', 'Xonalar soni', 'multiselect', { options: ['1', '2', '3', '4', '5+'], section: 'Asosiy' }),
    A('maydon', 'Umumiy maydon', 'range', { unit: 'm²', section: 'Asosiy', meta: { min: 15, max: 500, step: 5, presets: [[15, 45], [45, 70], [70, 100], [100, 500]] } }),
    A('qavat', 'Qavat', 'range', { section: 'Texnik', meta: { min: 1, max: 30, step: 1 } }),
    A('qavatlar', 'Qavatlar soni', 'number', { section: 'Texnik' }),
    A('tamir', 'Ta’mir holati', 'select', { options: ['Ta’mirsiz', 'Oltin prosvetka', 'Evro ta’mir', 'Yaxshi holatda', 'Lyuks'], section: 'Holat' }),
    A('uchastka', 'Uchastka maydoni', 'range', { unit: 'sotki', section: 'Qo’shimcha', meta: { min: 0, max: 100, step: 1 } }),
    A('qavat_belgi', 'Qavat belgilari', 'multiselect', { options: ['Birinchi emas', 'Oxirgi emas', 'Faqat oxirgi'], section: 'Texnik' }),
    A('god_postroyki', 'Bino qurilgan yili', 'range', { unit: 'yil', section: 'Texnik', meta: { min: 1950, max: 2026, step: 1 } }),
    A('etajey', 'Bindagi qavatlar soni', 'range', { section: 'Texnik', meta: { min: 1, max: 60, step: 1 } }),
    A('dom_turi', 'Bino turi', 'multiselect', { options: ['G’isht', 'Panel', 'Blok', 'Monolit', 'Monolit-g’isht', 'Yog’och'], section: 'Texnik' }),
    A('lift', 'Lift', 'multiselect', { options: ['Passajirli', 'Yuk tashish'], section: 'Qo’shimcha' }),
    A('parkovka', 'Parkovka', 'multiselect', { options: ['Yerto’la', 'Ko’p qavatli ochiq', 'Hovlidagi ochiq'], section: 'Qo’shimcha' }),
    A('sanzjol', 'Hojatxona', 'select', { options: ['Birlashgan', 'Alohida'], section: 'Qo’shimcha' }),
    A('okna', 'Deraza qaragan', 'multiselect', { options: ['Hovliga', 'Ko’chaga', 'Quyosh tomon'], section: 'Qo’shimcha' }),
    A('ipoteka', 'Ipotekaga bo’ladi', 'bool', { section: 'Qo’shimcha' }),
    A('sotuvchi', 'Sotuvchi', 'select', { options: ['Xususiy', 'Quruvchi (zastroshchik)', 'Agentliklar'], section: 'Qo’shimcha' }),
  ],
  rlt_arenda: [
    A('uy_turi', 'Uy turi', 'multiselect', { options: ['Kvartira', 'Xususiy uy', 'Xona', 'Ofis', 'Ombor'], section: 'Asosiy', isPopular: true, popularOrder: 1, popularValues: ['Kvartira', 'Xususiy uy', 'Xona', 'Ofis'] }),
    A('xonalar', 'Xonalar soni', 'multiselect', { options: ['1', '2', '3', '4', '5+'], section: 'Asosiy' }),
    A('maydon', 'Umumiy maydon', 'range', { unit: 'm²', section: 'Asosiy', meta: { min: 15, max: 1000, step: 5 } }),
    A('muddat', 'Ijara muddati', 'select', { options: ['Kunlik', 'Oylik', 'Uzoq muddat'], section: 'Holat' }),
    A('qavat', 'Qavat', 'range', { section: 'Texnik', meta: { min: 1, max: 30, step: 1 } }),
    A('tamir', 'Ta’mir holati', 'select', { options: ['Ta’mirsiz', 'Oltin prosvetka', 'Evro ta’mir', 'Yaxshi holatda', 'Lyuks'], section: 'Holat' }),
  ],

  per_clothing: [
    A('holat', 'Holat', 'select', { options: ['Birki bilan yangi', 'A’lo holatda', 'Yaxshi holatda', 'Qoniqarli holatda'], required: true, section: 'Asosiy' }),
    A('olcham', 'O’lcham', 'text', { section: 'Asosiy' }),
    A('mavsum', 'Mavsum', 'select', { options: ['Qishki', 'Yozgi', 'Yarim mavsum', 'Butun yil'], section: 'Asosiy' }),
    A('material', 'Material', 'text', { section: 'Texnik' }),
    A('rang', 'Rang', 'color', { section: 'Texnik' }),
    A('brend', 'Brend', 'text', { section: 'Texnik' }),
  ],

  // ── Ehtiyot qismlar › Shinalar (flagship) ──
  prt_wheel_tire: [
    A('diametr', 'Diametr', 'select', { options: ['R13', 'R14', 'R15', 'R16', 'R17', 'R18', 'R19', 'R20', 'R21', 'R22'], section: 'Asosiy', isPopular: true, popularOrder: 1, popularValues: ['R15', 'R16', 'R17', 'R14', 'R13', 'R18'] }),
    A('kenglik', 'Profil kengligi', 'select', { options: ['155', '165', '175', '185', '195', '205', '215', '225', '235', '245', '255', '265', '275', '285'], section: 'Asosiy' }),
    A('balandlik', 'Profil balandligi', 'select', { options: ['30', '35', '40', '45', '50', '55', '60', '65', '70', '75', '80'], section: 'Asosiy' }),
    A('mavsum', 'Mavsumiylik', 'select', { options: ['Qishki (shipovsiz)', 'Qishki (shipovli)', 'Yozgi', 'Butun mavsum'], section: 'Texnik' }),
    A('ishlab_chiqaruvchi', 'Ishlab chiqaruvchi', 'text', { section: 'Texnik' }),
    A('run_flat', 'RunFlat', 'bool', { section: 'Texnik' }),
    A('komplekt', 'Komplektlik', 'select', { options: ['1 ta', '2 ta', '4 ta'], section: 'Texnik' }),
    A('holat', 'Holat', 'select', { options: ['Yangi', 'Ishlatilgan'], section: 'Holat' }),
  ],

  // ── Uy va dacha › Divan va karavotlar ──
  hom_furn_bed: [
    A('holat', 'Holat', 'select', { options: ['Har qanday', 'Yangi', 'Ishlatilgan'], required: true, section: 'Asosiy' }),
    A('forma', 'Shakl', 'multiselect', { options: ['To’g’ri', 'Burchakli', 'P-simon', 'Yarim doira', 'Dumaloq'], section: 'Asosiy' }),
    A('modul', 'Modulli', 'bool', { section: 'Asosiy' }),
    A('yechish', 'Yechiladigan mexanizm', 'select', { options: ['Kitob', 'Yevro-kitob', 'Pantograf', 'Delfin', 'Akkordeon'], section: 'Texnik' }),
    A('bolalar', 'Bolalar uchun', 'bool', { section: 'Qo’shimcha' }),
    A('rang', 'Rang', 'color', { section: 'Qo’shimcha' }),
    A('material', 'Material', 'text', { section: 'Qo’shimcha' }),
  ],
};

function resolveAttrs(catalogId: string, categoryId: string): AttributeDef[] {
  return CATEGORY_OVERRIDES[categoryId] ?? CATALOG_ARCHETYPE[catalogId] ?? GOODS;
}

// ─── Build + upsert all category attribute rows ────────────────────────
interface AttrRow {
  id: string;
  category_id: string;
  key: string;
  label: string;
  type: string;
  options: string;
  unit: string | null;
  required: number;
  filterable: number;
  sort_order: number;
  is_popular: number;
  popular_order: number;
  popular_values: string;
  section: string;
  meta: string;
}

function buildRows(): AttrRow[] {
  const rows: AttrRow[] = [];
  for (const cat of ALL_CATALOG_CATEGORIES) {
    const catalogId = cat.catalog_id || 'services';
    const emit = (targetId: string, orderBase: number) => {
      const attrs = resolveAttrs(catalogId, targetId);
      attrs.forEach((a, i) => {
        rows.push({
          id: `attr_${targetId}_${a.key}`,
          category_id: targetId,
          key: a.key,
          label: a.label,
          type: a.type,
          options: JSON.stringify(a.options ?? []),
          unit: a.unit ?? null,
          required: a.required ? 1 : 0,
          filterable: a.filterable === false ? 0 : 1,
          sort_order: orderBase * 100 + i,
          is_popular: a.isPopular ? 1 : 0,
          popular_order: a.popularOrder ?? 0,
          popular_values: JSON.stringify(a.popularValues ?? []),
          section: a.section ?? 'Asosiy',
          meta: JSON.stringify(a.meta ?? {}),
        });
      });
    };
    emit(cat.id, 0);
    cat.subs.forEach((sub, si) => emit(sub.id, si + 1));
  }
  return rows;
}

export async function syncCategoryAttributes() {
  const rows = buildRows();
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const placeholders: string[] = [];
    const params: any[] = [];
    for (const r of batch) {
      placeholders.push('(?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?::jsonb)');
      params.push(
        r.id, r.category_id, r.key, r.label, r.type, r.options, r.unit, r.required, r.filterable, r.sort_order,
        r.is_popular, r.popular_order, r.popular_values, r.section, r.meta
      );
    }
    await runQuery(
      `INSERT INTO category_attributes
         (id, category_id, key, label_uz, type, options, unit, required, filterable, sort_order,
          is_popular, popular_order, popular_values, section, meta)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (category_id, key) DO NOTHING`,
      params
    );
  }
  console.log(`✅ Category attributes synced (seed-only, admin edits preserved): ${rows.length} definitions offered.`);
}
