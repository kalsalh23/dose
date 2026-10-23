// إصلاح البحث: إعادة فلترة shown حسب q
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

const old = "  let shown = cat === 'all' ? products : products.filter((p) => p.category === cat);\n  const cur = catalog?.settings?.currency_symbol ?? 'ل.س';";
if (!s.includes(old)) fail('shown line');
const nw = `  let shown = cat === 'all' ? products : products.filter((p) => p.category === cat);
  if (q.trim()) {
    const needle = q.trim().toLowerCase();
    shown = shown.filter((p) => p.name_ar.includes(needle) || p.name_en.toLowerCase().includes(needle));
  }
  const cur = catalog?.settings?.currency_symbol ?? 'ل.س';`;
s = s.replace(old, nw);
writeFileSync(f, s);
console.log('search filter restored');
