// ─── AI yordamchi: e'lon yaratish uchun atribut (filtr) va tavsif generatsiyasi ───
// TopHand "e'lon qo'shish" oqimida ishlatiladi:
//   1) prefillAttributes — foydalanuvchi yozgan SARLAVHA/havola (masalan "Cobalt")
//      asosida kategoriya filtrlarini (marka, model, yil, uzatma...) taklif qiladi.
//   2) composeDescription — to'ldirilgan ma'lumotlar (foydalanuvchi + AI) asosida
//      e'lon tavsifini va qisqa izohni yozadi.
// Gemini kaliti bo'lmasa yoki so'rov uzilsa — AQLLI HEURISTIC fallback ishlaydi,
// shuning uchun funksiya hech qachon "javobsiz" qolmaydi. Barcha qaytadigan
// qiymatlar kategoriya sxemasi (options/type) bilan TEKSHIRILADİ — AI g'alati
// yozgan bo'lsa, noto'g'ri qiymat tashlab yuboriladi (xavfsizlik).

import { GoogleGenAI } from '@google/genai';

export interface AttrSchemaField {
  key: string;
  label: string;
  type: string; // select | multiselect | number | text | range | bool | year | color
  options: string[];
  unit?: string | null;
  required?: boolean;
}

export type AttrValue = string | number | boolean;

// Gemini kaliti haqiqiy va ishlatiladigan mi? (eski `suggest-category` bilan bir xil mezon)
export function aiAvailable(): boolean {
  const apiKey = process.env.GEMINI_API_KEY;
  return !!apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 10;
}

// A (qotishlarga qarshi): Gemini so'rovini qat'iy davom chegarasi bilan o'raymiz.
// Timeout/429/xatolik → yuqoridagi chaqiruvchi try/catch fallback'ga tushadi,
// shunda e'lon yaratish HECH QACHON AI sababli to'xtab qolmaydi.
const AI_TIMEOUT_MS = 8000;
// Model nomi: Google eski modellarni yangi API kalitlaridan olib qo'yishi mumkin
// (masalan `gemini-2.5-flash` → 404 "no longer available to new users"). Shuning
// uchun nomni env orqali sozlanadigan qildik — kelajakda kodni o'zgartirmasdan
// GEMINI_MODEL bilan yangilash mumkin. Default: xatoda tavsiya etilgan model.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
async function genText(ai: GoogleGenAI, prompt: string): Promise<string> {
  return await Promise.race([
    ai
      .models.generateContent({ model: GEMINI_MODEL, contents: prompt })
      .then((r: any) => (r?.text as string) || ''),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('AI timeout')), AI_TIMEOUT_MS)),
  ]);
}

// ─── Qiymatni sxema bo'yida tozalash / tasdiqlash ───────────────────────
// Noto'g'ri (sxemaga mos kelmaydigan) qiymat → null (maydon bo'sh qoladi).
export function coerceAttrValue(field: AttrSchemaField, raw: unknown): AttrValue | null {
  if (raw === undefined || raw === null) return null;

  const norm = (s: string) =>
    s.toLowerCase().replace(/[\s'’`-]+/g, '').trim();

  switch (field.type) {
    case 'bool': {
      if (typeof raw === 'boolean') return raw;
      const t = norm(String(raw));
      if (['true', '1', 'ha', 'bor', 'evet', 'yes', 'oa'].includes(t)) return true;
      if (['false', '0', "yoq", "yo‘q", 'net', 'no', 'yok'].includes(t)) return false;
      return null;
    }
    case 'number':
    case 'year': {
      let n: number;
      if (typeof raw === 'number') n = raw;
      else {
        const m = String(raw).replace(/[^\d.,-]/g, '').replace(/,/g, '.');
        n = Number(m);
      }
      if (!Number.isFinite(n)) return null;
      if (field.type === 'year') {
        const y = Math.round(n);
        const max = new Date().getFullYear();
        if (y < 1950 || y > max) return null;
        return y;
      }
      return n;
    }
    case 'select':
    case 'color': {
      const opts = field.options && field.options.length ? field.options : [];
      const val = String(raw).trim();
      if (!val) return null;
      // Ro'yxat bo'lsa — aniq moslik (case-insensitive), bo'lmasa matn sifatida.
      if (opts.length === 0) return val;
      const hit = opts.find((o) => norm(o) === norm(val));
      return hit || null;
    }
    case 'multiselect': {
      const opts = field.options || [];
      const arr = Array.isArray(raw)
        ? raw.map((x) => String(x))
        : String(raw).split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
      if (opts.length === 0) {
        // Erkin matn — ro'yxatga bog'liq emas.
        const cleaned = arr.map((x) => x.trim()).filter(Boolean);
        return cleaned.length ? cleaned.join(', ') : null;
      }
      const matched: string[] = [];
      for (const v of arr) {
        const hit = opts.find((o) => norm(o) === norm(v));
        if (hit && !matched.includes(hit)) matched.push(hit);
      }
      return matched.length ? matched.join(', ') : null;
    }
    case 'range': {
      // range — matn ko'rinishidagi oralik/qiymat ("2018", "50000–80000").
      const val = String(raw).trim();
      return val ? val : null;
    }
    default: {
      const val = String(raw).trim();
      return val ? val : null;
    }
  }
}

// ─── Heuristic fallback: sarlavhadan kalit so'z orqali qiymat topish ────
// Ommabop model → brendlari (transport uchun).
const MODEL_TO_BRAND: Record<string, string> = {
  cobalt: 'Chevrolet', lacetti: 'Chevrolet', malibu: 'Chevrolet', spark: 'Chevrolet',
  ontra: 'Chevrolet', damas: 'Chevrolet', nexia: 'Chevrolet', captiva: 'Chevrolet',
  trailblazer: 'Chevrolet', tracker: 'Chevrolet', eptra: 'Chevrolet',
  sonata: 'Hyundai', elantra: 'Hyundai', tucson: 'Hyundai', santafe: 'Hyundai', 'santa fe': 'Hyundai', accent: 'Hyundai', creta: 'Hyundai',
  rio: 'Kia', ceed: 'Kia', forte: 'Kia', sportage: 'Kia', sorento: 'Kia', k5: 'Kia', seltos: 'Kia',
  camry: 'Toyota', corolla: 'Toyota', rav4: 'Toyota', 'land cruiser': 'Toyota', prado: 'Toyota',
  matiz: 'Daewoo',
};
const KNOWN_BRANDS = [
  'Chevrolet', 'Hyundai', 'Kia', 'Toyota', 'Nissan', 'Volkswagen', 'Mercedes-Benz',
  'BMW', 'Lexus', 'Mitsubishi', 'Daewoo', 'Ravon', 'Chery', 'Geely', 'Haval', 'KAMAZ',
];
// Kalit so'z → qiymat (attribute.key bo'yida).
const KW_TRANSMISSION: Array<[string, string]> = [
  ['avtomat', 'Avtomat'], ['avtomatik', 'Avtomat'], ['akpp', 'Avtomat'], ['at', 'Avtomat'],
  ['mexanika', 'Mexanika'], ['mechanic', 'Mexanika'], ['mkpp', 'Mexanika'], ['mt', 'Mexanika'],
  ['variator', 'Variator'], ['robot', 'Robotlashtirilgan'],
];
const KW_FUEL: Array<[string, string]> = [
  ['benzin', 'Benzin'], ['benza', 'Benzin'], ['dizel', 'Dizel'], ['disel', 'Dizel'],
  ['gaz', 'Gaz'], ['propan', 'Gaz'], ['gibrid', 'Gibrid'], ['hybrid', 'Gibrid'], ['elektr', 'Elektr'],
];
const KW_COLOR: Array<[string, string]> = [
  ['oq', 'Oq'], ['op', 'Oq'], ['qora', 'Qora'], ['black', 'Qora'],
  ['ko`k', "Ko'k"], ['kok', "Ko'k"], ['blue', "Ko'k"], ['yashin', 'Yashil'], ['yashil', 'Yashil'],
  ['green', 'Yashil'], ['qizil', 'Qizil'], ['red', 'Qizil'], ['kulrang', 'Kulrang'],
  ['sariq', 'Sariq'], ['jigarrang', 'Jigarrang'], ['kumush', 'Kulrang'], ['silver', 'Kulrang'],
];
const KW_BODY: Array<[string, string]> = [
  ['sedan', 'Sedan'], ['xetchbek', 'Xetchbek'], ['hetchbek', 'Xetchbek'], ['universal', 'Universal'],
  ['kupe', 'Kupe'], ['coupe', 'Kupe'], ['liftbek', 'Liftbek'], ['furgon', 'Furgon'],
  ['pikap', 'Pikap'], ['pick-up', 'Pikap'], ['krossover', 'Krossover'], ['crossover', 'Krossover'], ['jeep', 'Krossover'],
];
const KW_CONDITION: Array<[string, string]> = [
  ['yangi', 'Yangi'], ['new', 'Yangi'], ['ishlatilgan', 'Ishlatilgan'], ['ebiy', 'Ishlatilgan'], ['b/u', 'Ishlatilgan'],
];

// attribute kaliti/labeli bo'yicha maydon "guruhi"ni aniqlaymiz.
function fieldRole(field: AttrSchemaField): string {
  const k = field.key.toLowerCase();
  const l = field.label.toLowerCase();
  if (/(marka|brend|brand|ishlab.?chiqar|ishlab.chiqaruvchi)/.test(k + l)) return 'brand';
  if (/model/.test(k + l)) return 'model';
  if (/yil|god|year/.test(k + l) || (field.type === 'year')) return 'year';
  if (/(korobka|uzatma|transmiss|kpp)/.test(k + l)) return 'transmission';
  if (/(dvigatel|yonilgi|fuel|benzin)/.test(k + l)) return 'fuel';
  if (/^(rang|color)$/.test(k) || /rang/.test(l)) return 'color';
  if (/(korpus|kuzov|body|turi)/.test(k) || /korpus/.test(l)) return 'body';
  if (/(holat|condition|state)/.test(k + l)) return 'condition';
  return 'other';
}

function firstOptionMatch(field: AttrSchemaField, candidate: string): string | null {
  const hit = coerceAttrValue(field, candidate);
  return hit === null ? null : String(hit);
}

export function heuristicAttrValues(title: string, fields: AttrSchemaField[]): Record<string, AttrValue> {
  const low = ` ${title.toLowerCase()} `;
  const out: Record<string, AttrValue> = {};

  // Brand (avtomobil/telefon/laptop uchun eng foydali).
  let detectedBrand: string | null = null;
  for (const b of KNOWN_BRANDS) {
    if (low.includes(` ${b.toLowerCase()} `) || low.startsWith(`${b.toLowerCase()} `)) { detectedBrand = b; break; }
  }
  let detectedModel: string | null = null;
  for (const [model, brand] of Object.entries(MODEL_TO_BRAND)) {
    if (low.includes(model)) {
      if (!detectedBrand) detectedBrand = brand;
      detectedModel = model;
      break;
    }
  }

  // Yil — 4 xonali son.
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  const yearVal = yearMatch ? Number(yearMatch[0]) : null;

  for (const field of fields) {
    if (out[field.key] !== undefined) continue;
    const role = fieldRole(field);
    let cand: string | number | null = null;
    switch (role) {
      case 'brand':
        cand = detectedBrand;
        break;
      case 'model':
        if (detectedModel) cand = detectedModel.charAt(0).toUpperCase() + detectedModel.slice(1);
        break;
      case 'year':
        if (yearVal) cand = field.type === 'range' ? String(yearVal) : yearVal;
        break;
      case 'transmission':
        cand = KW_TRANSMISSION.find(([kw]) => low.includes(kw))?.[1] || null;
        break;
      case 'fuel':
        cand = KW_FUEL.find(([kw]) => low.includes(kw))?.[1] || null;
        break;
      case 'color':
        cand = KW_COLOR.find(([kw]) => low.includes(kw))?.[1] || null;
        break;
      case 'body':
        cand = KW_BODY.find(([kw]) => low.includes(kw))?.[1] || null;
        break;
      case 'condition':
        cand = KW_CONDITION.find(([kw]) => low.includes(kw))?.[1] || null;
        break;
      default:
        cand = null;
    }
    if (cand === null || cand === undefined) continue;
    const coerced = coerceAttrValue(field, cand);
    if (coerced !== null) out[field.key] = coerced;
  }
  return out;
}

// ─── 1) Atributlarni to'ldirish (Gemini + fallback) ─────────────────────
export async function prefillAttributes(opts: {
  title: string;
  description?: string;
  fields: AttrSchemaField[]; // FAQAT bo'sh maydonlar (client tomonidan filtrlangan)
}): Promise<{ values: Record<string, AttrValue>; reasoning: string }> {
  const { title, description = '', fields } = opts;
  const text = `${title.trim()}\n${description.trim()}`.trim();

  // AI ishtirokida (kalit so'rov). Xatolik bo'lsa — pastda fallback.
  if (aiAvailable() && fields.length > 0) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const spec = fields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        unit: f.unit || null,
        options: f.options && f.options.length ? f.options : undefined,
      }));
      const prompt = `Sen O'zbekistondagi "TopHand" e'lon platformasidagi yordamchisan.
Foydalanuvchi e'lon sarlavhasini yozdi. Ushbu sarlavha/ixtiyoriy matn asosida quyidagi kategoriya filtrlari (atributlari) uchun eng mos qiymatlarni TAKLIF qil.

E'lon sarlavhasi: "${title.trim()}"
${description ? `Qo'shimcha matn: "${description.trim()}"` : ''}

Filtrlar sxemasi (JSON):
${JSON.stringify(spec, null, 2)}

Qoidalar:
- FAQAT sxemadagi "key" lardan foydalan. Istalgan filtorni o'ylab topma.
- "select" va "color" uchun qiymat ANIQ "options" ro'yxatidagi bitta element bo'lsin.
- "multiselect" uchun "options" dagi elementlarni vergul bilan (masalan: "Sedan, Yangi").
- "year" / "number" uchun son (masalan 2019, 120000).
- "range" uchun qator (masalan "2018" yoki "50000-80000").
- "bool" uchun true yoki false.
- Agar biror filtr bo'yicha ishonching past bo'lsa, UNi umuman kiritma (topib yozma).
- Javobni FAQAT quyidagi JSON ko'rinishida qaytar, boshqa matn/markdown siz:
{ "values": { "key1": "qiymat", "key2": 2019 }, "reasoning": "o'zbek tilida 1 jumlalik izoh" }`;

      const rawText = await genText(ai, prompt);
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const rawValues = (parsed && typeof parsed.values === 'object' && parsed.values) || {};
        const values: Record<string, AttrValue> = {};
        for (const f of fields) {
          const coerced = coerceAttrValue(f, rawValues[f.key]);
          if (coerced !== null) values[f.key] = coerced;
        }
        if (Object.keys(values).length > 0) {
          return { values, reasoning: parsed.reasoning || 'Sarlavha tahlili asosida to‘ldirildi' };
        }
      }
    } catch (err: any) {
      console.warn('AI prefillAttributes xato (fallback ishlatiladi):', err?.message);
    }
  }

  // Fallback: kalit so'z qidiruvi.
  const values = heuristicAttrValues(title, fields);
  return {
    values,
    reasoning: Object.keys(values).length
      ? 'Sarlavhadagi kalit so‘zlar asosida to‘ldirildi'
      : 'Sarlavhadan aniq filtr topilmadi',
  };
}

// ─── 2) Tavsif + izoh generatsiyasi ─────────────────────────────────────
export interface DescriptionInput {
  title: string;
  typeLabel?: string;
  catalogName?: string;
  categoryName?: string;
  subcategoryName?: string;
  attributes?: { label: string; value: string }[];
  features?: string[];
  priceText?: string;
  salaryText?: string;
  location?: string;
  extra?: string;
}

function fallbackDescription(input: DescriptionInput): { description: string; note: string } {
  const parts: string[] = [];
  parts.push(`${input.title.trim()}.`);
  const catLine = [input.catalogName, input.categoryName, input.subcategoryName]
    .filter(Boolean).join(' › ');
  if (catLine) parts.push(`Yo‘nalish: ${catLine}.`);
  const attrs = (input.attributes || []).filter((a) => a.value && String(a.value).trim());
  if (attrs.length) parts.push(`Xususiyatlari: ${attrs.map((a) => `${a.label}: ${a.value}`).join(', ')}.`);
  if (input.features && input.features.length) parts.push(`Afzalliklari: ${input.features.join(', ')}.`);
  if (input.priceText) parts.push(`Narx: ${input.priceText}.`);
  if (input.salaryText) parts.push(`Maosh: ${input.salaryText}.`);
  if (input.location) parts.push(`Joylashuv: ${input.location}.`);
  if (input.extra) parts.push(input.extra.trim());
  const description = parts.join(' ');
  const note = 'Holat, narx va qo‘shimcha shartlar bo‘yicha batafsil ma’lumot uchun bog‘laning.';
  return { description, note };
}

export async function composeDescription(input: DescriptionInput): Promise<{ description: string; note: string }> {
  if (aiAvailable()) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const facts = JSON.stringify(input, null, 2);
      const prompt = `Sen "TopHand" (O'zbekiston e'lonlar platformasi) uchun professional nusxa muharrarisans.
Quyidagi faktlar asosida O'zbek TILIDA chiroyli, ishonchli va sotuvga undovchi e'lon TAVSIFI yoz.

Faktlar (JSON):
${facts}

Talablar:
- Tavsif: 3–6 jumla, aniq va sodda til, e'motsiz yoki cheklangan. Faqat berilgan faktlarga tayan — g'alati ma'lumot uydurma.
- "note": 1 jumlalik qisqa izoh/vasvasa (xaridorni bog'lanishga chaqiruvchi).
- Javobni FAQAT JSON: { "description": "...", "note": "..." }`;
      const rawText = await genText(ai, prompt);
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const description = typeof parsed.description === 'string' ? parsed.description.trim() : '';
        const note = typeof parsed.note === 'string' ? parsed.note.trim() : '';
        if (description.length >= 15) return { description, note: note || fallbackDescription(input).note };
      }
    } catch (err: any) {
      console.warn('AI composeDescription xato (fallback ishlatiladi):', err?.message);
    }
  }
  return fallbackDescription(input);
}
