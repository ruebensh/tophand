// Statik rasmlarni yengillashtiruvchi bir martalik skript (sharp — loyihadagi mavjud deps).
//   • public/catalog-heroes/*.jpg  → max 1400px kenglik, progressive JPEG q68
//   • public/catalogs/*.png        → max 360px, palette PNG (shaffoflik saqlanadi)
//   • public/favicon-*.png, logo.png → mos ravishda 180px (apple-touch) / 600px (og:image)
// Fayllar JOYIDA qayta yoziladi (yo'llar va kengaytmalar o'zgarmaydi), shuning uchun
// hech qanday koddagi reference'larni tegish shart emas.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

async function minify(file, opts) {
  const before = fs.statSync(file).size;
  const tmp = file + '.tmp';
  await sharp(file)[opts.kind](opts.enc).resize(opts.resize).toFile(tmp);
  fs.renameSync(tmp, file);
  const after = fs.statSync(file).size;
  const kb = (n) => (n / 1024).toFixed(0);
  console.log(`${path.relative(root, file)}: ${kb(before)}KB → ${kb(after)}KB (${Math.round((1 - after / before) * 100)}% uyum)`);
}

const jobs = [];

// 1) Katalog hero JPEG'lari
const heroesDir = path.join(root, 'public/catalog-heroes');
for (const f of fs.readdirSync(heroesDir).filter((n) => n.toLowerCase().endsWith('.jpg'))) {
  jobs.push(minify(path.join(heroesDir, f), {
    kind: 'jpeg',
    enc: { quality: 68, progressive: true, mozjpeg: true },
    resize: { width: 1400, withoutEnlargement: true },
  }));
}

// 2) Katalog tile PNG'lari (kichik ko'rinadi — 360px yetarli)
const catsDir = path.join(root, 'public/catalogs');
for (const f of fs.readdirSync(catsDir).filter((n) => n.endsWith('.png'))) {
  jobs.push(minify(path.join(catsDir, f), {
    kind: 'png',
    enc: { palette: true, quality: 80, effort: 8 },
    resize: { width: 360, height: 360, fit: 'inside', withoutEnlargement: true },
  }));
}

// 3) Favicon va logo PNG'lari
for (const [name, size] of [['favicon-light.png', 180], ['favicon-dark.png', 180], ['logo.png', 600]]) {
  const file = path.join(root, 'public', name);
  if (fs.existsSync(file)) {
    jobs.push(minify(file, {
      kind: 'png',
      enc: { palette: true, quality: 82, effort: 8 },
      resize: { width: size, height: size, fit: 'inside', withoutEnlargement: true },
    }));
  }
}

await Promise.all(jobs);
console.log('✓ Statik rasmlar yengillashtirildi.');
