// إضافة قسمي الأكثر مبيعًا/طلبًا + تأكيد تسجيل الخروج
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* 1) استيراد PopularProduct */
if (!s.includes('PopularProduct')) {
  s = s.replace(
    "import type { Ad, CartLine, Catalog, MyData, MyOrder, Product, Redemption, Session } from '../lib/types';",
    "import type { Ad, CartLine, Catalog, MyData, MyOrder, PopularProduct, Product, Redemption, Session } from '../lib/types';"
  );
}

/* 2) مكوّن الشريط */
const anchorCats = '/* ============================ فئات مميزة ============================ */';
if (!s.includes(anchorCats)) fail('cats anchor');
if (!s.includes('function PopularStrip')) {
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
}

/* 3) العرض في الرئيسية — المرساة الفعلية */
const anchorRender = `<FeaturedCategories catalog={catalog} cat={cat} setCat={(c) => { setCat(c); setQ(''); }} />`;
if (!s.includes(anchorRender)) fail('home render');
if (!s.includes('PopularStrip title="الأكثر مبيعًا"')) {
  s = s.replace(
    anchorRender,
    `<PopularStrip title="الأكثر مبيعًا" emoji="🔥" items={catalog?.best_sellers ?? []} cur={cur} openProduct={openProduct} />
      <PopularStrip title="الأكثر طلبًا" emoji="⭐" items={catalog?.most_ordered ?? []} cur={cur} openProduct={openProduct} />
      ${anchorRender}`
  );
}

/* 4) تأكيد تسجيل الخروج */
const oldLogout = `        <button onClick={onLogout}
          className="flex w-full items-center justify-between rounded-[1.4rem] bg-[#F1DCB0] p-4 transition active:scale-[.98]">`;
if (!s.includes(oldLogout)) fail('logout button');
const newLogout = `        <button onClick={() => setConfirmLogout(true)}
          className="flex w-full items-center justify-between rounded-[1.4rem] bg-[#F1DCB0] p-4 transition active:scale-[.98]">`;
s = s.replace(oldLogout, newLogout);

// نافذة التأكيد داخل AccountPage
const oldCodes = `      {showCodes && <MyCodes redemptions={redemptions} />}
    </div>
  );
}

let _navRef`;
if (!s.includes(oldCodes)) fail('account end');
const newCodes = `      {showCodes && <MyCodes redemptions={redemptions} />}

      {confirmLogout && (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-black/50 p-4 backdrop-blur-sm anim-fade" onClick={() => setConfirmLogout(false)}>
          <div className="w-full max-w-xs rounded-[2rem] bg-white p-6 text-center shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#F1DCB0] text-[#8A6A48]"><Icon name="logout" size={24} /></span>
            <h3 className="mt-3 text-base font-black text-[#26301C]">تسجيل الخروج؟</h3>
            <p className="mt-1 text-xs text-neutral-500">سيتم الخروج من حسابك على هذا الجهاز</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => { setConfirmLogout(false); onLogout(); }}
                className="rounded-full bg-[#C4482E] py-3 text-sm font-black text-white shadow-md active:scale-95">تأكيد</button>
              <button onClick={() => setConfirmLogout(false)}
                className="rounded-full bg-neutral-100 py-3 text-sm font-black text-neutral-600 active:scale-95">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

let _navRef`;
s = s.replace(oldCodes, newCodes);

// حالة التأكيد في AccountPage
const oldAccState = `  const [showCodes, setShowCodes] = useState(false);
  const c = myData?.customer ?? session.customer;`;
if (!s.includes(oldAccState)) fail('account state');
s = s.replace(oldAccState, `  const [showCodes, setShowCodes] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const c = myData?.customer ?? session.customer;`);

writeFileSync(f, s);
console.log('popular sections + logout confirmation added');
