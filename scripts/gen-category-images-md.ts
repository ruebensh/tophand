// Kategoriya gridlari uchun kerakli PNG rasmlar ro'yxatini generatsiya qiladi.
// Ishga tushirish: npx tsx scripts/gen-category-images-md.ts
// Natija: public/categories/IMAGES.md
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ALL_CATALOG_CATEGORIES, CATALOGS_LIST } from '../server/db/categoriesData.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// catalog_id bo'yicha guruhlaymiz (faqat top-level / ota kategoriyalar)
const byCatalog = new Map<string, typeof ALL_CATALOG_CATEGORIES>();
for (const cat of CATALOGS_LIST) byCatalog.set(cat.id, []);
for (const p of ALL_CATALOG_CATEGORIES) {
  const cid = p.catalog_id ?? '';
  const arr = byCatalog.get(cid) ?? [];
  arr.push(p);
  byCatalog.set(cid, arr);
}

let total = 0;
const perCatalog: { id: string; name: string; count: number }[] = [];
for (const cat of CATALOGS_LIST) {
  const n = (byCatalog.get(cat.id) ?? []).length;
  total += n;
  perCatalog.push({ id: cat.id, name: cat.name_uz, count: n });
}

const lines: string[] = [];
lines.push('# Kategoriya gridlari uchun kerakli rasmlar (PNG)');
lines.push('');
lines.push(`**Jami: ${total} ta rasm** — har bir **top-level (ota) kategoriya** uchun bittadan.`);
lines.push('Subkategoriyalar uchun rasm shart emas (ular gridda ko\'rinmaydi).');
lines.push('');
lines.push('## Konvensiya');
lines.push('- Yo\'l: `public/categories/<catalogId>/<categoryId>.png`');
lines.push('- Format: **PNG, shaffof fon (alpha)** yoki toq-oq fon; ~120×120px yetarli.');
lines.push('- Rasm bo\'lmasa sayt avtomatik lucide **ikonkaga** qaytadi (fallback) — sahifa buzilmaydi.');
lines.push('- Bosh sahivadagi 13 katalog kartalari uchun alohida: `public/catalogs/<catalogId>.png` (mavjud).');
lines.push('');
lines.push('## Kataloglar bo\'yicha xulosa');
lines.push('');
lines.push('| Katalog | `catalogId` | Kerakli rasm |');
lines.push('|---|---|---|');
for (const c of perCatalog) lines.push(`| ${c.name} | \`${c.id}\` | ${c.count} |`);
lines.push(`| **Jami** |  | **${total}** |`);
lines.push('');
lines.push('## Har bir katalog — fayl nomlari');
lines.push('');
for (const cat of CATALOGS_LIST) {
  const items = byCatalog.get(cat.id) ?? [];
  lines.push(`### ${cat.name_uz} (\`${cat.id}\`) — ${items.length} ta`);
  lines.push('');
  for (const p of items) {
    const scopeNote = p.scope ? ` _[${p.scope}]_` : '';
    lines.push(`- \`public/categories/${cat.id}/${p.id}.png\` — ${p.name_uz}${scopeNote}`);
  }
  lines.push('');
}

const outPath = resolve(root, 'public/categories/IMAGES.md');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');

console.log(`Yozildi: ${outPath}`);
console.log(`Jami top-level kategoriyalar (rasm kerak): ${total}`);
for (const c of perCatalog) console.log(`  ${c.id.padEnd(12)} ${c.count}`);
