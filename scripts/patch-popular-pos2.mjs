// القسمان أسفل الفئات + إزالة شارة العدد
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* 1) إزالة الشريطين من الأعلى */
const oldTop = `      <PopularStrip title="الأكثر مبيعًا" emoji="🔥" items={catalog?.best_sellers ?? []} cur={cur} openProduct={openProduct} />
      <PopularStrip title="الأكثر طلبًا" emoji="⭐" items={catalog?.most_ordered ?? []} cur={cur} openProduct={openProduct} />
      <FeaturedCategories catalog={catalog} cat={cat} setCat={(c) => { setCat(c); setQ(''); }} />`;
if (!s.includes(oldTop)) fail('top strips');
s = s.replace(oldTop, `      <FeaturedCategories catalog={catalog} cat={cat} setCat={(c) => { setCat(c); setQ(''); }} />`);

/* 2) إضافتهما بعد الفئات مباشرة (قبل قسم المنتجات) */
const anchorProducts = `'''); }} />

      <section className="mt-5">`;
if (!s.includes(anchorProducts)) fail('products anchor');
s = s.replace(anchorProducts, `'''); }} />

      <PopularStrip title="الأكثر مبيعًا" emoji="🔥" items={catalog?.best_sellers ?? []} cur={cur} openProduct={openProduct} />
      <PopularStrip title="الأكثر طلبًا" emoji="⭐" items={catalog?.most_ordered ?? []} cur={cur} openProduct={openProduct} />

      <section className="mt-5">`);

/* 3) إزالة شارة العدد */
const oldBadge = `            <div className="relative">
              <img src={p.image_url} alt={p.name_ar} loading="lazy" className="h-24 w-full rounded-[1rem] object-cover" />
              <span className="absolute top-1.5 left-1.5 rounded-full bg-[#26301C] px-2 py-0.5 text-[9.5px] font-black text-[#C9D3A8] shadow">
                {emoji === '🔥' ? \`أُبيع \${p.sold_qty}\` : \`\${p.order_count} طلبات\`}
              </span>
            </div>`;
if (!s.includes(oldBadge)) fail('badge');
s = s.replace(oldBadge, `            <img src={p.image_url} alt={p.name_ar} loading="lazy" className="h-24 w-full rounded-[1rem] object-cover" />`);

writeFileSync(f, s);
console.log('moved below categories, badge removed');
