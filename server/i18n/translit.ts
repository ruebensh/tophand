// ============================================================================
//  Server-side O'zbek lotin → kirill transliteratsiyasi.
//  Mijoz tarafi (src/i18n/translit.ts) bilan bir xil qoida — alohida nusxa,
//  chunki server va client bundlari mustaqil.
// ============================================================================

const APOSTROPHES = new Set(['\u2019', '\u02BB', '\u02BC', "'", '\u2018', '`', '\u00B4']);

const SINGLE: Record<string, string> = {
  a: 'а', b: 'б', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж',
  k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с',
  t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з', c: 'ц',
};

// Digraf/apostoflik birikmalar — ketma-ketlik muhim (uzunroq previliegend).
const DIGRAPHS: [string, string][] = [
  ['g\u02BB', 'ғ'], ['g\u2019', 'ғ'], ["g'", 'ғ'], ['gv', 'ғ'],
  ['o\u02BB', 'ў'], ['o\u2019', 'ў'], ["o'", 'ў'], ['ov', 'ў'],
  ['ch', 'ч'], ['sh', 'ш'], ['yu', 'ю'], ['ya', 'я'], ['ye', 'е'], ['yo', 'ё'],
];

export function uzLatnToCyrillic(input: string): string {
  if (!input) return '';
  let out = '';
  let i = 0;
  const lower = input.toLowerCase();
  while (i < input.length) {
    const two = lower.slice(i, i + 2);
    const digraph = DIGRAPHS.find(([src]) => src === two);
    if (digraph) {
      out += matchCase(input[i], digraph[1]);
      i += 2;
      continue;
    }
    const ch = input[i];
    const lch = ch.toLowerCase();
    if (APOSTROPHES.has(ch)) {
      i += 1;
      continue;
    }
    if (SINGLE[lch]) {
      out += matchCase(ch, SINGLE[lch]);
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function matchCase(source: string, cyr: string): string {
  const isUpper = source === source.toUpperCase() && source !== source.toLowerCase();
  return isUpper ? cyr.toUpperCase() : cyr;
}
