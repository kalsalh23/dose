// نقل القسمين تحت الفئات + إزالة الشارة — بناء النص برمجيًا لتجنب مشاكل الأسطر
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

const strip1 = `      <PopularStrip title="الأكثر مبيعًا" emoji="🔥" items={catalog?.best_sellers ?? []} cur={cur} openProduct={openProduct} />`;
const strip2 = `      <PopularStrip title="الأكثر طلبًا" emoji="⭐" items={catalog?.most_ordered ?? []} cur={cur} openProduct={openProduct} />`;
const cats = `      <FeaturedCategories catalog={catalog} cat={cat} setCat={(c) => { setCat(c); setQ(''); }} />`;

const oldTop = [strip1, strip2, cats].join('\n');
if (!s.includes(oldTop)) fail('top strips (joined)');
s = s.replace(oldTop, cats);

const anchorProducts = cats + "\n\n      <section className=\"mt-5\">";
if (!s.includes(anchorProducts)) fail('products anchor');
const stripsBelow = [strip1, strip2].join('\n');
s = s.replace(anchorProducts, cats + '\n\n' + stripsBelow + '\n\n      <section className="mt-5">');

/* إزالة شارة العدد */
const badge = `<div className="relative">
              <img src={p.image_url} alt={p.name_ar} loading="lazy" className="h-24 w-full rounded-[1rem] object-cover" />`;
if (s.includes(badge)) {
  s = s.replace(badge + `
              <span className="absolute top-1.5 left-1.5 rounded-full bg-[#26301C] px-2 py-0.5 text-[9.5px] font-black text-[#C9D3A8] shadow">
                {emoji === '🔥' ? \`أُبيع \${p.sold_qty}\` : \`\${p.order_count} طلبات\`}
              </span>
            </div>`, `<img src={p.image_url} alt={p.name_ar} loading="lazy" className="h-24 w-full rounded-[1rem] object-cover" />`);
  console.log('badge removed');
} else console.log('badge not found (may differ)');

writeFileSync(f, s);
console.log('strips now below categories:', s.indexOf('<PopularStrip') > s.indexOf('<FeaturedCategories catalog'));
