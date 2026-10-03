// ─── Multi-sector catalog taxonomy (Avito-style) ───────────────────────
// 13 catalogs, each with categories → subcategories. Jobs carries TWO trees
// via `scope` (JOB_OPENING = vacancies by function, JOB_SEEKER = resumes by industry).
// IDs are globally unique (prefixed per catalog) because categories.id is the PK.
// NOTE: Uzbek apostrophes use the typographic ’ (U+2019) to avoid escaping.

export interface CategorySeedItem {
  id: string;
  name_uz: string;
  slug: string;
  icon: string;
  parent_id?: string | null;
  sort_order: number;
}

export interface CatalogSpec {
  id: string;
  name_uz: string;
  slug: string;
  icon: string;
  description: string;
  listing_types: string;
  sort_order: number;
}

export interface ParentCategorySpec {
  id: string;
  catalog_id?: string;
  name_uz: string;
  slug: string;
  icon: string;
  scope?: string | null;
  subs: { id: string; name_uz: string; slug: string }[];
}

// ─── Helpers ───────────────────────────────────────────────────────────
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ʻ’'`´]/g, '')
    .replace(/[^a-z0-9\u0400-\u04FF]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

type RawSub = [id: string, name: string];

function parent(
  id: string,
  name: string,
  icon: string,
  catalog_id: string,
  subs: RawSub[],
  scope: string | null = null
): ParentCategorySpec {
  return {
    id,
    name_uz: name,
    slug: slugify(name),
    icon,
    catalog_id,
    scope,
    subs: subs.map(([sid, sname]) => ({ id: sid, name_uz: sname, slug: slugify(sname) })),
  };
}

// ─── Catalogs (13) ─────────────────────────────────────────────────────
export const CATALOGS_LIST: CatalogSpec[] = [
  { id: 'transport', name_uz: 'Transport', slug: 'transport', icon: 'Car', description: 'Avtomobillar, moto, yuk va maxsus texnika, suv transporti', listing_types: 'SELL,RENT_OUT', sort_order: 1 },
  { id: 'realty', name_uz: 'Ko’chmas mulk', slug: 'kochmas-mulk', icon: 'Building2', description: 'Uy-joy, ijara va tijorat ko’chmas mulki', listing_types: 'SELL,RENT_OUT', sort_order: 2 },
  { id: 'jobs', name_uz: 'Ish e’lonlari', slug: 'ish-elonlari', icon: 'Briefcase', description: 'Vakansiyalar va mutaxassis rezyumelari', listing_types: 'JOB_OPENING,JOB_SEEKER', sort_order: 3 },
  { id: 'services', name_uz: 'Xizmatlar', slug: 'xizmatlar', icon: 'Wrench', description: 'Ustalar, xizmat ko’rsatuvchilar va maishiy xizmatlar', listing_types: 'SERVICE_OFFER,SERVICE_REQUEST', sort_order: 4 },
  { id: 'personal', name_uz: 'Shaxsiy buyumlar', slug: 'shaxsiy-buyumlar', icon: 'Shirt', description: 'Kiyim, poyabzal, bolalar tovarlari, ziynat', listing_types: 'SELL,WANTED', sort_order: 5 },
  { id: 'home-dacha', name_uz: 'Uy va dacha', slug: 'uy-va-dacha', icon: 'Home', description: 'Mebel, maishiy texnika, oziq-ovqat, o’simliklar', listing_types: 'SELL,WANTED', sort_order: 6 },
  { id: 'parts', name_uz: 'Ehtiyot qismlar va aksessuarlar', slug: 'ehtiyot-qismlar', icon: 'Cog', description: 'Zapchast, shina, moy, jihoz va GPS', listing_types: 'SELL,WANTED', sort_order: 7 },
  { id: 'electronics', name_uz: 'Elektronika', slug: 'elektronika', icon: 'Smartphone', description: 'Telefon, kompyuter, audio-video, foto texnika', listing_types: 'SELL,WANTED', sort_order: 8 },
  { id: 'hobby', name_uz: 'Hobbi va dam olish', slug: 'hobbi-va-dam-olish', icon: 'Bike', description: 'Velosiped, kitob, kolleksiya, sport, musiqa asboblari', listing_types: 'SELL,WANTED', sort_order: 9 },
  { id: 'animals', name_uz: 'Hayvonlar', slug: 'hayvonlar', icon: 'PawPrint', description: 'It, mushuk, qush, akvarium va hayvonlar tovarlari', listing_types: 'SELL,WANTED', sort_order: 10 },
  { id: 'business', name_uz: 'Biznes va uskunalar', slug: 'biznes-va-uskunalar', icon: 'Factory', description: 'Biznes uskunalar, franshiza, tayyor biznes va PO', listing_types: 'SELL,SERVICE_OFFER', sort_order: 11 },
  { id: 'business360', name_uz: 'Biznes 360', slug: 'biznes-360', icon: 'Landmark', description: 'B2B hub: uskunalar, transport, xizmat va tovarlar', listing_types: 'SELL,SERVICE_OFFER', sort_order: 12 },
  { id: 'handmade', name_uz: 'Hunarmandlar / Qo’llanma mehnat', slug: 'hunarmandlar', icon: 'Gem', description: 'Qo’lda yasalgan milliy buyumlar va sovg’alar (faqat sotish)', listing_types: 'SELL', sort_order: 13 },
];

// ─── SERVICES (Xizmatlar) — 34 categories ──────────────────────────────
const SERVICES: ParentCategorySpec[] = [
  parent('svc_avto_servis', 'Avto servis, ijara', 'Car', 'services', [
    ['svc_avto_servis_auto', 'Avtomobillar uchun avtoservislar'],
    ['svc_avto_servis_gruz', 'Yuk va maxsus texnika avtoservislar'],
    ['svc_avto_servis_other', 'Boshqa texnika avtoservislar'],
    ['svc_avto_servis_arenda', 'Avto ijarasi'],
    ['svc_avto_servis_spec_arenda', 'Maxsus texnika ijarasi'],
  ]),
  parent('svc_perevozki', 'Yuk tashish va yetkazish', 'Truck', 'services', [
    ['svc_perevozki_city', 'Shahar bo’ylab'],
    ['svc_perevozki_inter', 'Shaharlararo'],
    ['svc_perevozki_intl', 'Xalqaro'],
    ['svc_perevozki_birja', 'Yuk birjasi'],
  ]),
  parent('svc_passazhir', 'Yo’lovchi tashish', 'Bus', 'services', [
    ['svc_passazhir_transfer', 'Transfer'],
    ['svc_passazhir_zakaz', 'Avto zakazga'],
    ['svc_passazhir_other', 'Boshqalar'],
  ]),
  parent('svc_gruzchiki', 'Gruvchiklar, ombor xizmatlari', 'Package', 'services', [
    ['svc_gruzchiki_gruz', 'Gruvchiklar'],
    ['svc_gruzchiki_fulfilment', 'Fulfilment'],
  ]),
  parent('svc_evakuator', 'Evakuator xizmati', 'TriangleAlert', 'services', []),
  parent('svc_tamirlash', 'Ta’mirlash va bezash', 'Paintbrush', 'services', [
    ['svc_tamirlash_key', 'Kvartira va uylarni kalit ta’mirlash'],
    ['svc_tamirlash_dizayn', 'Ichki dizayn'],
    ['svc_tamirlash_santexnika', 'Santexnika'],
    ['svc_tamirlash_elektrika', 'Elektrika'],
    ['svc_tamirlash_mebel', 'Mebel yig’ish va ta’mirlash'],
    ['svc_tamirlash_deraza', 'Deraza va balkonlar'],
    ['svc_tamirlash_master', 'Bir soatga usta'],
    ['svc_tamirlash_qulf', 'Qulf ochish va ta’mirlash'],
    ['svc_tamirlash_oboy', 'Oboy va bo’yoq ishlari'],
    ['svc_tamirlash_shift', 'Shiftlar'],
    ['svc_tamirlash_pol', 'Pol va qoplamalar'],
    ['svc_tamirlash_suvoq', 'Suvoq ishlari'],
    ['svc_tamirlash_eshik', 'Eshiklar'],
    ['svc_tamirlash_plitka', 'Plitka ishlari'],
    ['svc_tamirlash_duradgor', 'Duradgorlik ishlari'],
    ['svc_tamirlash_gipsokarton', 'Gipsokarton ishlari'],
    ['svc_tamirlash_balandlik', 'Balandlikdagi ishlar'],
    ['svc_tamirlash_izolyatsiya', 'Izolyatsiya va isitish'],
    ['svc_tamirlash_tijorat', 'Tijorat binolari ta’miri'],
    ['svc_tamirlash_vent', 'Ventilyatsiya'],
    ['svc_tamirlash_other', 'Boshqalar'],
  ]),
  parent('svc_qurilish', 'Qurilish', 'Hammer', 'services', [
    ['svc_qurilish_uy', 'Uy qurish (kalit topshirish)'],
    ['svc_qurilish_garaj', 'Garaj, banno, veranda qurish'],
    ['svc_qurilish_yogoch', 'Yog’och uylar/banno/sauna bezash'],
    ['svc_qurilish_gisht', 'Gisht terish (kladka)'],
    ['svc_qurilish_tom', 'Tom yopish (krovlya)'],
    ['svc_qurilish_payvand', 'Payvand, kovka, metallokonstruksiya'],
    ['svc_qurilish_fundament', 'Fundament va beton ishlari'],
    ['svc_qurilish_olmos', 'Olmos burg’ulash va kesish'],
    ['svc_qurilish_snos', 'Snos va demontaj'],
    ['svc_qurilish_fasad', 'Fasad ishlari'],
    ['svc_qurilish_loyiha', 'Loyiha va smeta'],
    ['svc_qurilish_ishchi', 'Umumiy ishchilar (raznorabochie)'],
    ['svc_qurilish_sorov', 'So’rov (izyskatelnie) ishlari'],
    ['svc_qurilish_zina', 'Zinalar'],
    ['svc_qurilish_gaz', 'Gazlashtirish'],
    ['svc_qurilish_tijorat', 'Tijorat qurilish'],
    ['svc_qurilish_other', 'Boshqalar'],
  ]),
  parent('svc_bog', 'Bog’, obodonlashtirish', 'Trees', 'services', [
    ['svc_bog_quduq', 'Quduq, skvajina, septik'],
    ['svc_bog_suv', 'Suv havzalari, basseyn, favvora'],
    ['svc_bog_yol', 'Yo’l qurilishi'],
    ['svc_bog_tosiq', 'To’siq, naves, rolikli panjaralar'],
    ['svc_bog_yer', 'Yer qazish ishlari'],
    ['svc_bog_kokalam', 'Ko’kalamzorlashtirish, bog’ parvari'],
    ['svc_bog_other', 'Boshqalar'],
  ]),
  parent('svc_gozallik', 'Go’zallik', 'Sparkles', 'services', [
    ['svc_gozallik_manikyur', 'Manikyur, pedikyur'],
    ['svc_gozallik_sartarosh', 'Soch olish xizmatlari'],
    ['svc_gozallik_barber', 'Barber xizmatlari'],
    ['svc_gozallik_kirpik', 'Kirpik, qosh'],
    ['svc_gozallik_perm', 'Doimiy bo’yanish'],
    ['svc_gozallik_kosmetolog', 'Kosmetologiya'],
    ['svc_gozallik_epil', 'Epilyatsiya'],
    ['svc_gozallik_makiyaj', 'Makiyaj'],
    ['svc_gozallik_spa', 'SPA xizmatlari, massaj'],
    ['svc_gozallik_tatu', 'Tatuirovka, pirsing'],
    ['svc_gozallik_ishjoyi', 'Ish joyini ijaraga'],
    ['svc_gozallik_other', 'Boshqalar'],
  ]),
  parent('svc_somatlik', 'Salomatlik', 'HeartPulse', 'services', [
    ['svc_somatlik_psixolog', 'Psixologiya'],
    ['svc_somatlik_dietolog', 'Dietologiya'],
    ['svc_somatlik_fitnes', 'Fitnes, yoga'],
    ['svc_somatlik_stomatolog', 'Stomatologiya'],
    ['svc_somatlik_podolog', 'Podologiya'],
    ['svc_somatlik_other', 'Boshqalar'],
  ]),
  parent('svc_medsitsina', 'Meditsina', 'Stethoscope', 'services', [
    ['svc_medsitsina_vrach', 'Vrachlar qabuli'],
    ['svc_medsitsina_tahlil', 'Tahlillar va laboratoriya'],
    ['svc_medsitsina_uzi', 'UZI va funksional diagnostika'],
    ['svc_medsitsina_mrt', 'MRT va KT'],
    ['svc_medsitsina_reabilit', 'Reabilitatsiya va tibbiy massaj'],
    ['svc_medsitsina_hamshira', 'Hamshira xizmatlari'],
    ['svc_medsitsina_ko', 'Ko’rik va profilaktika'],
    ['svc_medsitsina_other', 'Boshqalar'],
  ]),
  parent('svc_texnika_tamir', 'Texnika ta’miri va xizmati', 'Wrench', 'services', [
    ['svc_texnika_tamir_tv', 'Televizorlar'],
    ['svc_texnika_tamir_mobile', 'Mobil qurilmalar'],
    ['svc_texnika_tamir_av', 'Foto, audio, video texnika'],
    ['svc_texnika_tamir_kond', 'Konditsioner, ventilyatsiya'],
    ['svc_texnika_tamir_kir', 'Kir yuvish, quritish mashinalari'],
    ['svc_texnika_tamir_posud', 'Idish yuvish mashinalari'],
    ['svc_texnika_tamir_sovit', 'Sovitgich, muzlatgich'],
    ['svc_texnika_tamir_plita', 'Poxcha panel, duxovka'],
    ['svc_texnika_tamir_gaz', 'Gaz qozon, suv isitgich'],
    ['svc_texnika_tamir_kofe', 'Kofe mashinalari'],
    ['svc_texnika_tamir_tikuv', 'Tikuv mashina, overlok'],
    ['svc_texnika_tamir_other', 'Boshqalar'],
  ]),
  parent('svc_kompyuter', 'Kompyuter yordami', 'Laptop', 'services', [
    ['svc_kompyuter_pc', 'Kompyuterlar'],
    ['svc_kompyuter_printer', 'Printerlar'],
    ['svc_kompyuter_mining', 'Mayning uskunalari'],
    ['svc_kompyuter_console', 'O’yin konsollari'],
    ['svc_kompyuter_os', 'OS va dasturlar'],
    ['svc_kompyuter_net', 'Internet va tarmoqlar'],
  ]),
  parent('svc_montazh', 'Uskunalar o’rnatish', 'PlugZap', 'services', [
    ['svc_montazh_kond', 'Konditsioner va ventilyatsiya'],
    ['svc_montazh_kir', 'Kir yuvish va quritish mashinalari'],
    ['svc_montazh_posud', 'Idish yuvish mashinalari'],
    ['svc_montazh_other', 'Boshqa texnika'],
  ]),
  parent('svc_oborudovanie', 'Uskunalar, ishlab chiqarish', 'Factory', 'services', [
    ['svc_oborudovanie_arenda', 'Uskunalar ijarasi'],
    ['svc_oborudovanie_proizvodstvo', 'Ishlab chiqarish, ishlov berish'],
  ]),
  parent('svc_talim', 'Ta’lim, kurslar', 'GraduationCap', 'services', [
    ['svc_talim_maktab', 'Maktab va vuz fanlari'],
    ['svc_talim_til', 'Chet tillari'],
    ['svc_talim_bolalar', 'Bolalar rivojlanishi, logoped'],
    ['svc_talim_kasb', 'Kasb va biznes'],
    ['svc_talim_ijod', 'Ijod, xobbi, sport'],
    ['svc_talim_haydovchi', 'Haydovchilik'],
    ['svc_talim_rasmiylashtirish', 'Ishlarni rasmiylashtirishda yordam'],
    ['svc_talim_maneviy', 'Ma’naviy amaliyot'],
    ['svc_talim_other', 'Boshqalar'],
  ]),
  parent('svc_biznes', 'Biznes xizmatlari', 'Briefcase', 'services', [
    ['svc_biznes_buh', 'Buxgalteriya, moliya'],
    ['svc_biznes_konsalting', 'Konsalting'],
    ['svc_biznes_nedvizhimost', 'Ko’chmas mulk bo’yicha maslahat'],
    ['svc_biznes_marketing', 'Marketing va ilg’arlatish'],
    ['svc_biznes_it', 'IT, dizayn, matnlar'],
    ['svc_biznes_yur', 'Yuridik xizmatlar'],
    ['svc_biznes_sugurta', 'Sug’urta'],
  ]),
  parent('svc_vositachi', 'Vositachi xizmatlari', 'Handshake', 'services', [
    ['svc_vositachi_vykup', 'Xarid qilib berish (vykup)'],
    ['svc_vositachi_tovar', 'Chet eldan tovar yetkazish'],
    ['svc_vositachi_moliya', 'Moliyaviy masalalarda yordam'],
    ['svc_vositachi_turizm', 'Turizm xizmatlari'],
    ['svc_vositachi_konsultatsiya', 'Konsultatsiya'],
  ]),
  parent('svc_poligrafiya', 'Poligrafiya, tashqi reklama', 'Printer', 'services', []),
  parent('svc_chiqindi', 'Chiqindi va ikkilamchi xomashyo', 'Recycle', 'services', [
    ['svc_chiqindi_musor', 'Chiqindi olib chiqish'],
    ['svc_chiqindi_vtor', 'Ikkilamchi xomashyo qabul qilish'],
  ]),
  parent('svc_tozalash', 'Tozalash', 'SprayCan', 'services', [
    ['svc_tozalash_general', 'Umumiy (generalnaya) tozalash'],
    ['svc_tozalash_oyna', 'Oyna yuvish'],
    ['svc_tozalash_oddiy', 'Oddiy tozalash'],
    ['svc_tozalash_gilam', 'Gilam tozalash'],
    ['svc_tozalash_mebel', 'Yumshoq mebel tozalash'],
  ]),
  parent('svc_dezinf', 'Dezinfektsiya, dezinektsiya, spec tozalash', 'ShieldPlus', 'services', []),
  parent('svc_maishiy', 'Maishiy xizmatlar', 'House', 'services', [
    ['svc_maishiy_kalit', 'Kalit yasash va zatochka'],
    ['svc_maishiy_kiyim', 'Kiyim va boshqa buyumlarni tikish/ta’mirlash'],
    ['svc_maishiy_soat', 'Soat ta’mirlash'],
    ['svc_maishiy_xim', 'Ximchistka, yuvish'],
    ['svc_maishiy_zargar', 'Zargarlik xizmatlari'],
  ]),
  parent('svc_bayram', 'Bayram va tadbirlar', 'PartyPopper', 'services', [
    ['svc_bayram_tashkilotchi', 'Tashkilotchilar'],
    ['svc_bayram_boshlovchi', 'Boshlovchi, animator va artistlar'],
    ['svc_bayram_dekor', 'Bezash va dekor'],
  ]),
  parent('svc_tadbir_arenda', 'Tadbir va dam olish uchun ijara', 'Ticket', 'services', [
    ['svc_tadbir_arenda_lokatsiya', 'Lokatsiyalar'],
    ['svc_tadbir_arenda_suv', 'Suv transporti va moto-texnika'],
    ['svc_tadbir_arenda_studiya', 'Foto va yozuv studiyalari'],
    ['svc_tadbir_arenda_rekvizit', 'Uskunalar, dekor va rekvizit'],
  ]),
  parent('svc_dosug', 'Doshg va dam olish', 'Palmtree', 'services', [
    ['svc_dosug_ekskursiya', 'Ekskursiyalar'],
    ['svc_dosug_faol', 'Faol dam olish'],
  ]),
  parent('svc_ovqat', 'Ovqat va keytering', 'UtensilsCrossed', 'services', [
    ['svc_ovqat_dostavka', 'Tayyor ovqat yetkazish'],
    ['svc_ovqat_tort', 'Tort va shirinliklar (buyurtma)'],
    ['svc_ovqat_oshpaz', 'Oshpaz va xizmat ko’rsatish'],
  ]),
  parent('svc_foto', 'Foto va video', 'Camera', 'services', [
    ['svc_foto_photo', 'Foto suratga olish'],
    ['svc_foto_video', 'Video suratga olish'],
    ['svc_foto_ai', 'AI-kontent va raqamli ishlov'],
  ]),
  parent('svc_enaga', 'Enaga va qarovchilar', 'Baby', 'services', []),
  parent('svc_hayvon_uhod', 'Hayvonlarga g’amxo’rlik', 'PawPrint', 'services', []),
  parent('svc_ijod', 'Ijod', 'Palette', 'services', [
    ['svc_ijod_musiqa', 'Musiqa, she’r, qo’shiq (buyurtma)'],
    ['svc_ijod_rassom', 'Rassom va haykaltaroshlar xizmati'],
    ['svc_ijod_kastom', 'Kastomizatsiya'],
    ['svc_ijod_qol', 'Qo’l mehnati (buyurtma asosida)'],
  ]),
  parent('svc_qoriq', 'Qo’riq va xavfsizlik', 'ShieldCheck', 'services', []),
  parent('svc_sport_tamir', 'Sport anjomlari ta’miri', 'Dumbbell', 'services', []),
  parent('svc_boshqa', 'Boshqa xizmatlar', 'Layers', 'services', [
    ['svc_boshqa_asbob', 'Musiqa asboblari ta’miri'],
    ['svc_boshqa_marosim', 'Marosim (ritual) xizmatlari'],
    ['svc_boshqa_yana', 'Yana xizmatlar'],
  ]),
];

// ─── JOBS (Ish) — TWO trees via scope ──────────────────────────────────
const JOBS_VACANCY: ParentCategorySpec[] = [
  'IT, internet, telekom', 'Avtomobil biznesi', 'Administrativ ish', 'Tajribasiz, talabalar',
  'Buxgalteriya, moliya', 'Yuqori menejment', 'Davlat xizmati, NNT', 'Uy xizmati, personal',
  'JKHH, ekspluatatsiya', 'San’at, ko’ngilochar', 'Konsalting', 'Kuryer yetkazish',
  'Marketing, reklama, PR', 'Tibbiyot, farmatsevtika', 'Ta’lim, fan', 'Qo’riq, xavfsizlik',
  'Savdo', 'Ishlab chiqarish, xomashyo, qishloq xo’jaligi', 'Sug’urta', 'Qurilish',
  'Taksi', 'Transport, logistika', 'Turizm, restoran', 'Kadrlar boshqaruvi (HR)',
  'Fitnes, salon, go’zallik', 'Yurisprudensiya',
].map((name, i) => parent(`job_vac_${i + 1}`, name, 'Briefcase', 'jobs', [], 'JOB_OPENING'));

const JOBS_RESUME: ParentCategorySpec[] = [
  'Arxitektura va dizayn', 'Bank va moliya xizmatlari', 'Maishiy va shaxsiy xizmatlar',
  'Davlat xizmati', 'Mehmonxona biznesi va turizm', 'Ko’mir, ruda va foydali qazilmalarni qazib olish',
  'Neft va gaz qazib olish, qayta ishlash, tashish', 'Yetkazib berish, yuk tashish va logistika',
  'JKHH va shahar infratuzilmasi', 'O’yin biznesi', 'Axborot texnologiyalari',
  'San’at va ko’ngilochar', 'Klining (tozalash)', 'Konsalting',
  'O’rmon va yog’ochsozlik sanoati', 'Marketing, reklama va PR', 'Tibbiyot va farmatsevtika',
  'Metallurgiya sanoati', 'NNT va ijtimoiy faoliyat', 'Harbiy sanoat', 'Ta’lim va fan',
  'Jamoat ovqatlanishi', 'Tadbirlarni tashkil etish', 'Qo’riq va jamoat tartibi',
  'Chiqindini qayta ishlash', 'Oziq-sanoat', 'Avtomobil sotish va xizmat ko’rsatish',
  'Ko’chmas mulk sotish va boshqaruvi', 'Noyo’v tovarlar ishlab chiqarish',
  'Sanoat uskunalar va stanoklar ishlab chiqarish', 'To’qimachilik, kiyim va poyabzal ishlab chiqarish',
  'Elektr va optik uskunalar ishlab chiqarish', 'Elektronika va maishiy texnika ishlab chiqarish',
  'Raketa-kosmik sanoat', 'Binolar ta’miri va bezashi', 'Marosim xizmatlari',
  'Chakana va ulgurji savdo', 'Qishloq xo’jaligi', 'Ombor va saqlash',
  'OAV va nashriyot ishi', 'Sug’urta', 'Turar va tijorat obyektlari qurilishi',
  'Sanoat va infratuzilma obyektlari qurilishi', 'Taksi va yo’lovchi tashish',
  'Aloqa va telekommunikatsiya', 'Texnika xizmati va ta’mirlash', 'Transport mashinasozlik',
  'Og’ir mashinasozlik', 'Kadrlar boshqaruvi', 'Transport infratuzilmasini boshqarish',
  'Fitnes-klub, spa va go’zallik salonlari', 'Kimyo sanoati', 'Energetika',
].map((name, i) => parent(`job_res_${i + 1}`, name, 'User', 'jobs', [], 'JOB_SEEKER'));

// ─── TRANSPORT — 6 categories ──────────────────────────────────────────
const TRANSPORT: ParentCategorySpec[] = [
  parent('trn_avto', 'Avtomobillar', 'Car', 'transport', []),
  parent('trn_moto', 'Moto va moto-texnika', 'Bike', 'transport', [
    ['trn_moto_vtx', 'Vezdexod'], ['trn_moto_karting', 'Karting'], ['trn_moto_atv', 'Kvadrotsikl'],
    ['trn_moto_moped', 'Moped, skuter'], ['trn_moto_moto', 'Motosikl'], ['trn_moto_sneo', 'Snegoxod'],
  ]),
  parent('trn_gruz', 'Yuk mashinalari va maxsus texnika', 'Truck', 'transport', [
    ['trn_gruz_gruzovik', 'Yuk avtomobillari'], ['trn_gruz_samosval', 'Samosval'],
    ['trn_gruz_tyagach', 'Sedelniy tortuvchi'], ['trn_gruz_reefer', 'Refrizherator'],
    ['trn_gruz_kran', 'Avtokran'], ['trn_gruz_eksk', 'Ekskavator'], ['trn_gruz_buld', 'Buldozer'],
    ['trn_gruz_pogruz', 'Yuklovchi (pogruzchik)'], ['trn_gruz_greider', 'Greyder'],
    ['trn_gruz_kompressor', 'Kompressor'], ['trn_gruz_asfalt', 'Asfalt quyish'],
    ['trn_gruz_stroit', 'Qurilish texnikasi'], ['trn_gruz_selskhoz', 'Qishloq xo’jaligi texnikasi'],
    ['trn_gruz_spec', 'Maxsus texnika'], ['trn_gruz_other', 'Boshqalar'],
  ]),
  parent('trn_arenda', 'Maxsus texnika ijarasi', 'Construction', 'transport', [
    ['trn_arenda_eksk', 'Ekskavator ijarasi'], ['trn_arenda_buld', 'Buldozer ijarasi'],
    ['trn_arenda_pogruz', 'Yuklovchi ijarasi'], ['trn_arenda_kran', 'Avtokran ijarasi'],
    ['trn_arenda_gruzovik', 'Yuk avtomobili ijarasi'], ['trn_arenda_generator', 'Generator ijarasi'],
    ['trn_arenda_kompres', 'Kompressor ijarasi'], ['trn_arenda_beton', 'Beton nasosi ijarasi'],
    ['trn_arenda_other', 'Boshqalar'],
  ]),
  parent('trn_suv', 'Suv transporti', 'Anchor', 'transport', [
    ['trn_suv_kater', 'Kater va motolodka'], ['trn_suv_yacht', 'Yaxta'],
    ['trn_suv_lodka', 'Qayiq (lodka)'], ['trn_suv_hydro', 'Gidrotsikl'],
    ['trn_suv_parus', 'Parusli'], ['trn_suv_other', 'Boshqalar'],
  ]),
  parent('trn_zapchasti_ref', 'Ehtiyot qismlar va aksessuarlar', 'Cog', 'transport', []),
];

// ─── REALTY (Ko’chmas mulk) — 5 categories ─────────────────────────────
const REALTY: ParentCategorySpec[] = [
  parent('rlt_buy', 'Uy-joy sotib olish', 'Building2', 'realty', [
    ['rlt_buy_all', 'Barcha kvartiralar'], ['rlt_buy_vtor', 'Ikkilamlik bozor'],
    ['rlt_buy_nov', 'Yangi bino (novostroyka)'], ['rlt_buy_novcat', 'Yangi binolar katalogi'],
    ['rlt_buy_dom', 'Uy va dacha'], ['rlt_buy_xona', 'Xonalar'],
  ]),
  parent('rlt_posut', 'Kunlik / sayohat ijarasi', 'BedDouble', 'realty', [
    ['rlt_posut_kvartira', 'Kvartiralar'], ['rlt_posut_dom', 'Uylar'], ['rlt_posut_hotel', 'Mehmonxonalar'],
  ]),
  parent('rlt_arenda', 'Uzoq muddatga ijara', 'KeyRound', 'realty', [
    ['rlt_arenda_kvartira', 'Kvartira ijara'], ['rlt_arenda_dom', 'Uy ijara'], ['rlt_arenda_xona', 'Xona ijara'],
  ]),
  parent('rlt_kommert', 'Tijorat ko’chmas mulki', 'Store', 'realty', [
    ['rlt_kommert_ofis', 'Ofis'], ['rlt_kommert_free', 'Erkin joylar'],
    ['rlt_kommert_torg', 'Savdo joylari'], ['rlt_kommert_sklad', 'Ombor'],
    ['rlt_kommert_bc', 'Biznes-markazlar'], ['rlt_kommert_pit', 'Jamoat ovqatlanishi obyektlari'],
    ['rlt_kommert_other', 'Boshqalar'],
  ]),
  parent('rlt_other', 'Boshqa ko’chmas mulk', 'MapPin', 'realty', [
    ['rlt_other_zemlya', 'Yer uchastkalari'], ['rlt_other_garaj', 'Garaj va mashina joyi'],
    ['rlt_other_zarubezh', 'Xorijdagi ko’chmas mulk'],
  ]),
];

export const CATEGORIES_CATALOG: ParentCategorySpec[] = SERVICES;
export const JOBS_CATALOG: ParentCategorySpec[] = [...JOBS_VACANCY, ...JOBS_RESUME];


// ─── PERSONAL (Shaxsiy buyumlar) — 5 categories ────────────────────────
const PERSONAL: ParentCategorySpec[] = [
  parent('per_clothing', 'Kiyim, poyabzal, aksessuarlar', 'Shirt', 'personal', [
    ['per_clothing_w', 'Ayol kiyimi'], ['per_clothing_wshoe', 'Ayol poyabzali'],
    ['per_clothing_m', 'Erkak kiyimi'], ['per_clothing_mshoe', 'Erkak poyabzali'],
    ['per_clothing_bag', 'Sumka, ryukzak va chamadonlar'], ['per_clothing_acc', 'Aksessuarlar'],
  ]),
  parent('per_kids_cloth', 'Bolalar kiyim va poyabzali', 'Baby', 'personal', [
    ['per_kids_cloth_g', 'Qiz bolalar uchun'], ['per_kids_cloth_b', 'O’g’il bolalar uchun'],
  ]),
  parent('per_kids_goods', 'Bolalar tovarlari va o’yinchoqlar', 'Blocks', 'personal', [
    ['per_kids_seat', 'Bola o’rindiqlari (avtokreslo)'], ['per_kids_scoot', 'Samokat va begovel'],
    ['per_kids_furn', 'Bolalar mebeli'], ['per_kids_stroller', 'Bolalar aravachalari'],
    ['per_kids_toys', 'O’yinchoqlar'], ['per_kids_bed', 'Ko’rpa-to’shak'],
    ['per_kids_feed', 'Emizish uchun'], ['per_kids_bath', 'Yuvish uchun'],
    ['per_kids_school', 'Maktab tovarlari'], ['per_kids_hyg', 'Bolalar gigiyenasi'],
  ]),
  parent('per_beauty', 'Go’zallik va salomatlik', 'Sparkles', 'personal', [
    ['per_beauty_makeup', 'Bo’yanish va manikyur'], ['per_beauty_perf', 'Parfyumeriya'],
    ['per_beauty_dev', 'Asboblar va aksessuarlar'], ['per_beauty_care', 'Parvarish va gigiyena'],
    ['per_beauty_hair', 'Soch uchun vositalar'], ['per_beauty_med', 'Tibbiyot buyumlari'],
    ['per_beauty_bad', 'BAД (biologik qo’shimchalar)'],
  ]),
  parent('per_watches', 'Soat va ziynat buyumlari', 'Gem', 'personal', [
    ['per_watches_jew', 'Zargarlik buyumlari'], ['per_watches_watch', 'Soatlar'],
    ['per_watches_bij', 'Bijuteriya'],
  ]),
];

// ─── HOME & DACHA (Uy va dacha) — 6 categories ─────────────────────────
const HOME_DACHA: ParentCategorySpec[] = [
  parent('hom_remont', 'Ta’mirlash va qurilish (tovarlar)', 'Hammer', 'home-dacha', [
    ['hom_remont_door', 'Eshiklar'], ['hom_remont_tool', 'Asboblar'],
    ['hom_remont_fire', 'Kamin va isitgichlar'], ['hom_remont_win', 'Deraza va balkonlar'],
    ['hom_remont_ceiling', 'Shiftlar'], ['hom_remont_garden', 'Bog’ va dacha uchun'],
    ['hom_remont_plumb', 'Santexnika, suv ta’minoti va sauna'], ['hom_remont_mat', 'Qurilish materiallari'],
    ['hom_remont_ready', 'Tayyor qurilmalar va yog’och xonalar'], ['hom_remont_fence', 'Darvoza, to’siq va panjaralar'],
  ]),
  parent('hom_furniture', 'Mebel va interyer', 'Armchair', 'home-dacha', [
    ['hom_furn_pc', 'Kompyuter stollari va kreslolar'], ['hom_furn_bed', 'Karavot, divan va kreslolar'],
    ['hom_furn_kitchen', 'Oshxona garniturlari'], ['hom_furn_light', 'Yoritish'],
    ['hom_furn_stand', 'Taglik va tumblar'], ['hom_furn_inter', 'Interyer buyumlari, san’at'],
    ['hom_furn_table', 'Stol va stullar'], ['hom_furn_text', 'To’qimachilik va gilamlar'],
    ['hom_furn_ward', 'Shkaf, komod va tokchalar'], ['hom_furn_garden', 'Bog’ mebeli'],
    ['hom_furn_other', 'Boshqalar'],
  ]),
  parent('hom_appliances', 'Maishiy texnika', 'Refrigerator', 'home-dacha', [
    ['hom_app_kitchen', 'Oshxona uchun'], ['hom_app_home', 'Uy uchun'],
    ['hom_app_climate', 'Iqlim uskunalari'], ['hom_app_personal', 'Shaxsiy parvarish uchun'],
    ['hom_app_other', 'Boshqalar'],
  ]),
  parent('hom_food', 'Oziq-ovqat', 'Apple', 'home-dacha', [
    ['hom_food_tea', 'Choy, qahva, kakao'], ['hom_food_drink', 'Ichimliklar'],
    ['hom_food_fish', 'Baliq, dengiz mahsulotlari, ikra'], ['hom_food_meat', 'Go’sht, parranda'],
    ['hom_food_sweet', 'Shirinliklar'], ['hom_food_honey', 'Asal va asalarichilik'],
    ['hom_food_grocery', 'Bakaleya'], ['hom_food_veg', 'Sabzavot, zomburug va ko’katlar'],
    ['hom_food_dairy', 'Sut mahsulotlari, pishloq, tuxum'], ['hom_food_fruit', 'Meva va rezavorlar'],
    ['hom_food_bread', 'Non va pishiriq'], ['hom_food_spec', 'Maxsus ovqatlanish'],
    ['hom_food_other', 'Boshqalar'],
  ]),
  parent('hom_plants', 'O’simliklar', 'Sprout', 'home-dacha', [
    ['hom_plant_room', 'Xonaki o’simliklar'], ['hom_plant_bouq', 'Buketlar'],
    ['hom_plant_garden', 'Bog’ o’simliklari'], ['hom_plant_seed', 'Urug’, piyozcha va klubenlar'],
    ['hom_plant_care', 'Parvarish tovarlari'], ['hom_plant_art', 'Panel va sun’iy o’simliklar'],
    ['hom_plant_other', 'Boshqalar'],
  ]),
  parent('hom_dishes', 'Idish va oshxona tovarlari', 'CookingPot', 'home-dacha', [
    ['hom_dish_table', 'Idishlar'], ['hom_dish_kitchen', 'Oshxona tovarlari'],
  ]),
];

// ─── PARTS (Ehtiyot qismlar) — 11 categories ───────────────────────────
const PARTS: ParentCategorySpec[] = [
  parent('prt_zapchasti', 'Ehtiyot qismlar', 'Cog', 'parts', [
    ['prt_zap_auto', 'Avtomobillar uchun'], ['prt_zap_moto', 'Moto-texnika uchun'],
    ['prt_zap_gruz', 'Yuk va maxsus texnika uchun'], ['prt_zap_water', 'Suv transporti uchun'],
  ]),
  parent('prt_wheels', 'Shinalar, disk va g’ildiraklar', 'DiscCircle', 'parts', [
    ['prt_wheel_tire', 'Shinalar'], ['prt_wheel_tiregruz', 'Yuk/maxsus texnika shinalari'],
    ['prt_wheel_mototire', 'Moto shinalar'], ['prt_wheel_disc', 'Disklar'],
    ['prt_wheel_cap', 'Kolpaklar'], ['prt_wheel_wheels', 'G’ildiraklar'],
  ]),
  parent('prt_av', 'Audio va video texnika', 'Video', 'parts', [
    ['prt_av_acc', 'Avtoakustika aksessuarlari'], ['prt_av_other', 'Boshqalar'],
    ['prt_av_mag', 'Magnitola'], ['prt_av_sound', 'Avtoakustika'],
    ['prt_av_reg', 'Videoregistratorlar'], ['prt_av_amp', 'Kuchaytirgichlar'],
    ['prt_av_frame', 'O’tuvchi ramkalar'], ['prt_av_box', 'Quti va podiumlar'],
  ]),
  parent('prt_access', 'Aksessuarlar', 'Steering', 'parts', [
    ['prt_acc_moto', 'Moto va suv transporti uchun'], ['prt_acc_wiper', 'Ayshka tozalagich'],
    ['prt_acc_inter', 'Salon uchun'], ['prt_acc_kit', 'Haydovchi to’plami'],
    ['prt_acc_wheel', 'G’ildirak uchun'], ['prt_acc_heat', 'Isitish uskunalari'],
    ['prt_acc_care', 'Parvarish'],
  ]),
  parent('prt_roof', 'Bagajnik va farkoplar', 'CarFront', 'parts', [
    ['prt_roof_arc', 'Ko’ndalang dugarak va butlovchilar'], ['prt_roof_rail', 'Tom reylinglari'],
    ['prt_roof_hitch', 'Farkop va butlovchilar'], ['prt_roof_bike', 'Velosiped/chang’i mahkamlagich'],
    ['prt_roof_exp', 'Ekspeditsion bagajnik'], ['prt_roof_box', 'Avtobox'], ['prt_roof_kung', 'KUNG'],
  ]),
  parent('prt_tools', 'Asboblar', 'Wrench', 'parts', []),
  parent('prt_trailer', 'Tirkama (pritsep)', 'Truck', 'parts', [
    ['prt_tr_bort', 'Bortli'], ['prt_tr_water', 'Suv transporti uchun'],
    ['prt_tr_evac', 'Evakuator'], ['prt_tr_parts', 'Ehtiyot qismlar va butlovchilar'],
    ['prt_tr_other', 'Boshqalar'],
  ]),
  parent('prt_gear', 'Jihozlar (ekipirovka)', 'HardHat', 'parts', [
    ['prt_gear_helm', 'Shlemlar'], ['prt_gear_cloth', 'Kiyim'], ['prt_gear_shoe', 'Poyabzal'],
    ['prt_gear_prot', 'Himoya'], ['prt_gear_glove', 'Qo’lqop'], ['prt_gear_glass', 'Ko’zoynak, niqob'],
    ['prt_gear_acc', 'Aksessuarlar'], ['prt_gear_bag', 'Ryukzak va sumkalar'],
  ]),
  parent('prt_oils', 'Moy va avtokimyo', 'Droplet', 'parts', [
    ['prt_oil_motor', 'Motor moylari'], ['prt_oil_trans', 'Transmissiya moylari'],
    ['prt_oil_cool', 'Sovuqtirish suyuqliklari'], ['prt_oil_brake', 'Tormoz suyuqliklari'],
    ['prt_oil_hydro', 'Gidravlik suyuqliklar'], ['prt_oil_wash', 'Ayshka suyuqligi'],
    ['prt_oil_add', 'Yuvish suyuqligi, qo’shimcha va moylar'], ['prt_oil_other', 'Boshqa moylar'],
    ['prt_oil_cosm', 'Avtokosmetika va aksessuarlar'], ['prt_oil_fuel', 'Yonilg’i'],
  ]),
  parent('prt_anti', 'O’g’irlikka qarshi qurilmalar', 'ShieldCheck', 'parts', [
    ['prt_anti_sig', 'Avto signaliatsiya'], ['prt_anti_immo', 'Immobilayzer'],
    ['prt_anti_block', 'Mexanik blokirovka'], ['prt_anti_sat', 'Sun’iy yo’ldosh tizimlari'],
  ]),
  parent('prt_gps', 'GPS-navigatorlar', 'Navigation', 'parts', []),
];

// ─── ELECTRONICS — 9 categories ────────────────────────────────────────
const ELECTRONICS: ParentCategorySpec[] = [
  parent('el_phone', 'Telefonlar', 'Smartphone', 'electronics', [
    ['el_phone_mob', 'Mobil telefonlar'], ['el_phone_acc', 'Aksessuarlar'],
    ['el_phone_sim', 'SIM-kartalar'], ['el_phone_radio', 'Ratsiyalar'],
    ['el_phone_fix', 'Stasionar telefonlar'], ['el_phone_watch', 'Smart soat va fitnes bilag’uziklar'],
  ]),
  parent('el_av', 'Audio va video', 'Tv', 'electronics', [
    ['el_av_tv', 'Televizor va projectorlar'], ['el_av_head', 'Naushniklar'],
    ['el_av_acoustic', 'Akustika, kolonka, subvufer'], ['el_av_acc', 'Aksessuarlar'],
    ['el_av_center', 'Musiqa markazlari'], ['el_av_amp', 'Kuchaytirgich va resiverlar'],
    ['el_av_cam', 'Videokameralar'], ['el_av_player', 'Video/DVD/Blu-ray pleerlar'],
    ['el_av_cable', 'Kabel va adapterlar'], ['el_av_media', 'Musiqa va filmlar'],
    ['el_av_mic', 'Mikrofon, radio tizimlar'], ['el_av_mp3', 'MP3 pleerlar'],
  ]),
  parent('el_pc', 'Kompyuter tovarlari', 'Monitor', 'electronics', [
    ['el_pc_parts', 'Butlovchi qismlar'], ['el_pc_mon', 'Monitorlar'],
    ['el_pc_net', 'Setka uskunalari'], ['el_pc_kb', 'Klaviatura va sichqonchalar'],
    ['el_pc_acc', 'Aksessuarlar'], ['el_pc_joy', 'JoyStick va rul'],
    ['el_pc_flash', 'Fleshka va xotita kartalari'], ['el_pc_sound', 'Akustika'],
    ['el_pc_hdd', 'Portativ disklar'], ['el_pc_web', 'Veb-kameralar'], ['el_pc_tuner', 'TV-tyunerlar'],
  ]),
  parent('el_games', 'O’yinlar, pristavka va dasturlar', 'Gamepad2', 'electronics', [
    ['el_games_console', 'O’yin pristavkalari va aksessuar'], ['el_games_cgames', 'Pristavka o’yinlari'],
    ['el_games_soft', 'Dasturlar'], ['el_games_pcgames', 'Kompyuter o’yinlari'],
  ]),
  parent('el_laptop', 'Noutbuklar', 'Laptop', 'electronics', []),
  parent('el_desktop', 'Stol kompyuterlari', 'Cpu', 'electronics', [
    ['el_desktop_tower', 'Sistem bloklar'], ['el_desktop_mono', 'Monobloklar'], ['el_desktop_other', 'Boshqalar'],
  ]),
  parent('el_photo', 'Foto texnika', 'Camera', 'electronics', [
    ['el_photo_eq', 'Uskunalar va aksessuarlar'], ['el_photo_lens', 'Obyektivlar'],
    ['el_photo_comp', 'Kompakt fotolarda'], ['el_photo_film', 'Plyonkali fotolarda'],
    ['el_photo_dslr', 'Zerkalli fotolarda'], ['el_photo_optic', 'Binokl va teleskoplar'],
  ]),
  parent('el_tablet', 'Planshet va elektron kitoblar', 'Tablet', 'electronics', [
    ['el_tab_tab', 'Planshetlar'], ['el_tab_acc', 'Aksessuarlar'], ['el_tab_book', 'Elektron kitoblar'],
  ]),
  parent('el_office', 'Orgtexnika va sarf materiallari', 'Printer', 'electronics', [
    ['el_off_mfp', 'MFP, skaner'], ['el_off_print', 'Printerlar'], ['el_off_station', 'Kantelyariya'],
    ['el_off_ups', 'UPS, setka filtrlar'], ['el_off_tel', 'Telefoniya'],
    ['el_off_shred', 'Qog’oz maydalagich'], ['el_off_consum', 'Sarf materiallari'],
  ]),
];

// ─── HOBBY (Hobbi va dam olish) — 7 categories ─────────────────────────
const HOBBY: ParentCategorySpec[] = [
  parent('hob_tickets', 'Chiptalar va sayohat', 'Ticket', 'hobby', [
    ['hob_tick_card', 'Kartalar, kuponlar'], ['hob_tick_concert', 'Kontsertlar'],
    ['hob_tick_travel', 'Sayohatlar'], ['hob_tick_sport', 'Sport'],
    ['hob_tick_theater', 'Teatr, opera, balet'], ['hob_tick_circ', 'Sirk, kino'],
    ['hob_tick_show', 'Shou, myuzikl'],
  ]),
  parent('hob_bike', 'Velosipedlar', 'Bike', 'hobby', [
    ['hob_bike_bmx', 'BMX'], ['hob_bike_city', 'Shahar'], ['hob_bike_road', 'Shosse'],
    ['hob_bike_kids', 'Bolalar'], ['hob_bike_mtb', 'Tog’'], ['hob_bike_e', 'Elektrovelosipedlar'],
    ['hob_bike_parts', 'Ehtiyot qismlar va aksessuarlar'],
  ]),
  parent('hob_books', 'Kitob va jurnallar', 'BookOpen', 'hobby', [
    ['hob_book_mag', 'Jurnal, gazeta, broshyura'], ['hob_book_book', 'Kitoblar'],
    ['hob_book_study', 'O’quv adabiyoti'],
  ]),
  parent('hob_collect', 'Kolleksiya', 'Stamp', 'hobby', [
    ['hob_col_money', 'Banknotlar'], ['hob_col_ticket', 'Chiptalar'],
    ['hob_col_star', 'Mashhurlar buyumlari, avtoqraf'], ['hob_col_military', 'Harbiy buyumlar'],
    ['hob_col_engrave', 'Gravyura'], ['hob_col_doc', 'Hujjatlar'], ['hob_col_badge', 'Jeton, medal, nishon'],
    ['hob_col_game', 'O’yinlar'], ['hob_col_cal', 'Kalendarlar'], ['hob_col_paint', 'Rasmlar'],
    ['hob_col_kinder', 'Kinder-syurpriz'], ['hob_col_env', 'Konvert va pochta kartochkalari'],
    ['hob_col_stamp', 'Pochta markalari'], ['hob_col_model', 'Model, figura, qo’g’irchoq'],
    ['hob_col_coin', 'Tangalar'], ['hob_col_card', 'Ochirtoklar'], ['hob_col_ash', 'Kulqozoncha, zagirka'],
    ['hob_col_plastic', 'Plastik kartochkalar'], ['hob_col_sport', 'Sport kartochkalari'],
    ['hob_col_photo', 'Fotosurat, xatlar'], ['hob_col_label', 'Etiketka, shisha, tiqin'],
    ['hob_col_other', 'Boshqalar'],
  ]),
  parent('hob_music', 'Musiqa asboblari', 'Music', 'hobby', [
    ['hob_mus_accord', 'Akkordeon, garmon, bayan'], ['hob_mus_string', 'Gitara va simli'],
    ['hob_mus_wind', 'Puflama'], ['hob_mus_key', 'Klavinsh va sintezator'],
    ['hob_mus_bow', 'Skripka va kamonli'], ['hob_mus_drum', 'Urma'],
    ['hob_mus_studio', 'Studiya va kontsert uchun'], ['hob_mus_acc', 'Aksessuarlar'],
  ]),
  parent('hob_hunt', 'Ov va baliq ovlash', 'Crosshair', 'hobby', [
    ['hob_hunt_knife', 'Pichoq, multitool, balta'], ['hob_hunt_hunt', 'Ov'],
    ['hob_hunt_fish', 'Baliq ovlash'], ['hob_hunt_suit', 'Ov/baliq kiyimlari'],
  ]),
  parent('hob_sport', 'Sport va dam olish', 'Dumbbell', 'hobby', [
    ['hob_sp_fit', 'Fitnes va trenajorlar'], ['hob_sp_winter', 'Qishki sport'],
    ['hob_sp_dive', 'Diving va suv sporti'], ['hob_sp_tour', 'Turizm va tabiatda dam olish'],
    ['hob_sp_martial', 'Yakka kurash'], ['hob_sp_board', 'Stol va karta o’yinlari'],
    ['hob_sp_roll', 'Rolik va skejtbord'], ['hob_sp_tennis', 'Tennis va badminton'],
    ['hob_sp_nutri', 'Sportiy ovqatlanish'], ['hob_sp_fire', 'Otish sporti'],
    ['hob_sp_bill', 'Bilyard va bouling'], ['hob_sp_rest', 'Dam olish tovarlari'],
    ['hob_sp_gym', 'Gimnastika va raqslar'], ['hob_sp_horse', 'Ot sporti'],
    ['hob_sp_scoot', 'Samokat va giroskuter'], ['hob_sp_run', 'Yugurish'],
    ['hob_sp_award', 'Mukofot va kubklar'],
  ]),
];

// ─── ANIMALS (Hayvonlar) — 7 categories ────────────────────────────────
const ANIMALS: ParentCategorySpec[] = [
  parent('ani_dogs', 'Itlar', 'Dog', 'animals', []),
  parent('ani_cats', 'Mushuklar', 'Cat', 'animals', []),
  parent('ani_birds', 'Qushlar', 'Bird', 'animals', []),
  parent('ani_aqua', 'Akvarium', 'Fish', 'animals', []),
  parent('ani_other', 'Boshqa hayvonlar', 'Rabbit', 'animals', [
    ['ani_oth_amph', 'Amfibiya'], ['ani_oth_rodent', 'Kemiruvchilar'], ['ani_oth_rabbit', 'Quyonlar'],
    ['ani_oth_horse', 'Otlar'], ['ani_oth_rept', 'Sudralib yuruvchilar'],
    ['ani_oth_farm', 'Qishloq xo’jaligi hayvonlari'], ['ani_oth_ferret', 'Noatka (xorki)'],
    ['ani_oth_other', 'Boshqalar'],
  ]),
  parent('ani_goods', 'Hayvonlar uchun tovarlar', 'Bone', 'animals', [
    ['ani_good_catdog', 'It va mushuklar'], ['ani_good_rodent', 'Kemiruvchilar'],
    ['ani_good_bird', 'Qushlar'], ['ani_good_fish', 'Baliq va sudralib yuruvchilar'],
    ['ani_good_farm', 'Fermer xo’jaligi'],
  ]),
  parent('ani_lost', 'Yo’qolgan va topilgan hayvonlar', 'Search', 'animals', [
    ['ani_lost_cat', 'Yo’qolgan/topilgan mushuklar'], ['ani_lost_dog', 'Yo’qolgan/topilgan itlar'],
  ]),
];

// ─── BUSINESS (Biznes va uskunalar) — 4 categories ─────────────────────
const BUSINESS: ParentCategorySpec[] = [
  parent('biz_equip', 'Biznes uchun uskunalar', 'Factory', 'business', [
    ['biz_eq_ind', 'Sanoat'], ['biz_eq_log', 'Logistika va ombor'], ['biz_eq_trade', 'Savdo'],
    ['biz_eq_food', 'Oziq-ovqat'], ['biz_eq_beauty', 'Go’zallik saloni'], ['biz_eq_auto', 'Avtobiznes'],
    ['biz_eq_mining', 'Mayning'], ['biz_eq_lab', 'Laboratoriya'], ['biz_eq_med', 'Tibbiy'],
    ['biz_eq_telecom', 'Telekommunikatsiya'], ['biz_eq_other', 'Boshqalar'],
  ]),
  parent('biz_franchise', 'Franshizalar', 'BadgeDollarSign', 'business', [
    ['biz_fr_auto', 'Avtobiznes'], ['biz_fr_rent', 'Arenta biznesi'], ['biz_fr_beauty', 'Go’zallik va salomatlik'],
    ['biz_fr_food', 'Jamoat ovqatlanishi'], ['biz_fr_prod', 'Ishlab chiqarish'], ['biz_fr_pickup', 'Buyurtma tarqatish'],
    ['biz_fr_agro', 'Qishloq xo’jaligi'], ['biz_fr_build', 'Qurilish'], ['biz_fr_ent', 'Ko’ngilochar'],
    ['biz_fr_serv', 'Xizmat sohasi'], ['biz_fr_trade', 'Savdo'], ['biz_fr_tour', 'Turizm'], ['biz_fr_it', 'IT biznes'],
  ]),
  parent('biz_ready', 'Tayyor biznes', 'Store', 'business', [
    ['biz_gr_auto', 'Avtobiznes'], ['biz_gr_rent', 'Arenta biznesi'], ['biz_gr_beauty', 'Go’zallik va salomatlik'],
    ['biz_gr_food', 'Jamoat ovqatlanishi'], ['biz_gr_prod', 'Ishlab chiqarish'], ['biz_gr_pickup', 'Buyurtma tarqatish'],
    ['biz_gr_agro', 'Qishloq xo’jaligi'], ['biz_gr_build', 'Qurilish'], ['biz_gr_ent', 'Ko’ngilochar'],
    ['biz_gr_serv', 'Xizmat sohasi'], ['biz_gr_trade', 'Savdo'], ['biz_gr_tour', 'Turizm'], ['biz_gr_it', 'IT biznes'],
    ['biz_gr_other', 'Boshqalar'],
  ]),
  parent('biz_so', 'Biznes uchun dasturiy ta’minot', 'Code', 'business', [
    ['biz_so_an', 'Analitika'], ['biz_so_sec', 'Xavfsizlik'], ['biz_so_log', 'Xarid, ombor, logistika'],
    ['biz_so_ind', 'Soheviy PO'], ['biz_so_off', 'Ofis PO'], ['biz_so_mkt', 'Savdo va marketing'],
    ['biz_so_hr', 'Kadrlar boshqaruvi va o’qitish'], ['biz_so_erp', 'Korxona/ishlab chiqarish boshqaruvi'],
    ['biz_so_it', 'IT-infrastrukturani boshqarish'],
  ]),
];

// ─── BUSINESS 360 (B2B hub) — 9 categories ─────────────────────────────
const BUSINESS360: ParentCategorySpec[] = [
  parent('b360_equip', 'Uskunalar', 'Factory', 'business360', [
    ['b360_eq_biz', 'Biznes uchun uskunalar'], ['b360_eq_tool', 'Asboblar'],
    ['b360_eq_rent', 'Uskunalar ijarasi'], ['b360_eq_mount', 'Uskunalar o’rnatish'],
  ]),
  parent('b360_transport', 'Transport', 'Truck', 'business360', [
    ['b360_tr_auto', 'Avtomobillar'], ['b360_tr_gruz', 'Yuk va maxsus texnika'], ['b360_tr_water', 'Suv transporti'],
    ['b360_tr_rent', 'Maxsus texnika ijarasi'], ['b360_tr_parts', 'Ehtiyot qismlar va aksessuarlar'],
    ['b360_tr_service', 'Avtomobillar uchun avtoservislar'],
  ]),
  parent('b360_services', 'Xizmatlar', 'Wrench', 'business360', [
    ['b360_sv_log', 'Logistika'], ['b360_sv_biz', 'Biznes xizmatlari'], ['b360_sv_build', 'Ta’mirlash va qurilish'],
    ['b360_sv_tech', 'Texnika ta’miri va xizmati'], ['b360_sv_home', 'Maishiy xizmatlar'],
    ['b360_sv_edu', 'Ta’lim va doshg tashkil etish'], ['b360_sv_sec', 'Qo’riq va xavfsizlik'],
  ]),
  parent('b360_realty', 'Ko’chmas mulk', 'Building2', 'business360', [
    ['b360_re_comm', 'Tijorat ko’chmas mulki'], ['b360_re_land', 'Yer uchastkalari'], ['b360_re_garage', 'Garaj va mashina joyi'],
  ]),
  parent('b360_materials', 'Qurilish materiallari va xomashyo', 'Boxes', 'business360', [
    ['b360_ma_mat', 'Qurilish materiallari'], ['b360_ma_plumb', 'Santexnika, suv ta’minoti va sauna'],
    ['b360_ma_door', 'Eshiklar'], ['b360_ma_ceiling', 'Shiftlar'], ['b360_ma_garden', 'Bog’ va dacha uchun'],
    ['b360_ma_win', 'Deraza va balkonlar'], ['b360_ma_fire', 'Kamin va isitgichlar'],
    ['b360_ma_ready', 'Tayyor qurilmalar va yog’och xonalar'], ['b360_ma_fence', 'Darvoza, to’siq va panjaralar'],
  ]),
  parent('b360_bizfr', 'Tayyor biznes va franshizalar', 'Briefcase', 'business360', [
    ['b360_bf_fr', 'Franshizalar'], ['b360_bf_gr', 'Tayyor biznes'],
  ]),
  parent('b360_staff', 'Xodim qidirish', 'Users', 'business360', []),
  parent('b360_goods', 'Tovarlar', 'Package', 'business360', [
    ['b360_go_el', 'Elektronika'], ['b360_go_cloth', 'Kiyim, poyabzal, aksessuarlar'],
    ['b360_go_kids', 'Bolalar tovarlari va o’yinchoqlar'], ['b360_go_beauty', 'Go’zallik va salomatlik'],
    ['b360_go_home', 'Uy va dacha uchun'], ['b360_go_hobby', 'Hobbi va dam olish'],
    ['b360_go_animal', 'Hayvonlar va hayvonlar tovarlari'],
  ]),
  parent('b360_office', 'Ofis uchun hammasi', 'Monitor', 'business360', [
    ['b360_of_laptop', 'Noutbuklar'], ['b360_of_desktop', 'Stol kompyuterlari'], ['b360_of_pc', 'Kompyuter tovarlari'],
    ['b360_of_org', 'Orgtexnika va sarflar'], ['b360_of_furn', 'Kompyuter stollari va kreslolar'],
    ['b360_of_help', 'Kompyuter yordami'],
  ]),
];

// ─── HANDMADE (Hunarmandlar / Qo’l mehnati) — 9 categories ─────────────
const HANDMADE: ParentCategorySpec[] = [
  parent('hnd_textile', 'To’qimachilik va naqsh', 'Scissors', 'handmade', [
    ['hnd_tex_suzani', 'Suzani va kashtachilik'], ['hnd_tex_ikat', 'Ikat — atlas va adras'],
    ['hnd_tex_carpet', 'Gilam va palos'], ['hnd_tex_felt', 'Kiymiz / kiyiz buyumlar'],
    ['hnd_tex_bag', 'To’qilgan sumka va jo’mraklar'], ['hnd_tex_hat', 'Milliy bosh kiyim (doppi, telpak)'],
  ]),
  parent('hnd_ceramic', 'Kulolchilik va koshin', 'Amphora', 'handmade', [
    ['hnd_cer_rishtan', 'Rishton kulolchiligi'], ['hnd_cer_gijduvon', 'G’ijduvon kulolchiligi'],
    ['hnd_cer_koshin', 'Koshin va naqshli plitka'], ['hnd_cer_dish', 'Dekorativ idish-tovoq'],
    ['hnd_cer_lamp', 'Zilzi va shamdon'],
  ]),
  parent('hnd_wood', 'Yog’och va naqqoshlik', 'TreePine', 'handmade', [
    ['hnd_wood_carve', 'Yog’och o’ymakorligi (naqqoshlik)'], ['hnd_wood_furn', 'Qo’l mebel va interyer'],
    ['hnd_wood_dish', 'Yog’och idish-asbob'], ['hnd_wood_frame', 'Ramka va esdalik buyumlari'],
  ]),
  parent('hnd_metal', 'Metall va zargarlik', 'Gem', 'handmade', [
    ['hnd_met_jewel', 'Zargarlik (kumush, oltin)'], ['hnd_met_knife', 'Pichoqchilik'],
    ['hnd_met_copper', 'Mis va jez buyumlar'], ['hnd_met_forge', 'Temirchilik / kovka'],
    ['hnd_met_bijou', 'Bijuteriya va aksessuarlar'],
  ]),
  parent('hnd_leather', 'Teri va mo’yna', 'Backpack', 'handmade', [
    ['hnd_lea_bag', 'Teri sumka va hamyon'], ['hnd_lea_belt', 'Kulon va kamar'],
    ['hnd_lea_fur', 'Mo’yna buyumlar'], ['hnd_lea_ethno', 'Etnik kargush / sof buyumlar'],
  ]),
  parent('hnd_cloth', 'Kiyim va poyabzal (qo’l tikuv)', 'Shirt', 'handmade', [
    ['hnd_cl_nat', 'Milliy kiyim va ko’ylak'], ['hnd_cl_scarf', 'Ro’mol va sharflar'],
    ['hnd_cl_shoe', 'Qo’lda tikilgan poyabzal (chopoq, mahsi)'], ['hnd_cl_kids', 'Bolalar kiyimi (handmade)'],
  ]),
  parent('hnd_decor', 'Uy dekor va sovg’alar', 'Gift', 'handmade', [
    ['hnd_de_candle', 'Qo’l sham va sovun'], ['hnd_de_inter', 'Interyer dekor'],
    ['hnd_de_gift', 'Sovg’a setlari'], ['hnd_de_frame', 'Foto-ramka va albom'],
    ['hnd_de_ny', 'Bayram / o’yinchoq (handmade)'],
  ]),
  parent('hnd_instrument', 'Qo’l yasalgan musiqa asboblari', 'Music2', 'handmade', [
    ['hnd_ins_string', 'Torli: dutor, tar, g’ijjak'], ['hnd_ins_drum', 'Urma: doira, nagora'],
    ['hnd_ins_wind', 'Puflama: surnay, may'],
  ]),
  parent('hnd_other', 'Boshqa qo’l mehnati', 'Layers', 'handmade', [
    ['hnd_ot_deco', 'Fitni / dekorativ buyumlar'], ['hnd_ot_paper', 'Qog’oz va karton san’ati'],
    ['hnd_ot_other', 'Boshqa'],
  ]),
];

// ─── Assembly ──────────────────────────────────────────────────────────
export const ALL_CATALOG_CATEGORIES: ParentCategorySpec[] = [
  ...TRANSPORT, ...REALTY, ...JOBS_CATALOG, ...SERVICES, ...PERSONAL, ...HOME_DACHA,
  ...PARTS, ...ELECTRONICS, ...HOBBY, ...ANIMALS, ...BUSINESS, ...BUSINESS360, ...HANDMADE,
];
