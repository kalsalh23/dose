// قسما الأكثر مبيعًا والأكثر طلبًا في الرئيسية (شريط أفقي ببطاقات مدمجة)
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* 1) النوع: إضافة الحقلين للكتالوج */
const oldType = `export interface Catalog {
  categories: Category[]; products: Product[]; rewards: Reward[]; ads: Ad[];
  settings: Record<string, string>;
}`;
const cf = 'src/lib/types.ts';
let t = readFileSync(cf, 'utf8').replace(/\r\n/g, '\n');
if (t.includes(oldType)) {
  t = t.replace(oldType, `export interface PopularProduct { id: number; name_ar: string; name_en: string; price_cents: number; points: number; image_url: string; sold_qty?: number; order_count?: number }
export interface Catalog {
  categories: Category[]; products: Product[]; rewards: Reward[]; ads: Ad[];
  best_sellers?: PopularProduct[]; most_ordered?: PopularProduct[];
  settings: Record<string, string>;
}`);
  writeFileSync(cf, t);
  console.log('types updated');
} else { console.log('types pattern differs — checking…'); }

/* 2) الأنواع في CustomerApp: استيراد PopularProduct */
if (!s.includes('PopularProduct')) {
  s = s.replace(
    "import type { Ad, CartLine, Catalog, MyData, MyOrder, Product, Redemption, Session } from '../lib/types';",
    "import type { Ad, CartLine, Catalog, MyData, MyOrder, PopularProduct, Product, Redemption, Session } from '../lib/types';"
  );
}

/* 3) مكون شريط المنتجات الشائعة */
const anchorCats = '/* ============================ فئات مميزة ============================ */';
if (!s.includes(anchorCats)) fail('cats anchor');
const popularComp = `/* ============================ الأكثر مبيعًا وطلبًا ============================ */
function PopularStrip({ title, emoji, items, cur, openProduct }: {
  title: string; emoji: string; items: PopularProduct[]; cur: string; openProduct: (p: Product) => void;
}) {
  if (!items || items.length === 0) return null;
  return (
    <section className="mt-5">
      <h2 className="mb-3 flex items-center gap-2 text-[17px] font-black text-[#26301C]">
        <span>{emoji}</span> {title}
      </h2>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {items.map((p, i) => (
          <button key={p.id} onClick={() => openProduct(p as unknown as Product)}
            className="w-36 flex-none rounded-[1.4rem] bg-[#F1DCB0] p-2 text-right shadow-sm shadow-[#8a6a48]/15 transition hover:-translate-y-1 anim-rise"
            style={{ animationDelay: \`\${i * 35}ms\` }}>
            <div className="relative">
              <img src={p.image_url} alt={p.name_ar} loading="lazy" className="h-24 w-full rounded-[1rem] object-cover" />
              <span className="absolute top-1.5 left-1.5 rounded-full bg-[#26301C] px-2 py-0.5 text-[9.5px] font-black text-[#C9D3A8] shadow">
                {emoji === '🔥' ? \`أُبيع \${p.sold_qty}\` : \`\${p.order_count} طلبات\`}
              </span>
            </div>
            <h3 className="mt-1.5 truncate px-1 text-[12px] font-extrabold text-[#26301C]">{p.name_ar}</h3>
            <p className="px-1 pb-0.5 text-[12px] font-black text-[#5C6B3C]">{eur(p.price_cents, cur)}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

`;
s = s.replace(anchorCats, popularComp + anchorCats);

/* 4) عرض القسمين في الرئيسية قبل الفئات */
const oldHome = `  return (
    <div className="anim-rise">
      <FeaturedCategories catalog={catalog} cat={cat} setCat={setCat} />`;
if (!s.includes(oldHome)) fail('home render');
const newHome = `  return (
    <div className="anim-rise">
      <PopularStrip title="الأكثر مبيعًا" emoji="🔥" items={catalog?.best_sellers ?? []} cur={cur} openProduct={openProduct} />
      <PopularStrip title="الأكثر طلبًا" emoji="⭐" items={catalog?.most_ordered ?? []} cur={cur} openProduct={openProduct} />
      <FeaturedCategories catalog={catalog} cat={cat} setCat={setCat} />`;
s = s.replace(oldHome, newHome);

writeFileSync(f, s);
console.log('popular sections added to home');
