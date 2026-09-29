export interface DistrictData {
  id: string;
  region_id: string;
  name_uz: string;
  lat: number;
  lon: number;
  order: number;
}

export const UZBEKISTAN_DISTRICTS: DistrictData[] = [
  // ─── Toshkent shahri ──────────────────────────────────────────────────
  { id: 'dis_yunusobod', region_id: 'reg_toshkent_sh', name_uz: 'Yunusobod tumani', lat: 41.3650, lon: 69.2900, order: 1 },
  { id: 'dis_mirzo_ulugbek', region_id: 'reg_toshkent_sh', name_uz: "Mirzo Ulug'bek tumani", lat: 41.3300, lon: 69.3400, order: 2 },
  { id: 'dis_chilonzor', region_id: 'reg_toshkent_sh', name_uz: 'Chilonzor tumani', lat: 41.2750, lon: 69.2050, order: 3 },
  { id: 'dis_yakkasaroy', region_id: 'reg_toshkent_sh', name_uz: 'Yakkasaroy tumani', lat: 41.2850, lon: 69.2550, order: 4 },
  { id: 'dis_shayxontohur', region_id: 'reg_toshkent_sh', name_uz: 'Shayxontohur tumani', lat: 41.3200, lon: 69.2450, order: 5 },
  { id: 'dis_olmazor', region_id: 'reg_toshkent_sh', name_uz: 'Olmazor tumani', lat: 41.3450, lon: 69.2150, order: 6 },
  { id: 'dis_uchtepa', region_id: 'reg_toshkent_sh', name_uz: 'Uchtepa tumani', lat: 41.2950, lon: 69.1750, order: 7 },
  { id: 'dis_bektemir', region_id: 'reg_toshkent_sh', name_uz: 'Bektemir tumani', lat: 41.2200, lon: 69.3450, order: 8 },
  { id: 'dis_mirobod', region_id: 'reg_toshkent_sh', name_uz: 'Mirobod tumani', lat: 41.2950, lon: 69.2850, order: 9 },
  { id: 'dis_sirg_ali', region_id: 'reg_toshkent_sh', name_uz: "Sergeli tumani", lat: 41.2250, lon: 69.2250, order: 10 },
  { id: 'dis_yashnobod', region_id: 'reg_toshkent_sh', name_uz: 'Yashnobod tumani', lat: 41.2950, lon: 69.3350, order: 11 },
  { id: 'dis_yangihayot', region_id: 'reg_toshkent_sh', name_uz: 'Yangihayot tumani', lat: 41.2050, lon: 69.2150, order: 12 },

  // ─── Toshkent viloyati ────────────────────────────────────────────────
  { id: 'dis_chirchiq', region_id: 'reg_toshkent', name_uz: 'Chirchiq shahri', lat: 41.4689, lon: 69.5822, order: 1 },
  { id: 'dis_angren', region_id: 'reg_toshkent', name_uz: 'Angren shahri', lat: 41.0167, lon: 70.1436, order: 2 },
  { id: 'dis_olmaliq', region_id: 'reg_toshkent', name_uz: 'Olmaliq shahri', lat: 40.8500, lon: 69.6000, order: 3 },
  { id: 'dis_bekobod_sh', region_id: 'reg_toshkent', name_uz: 'Bekobod shahri', lat: 40.2167, lon: 69.2167, order: 4 },
  { id: 'dis_yangiyol_sh', region_id: 'reg_toshkent', name_uz: "Yangiyo'l shahri", lat: 41.1167, lon: 69.0500, order: 5 },
  { id: 'dis_bostonliq', region_id: 'reg_toshkent', name_uz: "Bo'stonliq tumani (G'azalkent)", lat: 41.5667, lon: 69.7667, order: 6 },
  { id: 'dis_qibray', region_id: 'reg_toshkent', name_uz: 'Qibray tumani', lat: 41.3833, lon: 69.4500, order: 7 },
  { id: 'dis_zangiota', region_id: 'reg_toshkent', name_uz: 'Zangiota tumani', lat: 41.2333, lon: 69.1500, order: 8 },
  { id: 'dis_parkent', region_id: 'reg_toshkent', name_uz: 'Parkent tumani', lat: 41.2944, lon: 69.6764, order: 9 },
  { id: 'dis_yuqorichirchiq', region_id: 'reg_toshkent', name_uz: 'Yuqori Chirchiq tumani', lat: 41.2833, lon: 69.5333, order: 10 },

  // ─── Samarqand viloyati ───────────────────────────────────────────────
  { id: 'dis_samarqand_sh', region_id: 'reg_samarqand', name_uz: 'Samarqand shahri', lat: 39.6542, lon: 66.9597, order: 1 },
  { id: 'dis_urgut', region_id: 'reg_samarqand', name_uz: 'Urgut tumani', lat: 39.4000, lon: 67.2500, order: 2 },
  { id: 'dis_kattaqorgon_sh', region_id: 'reg_samarqand', name_uz: "Kattaqo'rg'on shahri", lat: 39.9000, lon: 66.2500, order: 3 },
  { id: 'dis_pastdargom', region_id: 'reg_samarqand', name_uz: "Pastdarg'om tumani", lat: 39.5833, lon: 66.7167, order: 4 },
  { id: 'dis_bulungur', region_id: 'reg_samarqand', name_uz: "Bulung'ur tumani", lat: 39.7500, lon: 67.2833, order: 5 },
  { id: 'dis_toyloq', region_id: 'reg_samarqand', name_uz: 'Toyloq tumani', lat: 39.6000, lon: 67.0833, order: 6 },
  { id: 'dis_ishtixon', region_id: 'reg_samarqand', name_uz: 'Ishtixon tumani', lat: 39.9667, lon: 66.4833, order: 7 },
  { id: 'dis_payariq', region_id: 'reg_samarqand', name_uz: 'Payariq tumani', lat: 40.0167, lon: 66.8500, order: 8 },

  // ─── Farg'ona viloyati ────────────────────────────────────────────────
  { id: 'dis_fargona_sh', region_id: 'reg_fargona', name_uz: "Farg'ona shahri", lat: 40.3842, lon: 71.7843, order: 1 },
  { id: 'dis_margilon', region_id: 'reg_fargona', name_uz: "Marg'ilon shahri", lat: 40.4722, lon: 71.7167, order: 2 },
  { id: 'dis_qoqon', region_id: 'reg_fargona', name_uz: "Qo'qon shahri", lat: 40.5333, lon: 70.9333, order: 3 },
  { id: 'dis_quvasoy', region_id: 'reg_fargona', name_uz: 'Quvasoy shahri', lat: 40.3000, lon: 71.9667, order: 4 },
  { id: 'dis_oltiariq', region_id: 'reg_fargona', name_uz: 'Oltiariq tumani', lat: 40.4000, lon: 71.4833, order: 5 },
  { id: 'dis_rishton', region_id: 'reg_fargona', name_uz: 'Rishton tumani', lat: 40.3500, lon: 71.2833, order: 6 },
  { id: 'dis_uchkoprik', region_id: 'reg_fargona', name_uz: "Uchko'prik tumani", lat: 40.5333, lon: 71.0500, order: 7 },
  { id: 'dis_bagdod', region_id: 'reg_fargona', name_uz: "Bag'dod tumani", lat: 40.4500, lon: 71.2167, order: 8 },

  // ─── Andijon viloyati ─────────────────────────────────────────────────
  { id: 'dis_andijon_sh', region_id: 'reg_andijon', name_uz: 'Andijon shahri', lat: 40.7821, lon: 72.3442, order: 1 },
  { id: 'dis_asaka', region_id: 'reg_andijon', name_uz: 'Asaka tumani', lat: 40.6400, lon: 72.2300, order: 2 },
  { id: 'dis_xonobod', region_id: 'reg_andijon', name_uz: 'Xonobod shahri', lat: 40.8000, lon: 72.9833, order: 3 },
  { id: 'dis_shahrixon', region_id: 'reg_andijon', name_uz: 'Shahrixon tumani', lat: 40.7167, lon: 72.0500, order: 4 },
  { id: 'dis_baliqchi', region_id: 'reg_andijon', name_uz: 'Baliqchi tumani', lat: 40.9333, lon: 71.9000, order: 5 },
  { id: 'dis_oltinkol', region_id: 'reg_andijon', name_uz: "Oltinko'l tumani", lat: 40.7667, lon: 72.1833, order: 6 },
  { id: 'dis_qorgontepa', region_id: 'reg_andijon', name_uz: "Qo'rg'ontepa tumani", lat: 40.7333, lon: 72.7500, order: 7 },

  // ─── Namangan viloyati ────────────────────────────────────────────────
  { id: 'dis_namangan_sh', region_id: 'reg_namangan', name_uz: 'Namangan shahri', lat: 40.9983, lon: 71.6726, order: 1 },
  { id: 'dis_chortoq', region_id: 'reg_namangan', name_uz: 'Chortoq tumani', lat: 41.0667, lon: 71.8167, order: 2 },
  { id: 'dis_chust', region_id: 'reg_namangan', name_uz: 'Chust tumani', lat: 41.0000, lon: 71.2333, order: 3 },
  { id: 'dis_pop', region_id: 'reg_namangan', name_uz: 'Pop tumani', lat: 40.8667, lon: 71.1000, order: 4 },
  { id: 'dis_kosonsoy', region_id: 'reg_namangan', name_uz: 'Kosonsoy tumani', lat: 41.2500, lon: 71.5500, order: 5 },
  { id: 'dis_toraqorgon', region_id: 'reg_namangan', name_uz: "To'raqo'rg'on tumani", lat: 41.0000, lon: 71.5167, order: 6 },
  { id: 'dis_uchqorgon', region_id: 'reg_namangan', name_uz: "Uchqo'rg'on tumani", lat: 41.1167, lon: 72.0833, order: 7 },

  // ─── Buxoro viloyati ──────────────────────────────────────────────────
  { id: 'dis_buxoro_sh', region_id: 'reg_buxoro', name_uz: 'Buxoro shahri', lat: 39.7747, lon: 64.4286, order: 1 },
  { id: 'dis_gijduvon', region_id: 'reg_buxoro', name_uz: "G'ijduvon tumani", lat: 40.1000, lon: 64.6667, order: 2 },
  { id: 'dis_kogon_sh', region_id: 'reg_buxoro', name_uz: 'Kogon shahri', lat: 39.7167, lon: 64.5500, order: 3 },
  { id: 'dis_qorakol', region_id: 'reg_buxoro', name_uz: "Qorako'l tumani", lat: 39.5000, lon: 63.8500, order: 4 },
  { id: 'dis_jondor', region_id: 'reg_buxoro', name_uz: 'Jondor tumani', lat: 39.7333, lon: 64.1833, order: 5 },
  { id: 'dis_vobkent', region_id: 'reg_buxoro', name_uz: 'Vobkent tumani', lat: 40.0333, lon: 64.5167, order: 6 },

  // ─── Xorazm viloyati ──────────────────────────────────────────────────
  { id: 'dis_urganch_sh', region_id: 'reg_xorazm', name_uz: 'Urganch shahri', lat: 41.5500, lon: 60.6333, order: 1 },
  { id: 'dis_xiva_sh', region_id: 'reg_xorazm', name_uz: 'Xiva shahri', lat: 41.3783, lon: 60.3639, order: 2 },
  { id: 'dis_xonqa', region_id: 'reg_xorazm', name_uz: 'Xonqa tumani', lat: 41.4833, lon: 60.7833, order: 3 },
  { id: 'dis_gurlan', region_id: 'reg_xorazm', name_uz: 'Gurlan tumani', lat: 41.8333, lon: 60.3833, order: 4 },
  { id: 'dis_shovot', region_id: 'reg_xorazm', name_uz: 'Shovot tumani', lat: 41.6833, lon: 60.3000, order: 5 },
  { id: 'dis_hazorasp', region_id: 'reg_xorazm', name_uz: 'Hazorasp tumani', lat: 41.3167, lon: 61.0667, order: 6 },

  // ─── Qashqadaryo viloyati ─────────────────────────────────────────────
  { id: 'dis_qarshi_sh', region_id: 'reg_qashqadaryo', name_uz: 'Qarshi shahri', lat: 38.8606, lon: 65.7890, order: 1 },
  { id: 'dis_shahrisabz_sh', region_id: 'reg_qashqadaryo', name_uz: 'Shahrisabz shahri', lat: 39.0500, lon: 66.8333, order: 2 },
  { id: 'dis_kitob', region_id: 'reg_qashqadaryo', name_uz: 'Kitob tumani', lat: 39.1333, lon: 66.8833, order: 3 },
  { id: 'dis_guzor', region_id: 'reg_qashqadaryo', name_uz: "G'uzor tumani", lat: 38.6167, lon: 66.2500, order: 4 },
  { id: 'dis_koson', region_id: 'reg_qashqadaryo', name_uz: 'Koson tumani', lat: 39.0333, lon: 65.5833, order: 5 },
  { id: 'dis_yakkabog', region_id: 'reg_qashqadaryo', name_uz: "Yakkabog' tumani", lat: 38.9833, lon: 66.6833, order: 6 },

  // ─── Surxondaryo viloyati ─────────────────────────────────────────────
  { id: 'dis_termiz_sh', region_id: 'reg_surxondaryo', name_uz: 'Termiz shahri', lat: 37.2242, lon: 67.2783, order: 1 },
  { id: 'dis_denov', region_id: 'reg_surxondaryo', name_uz: 'Denov tumani', lat: 38.2667, lon: 67.9000, order: 2 },
  { id: 'dis_shorchi', region_id: 'reg_surxondaryo', name_uz: "Sho'rchi tumani", lat: 37.9833, lon: 67.7833, order: 3 },
  { id: 'dis_jarqorgon', region_id: 'reg_surxondaryo', name_uz: "Jarqo'rg'on tumani", lat: 37.5000, lon: 67.4167, order: 4 },
  { id: 'dis_boysun', region_id: 'reg_surxondaryo', name_uz: 'Boysun tumani', lat: 38.2000, lon: 67.2000, order: 5 },

  // ─── Jizzax viloyati ──────────────────────────────────────────────────
  { id: 'dis_jizzax_sh', region_id: 'reg_jizzax', name_uz: 'Jizzax shahri', lat: 40.1250, lon: 67.8808, order: 1 },
  { id: 'dis_zomin', region_id: 'reg_jizzax', name_uz: 'Zomin tumani', lat: 39.9667, lon: 68.4000, order: 2 },
  { id: 'dis_gallaorol', region_id: 'reg_jizzax', name_uz: "G'allaorol tumani", lat: 40.0333, lon: 67.5833, order: 3 },
  { id: 'dis_paxtakor', region_id: 'reg_jizzax', name_uz: 'Paxtakor tumani', lat: 40.3167, lon: 67.9500, order: 4 },

  // ─── Sirdaryo viloyati ────────────────────────────────────────────────
  { id: 'dis_guliston_sh', region_id: 'reg_sirdaryo', name_uz: 'Guliston shahri', lat: 40.4897, lon: 68.7842, order: 1 },
  { id: 'dis_yangiyer_sh', region_id: 'reg_sirdaryo', name_uz: 'Yangiyer shahri', lat: 40.2667, lon: 68.8167, order: 2 },
  { id: 'dis_shirin_sh', region_id: 'reg_sirdaryo', name_uz: 'Shirin shahri', lat: 40.2167, lon: 69.1333, order: 3 },
  { id: 'dis_boyovut', region_id: 'reg_sirdaryo', name_uz: 'Boyovut tumani', lat: 40.4167, lon: 69.0500, order: 4 },

  // ─── Navoiy viloyati ──────────────────────────────────────────────────
  { id: 'dis_navoiy_sh', region_id: 'reg_navoiy', name_uz: 'Navoiy shahri', lat: 40.0844, lon: 65.3792, order: 1 },
  { id: 'dis_zarafshon_sh', region_id: 'reg_navoiy', name_uz: 'Zarafshon shahri', lat: 41.5667, lon: 64.2000, order: 2 },
  { id: 'dis_karmana', region_id: 'reg_navoiy', name_uz: 'Karmana tumani', lat: 40.1333, lon: 65.3667, order: 3 },
  { id: 'dis_qiziltepa', region_id: 'reg_navoiy', name_uz: 'Qiziltepa tumani', lat: 40.0333, lon: 64.8167, order: 4 },
  { id: 'dis_xatirchi', region_id: 'reg_navoiy', name_uz: 'Xatirchi tumani', lat: 40.0333, lon: 65.9500, order: 5 },

  // ─── Qoraqalpog'iston Respublikasi ───────────────────────────────────
  { id: 'dis_nukus_sh', region_id: 'reg_qoraqalpogiston', name_uz: 'Nukus shahri', lat: 42.4611, lon: 59.6166, order: 1 },
  { id: 'dis_xojayli', region_id: 'reg_qoraqalpogiston', name_uz: "Xo'jayli tumani", lat: 42.4000, lon: 59.4500, order: 2 },
  { id: 'dis_qongirot', region_id: 'reg_qoraqalpogiston', name_uz: "Qo'ng'irot tumani", lat: 43.0500, lon: 58.8333, order: 3 },
  { id: 'dis_beruniy', region_id: 'reg_qoraqalpogiston', name_uz: 'Beruniy tumani', lat: 41.6833, lon: 60.7500, order: 4 },
  { id: 'dis_tortkol', region_id: 'reg_qoraqalpogiston', name_uz: "To'rtko'l tumani", lat: 41.5500, lon: 61.0000, order: 5 },
  { id: 'dis_chimboy', region_id: 'reg_qoraqalpogiston', name_uz: 'Chimboy tumani', lat: 42.9333, lon: 59.7667, order: 6 },
];
