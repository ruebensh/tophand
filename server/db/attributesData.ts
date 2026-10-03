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
  A('grafik', 'Ish grafigi', 'select', { options: ['To’liq kun', 'Smenalar', 'Yarim kun', 'Masofaviy'] }),
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
const CATEGORY_OVERRIDES: Record<string, AttributeDef[]> = {
  el_phone_mob: [
    ...GOODS,
    A('xotita', 'Xotita', 'select', { options: ['16', '32', '64', '128', '256', '512'], unit: 'GB' }),
    A('ram', 'RAM', 'select', { options: ['2', '3', '4', '6', '8', '12'], unit: 'GB' }),
    A('ekran', 'Ekran', 'number', { unit: 'dyuym' }),
  ],
  el_laptop: [
    ...GOODS,
    A('protsessor', 'Protsessor', 'text'),
    A('ram', 'RAM', 'text', { unit: 'GB' }),
    A('ssd', 'SSD/HDD', 'text'),
    A('ekran', 'Ekran', 'number', { unit: 'dyuym' }),
  ],
  el_desktop: [
    ...GOODS,
    A('protsessor', 'Protsessor', 'text'),
    A('ram', 'RAM', 'text', { unit: 'GB' }),
    A('ssd', 'SSD/HDD', 'text'),
  ],
  el_av_tv: [
    ...GOODS,
    A('diagonal', 'Diagonal', 'number', { unit: 'dyuym' }),
    A('ruxsat', 'Ruxsat', 'select', { options: ['HD', 'Full HD', '4K UHD'] }),
    A('smart', 'Smart TV', 'bool'),
  ],
  per_clothing: [
    A('holat', 'Holat', 'select', { options: ['Yangi', 'Kiylangan'], required: true }),
    A('olcham', 'O’lcham', 'text'),
    A('mavsum', 'Mavsum', 'select', { options: ['Yozgi', 'Qishki', 'Butun yil'] }),
    A('material', 'Material', 'text'),
    A('rang', 'Rang', 'color'),
    A('brend', 'Brend', 'text'),
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
  const BATCH = 400;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const placeholders: string[] = [];
    const params: any[] = [];
    for (const r of batch) {
      placeholders.push('(?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?)');
      params.push(r.id, r.category_id, r.key, r.label, r.type, r.options, r.unit, r.required, r.filterable, r.sort_order);
    }
    await runQuery(
      `INSERT INTO category_attributes
         (id, category_id, key, label_uz, type, options, unit, required, filterable, sort_order)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (category_id, key) DO UPDATE SET
         label_uz = EXCLUDED.label_uz,
         type = EXCLUDED.type,
         options = EXCLUDED.options,
         unit = EXCLUDED.unit,
         required = EXCLUDED.required,
         filterable = EXCLUDED.filterable,
         sort_order = EXCLUDED.sort_order`,
      params
    );
  }
  console.log(`✅ Category attributes synced: ${rows.length} attribute definitions.`);
}
