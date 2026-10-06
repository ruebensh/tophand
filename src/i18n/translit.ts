// ============================================================================
//  O'zbek LOTIN → KIRILL transliteratsiyasi
// ----------------------------------------------------------------------------
//  Saytdagi `uz-Cyrl` (Ўзбекча кирилл) varianti alohida tarjima fayliga ega
//  emas — lotincha manba matn shu funksiya orqali kirillga aylantiriladi.
//  O'zbek alifbosi lotin↔kirill deyarli 1:1 mos, shuning uchun natija aniq.
//
//  Qoidalar:
//   - Digraflar (birinchi tekshiriladi): CH→Ч, SH→Ш, G'+→Ғ, O'+→Ў
//   - Yagona harflar: H→Ҳ, Q→Қ, X→Х, Y→Й, C→Ц ... (apostrofdan keyin)
//   - Apostrof (o'g'ir belgisi: ’ ʻ ' ‘ ` ´) tushiriladi
//   - Katta/kichik holat saqlanadi; mapped bo'lmagan belgilar o'zgarishsiz
// ============================================================================

const APOSTROPHES = new Set(['\u2019', '\u02BB', '\u02BC', "'", '\u2018', '`', '\u00B4']);

// Kichik harf → kichik kirill
const SINGLE: Record<string, string> = {
  a: 'а', b: 'б', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж',
  k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с',
  t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з', c: 'ц',
};

const isUpper = (ch: string): boolean => ch === ch.toUpperCase() && ch !== ch.toLowerCase();
const isApos = (ch: string | undefined): boolean => !!ch && APOSTROPHES.has(ch);

/** O'zbek lotincha matnni kirill alifbosiga o'giradi. */
export function uzLatnToCyrillic(input: string): string {
  if (!input) return input;
  let out = '';
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    const next = input[i + 1];
    const lower = ch.toLowerCase();
    const nextLower = next ? next.toLowerCase() : '';

    // G' → Ғ, O' → Ў (harf + apostrof digrafi)
    if ((lower === 'g' || lower === 'o') && isApos(next)) {
      const cyr = lower === 'g' ? 'ғ' : 'ў';
      out += isUpper(ch) ? cyr.toUpperCase() : cyr;
      i += 2;
      continue;
    }
    // CH → Ч, SH → Ш
    if (lower === 'c' && nextLower === 'h') {
      out += isUpper(ch) ? 'Ч' : 'ч';
      i += 2;
      continue;
    }
    if (lower === 's' && nextLower === 'h') {
      out += isUpper(ch) ? 'Ш' : 'ш';
      i += 2;
      continue;
    }
    // Yakka apostrof → tushiriladi
    if (isApos(ch)) {
      i += 1;
      continue;
    }
    const mapped = SINGLE[lower];
    if (mapped) {
      out += isUpper(ch) ? mapped.toUpperCase() : mapped;
      i += 1;
      continue;
    }
    // Mapped bo'lmagan (raqam, tinish belgilari, boshqa yozuv) → o'zgarishsiz
    out += ch;
    i += 1;
  }
  return out;
}

export default uzLatnToCyrillic;
