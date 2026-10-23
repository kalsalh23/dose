// واجهات الزبون: سعر العرض (مشطوب + شارة) في كل البطاقات والسلة والواتساب + تصفح عروض الفئة من الإعلان
import { readFileSync, writeFileSync } from 'node:fs';
const cf = 'src/customer/CustomerApp.tsx';
let t = readFileSync(cf, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING: ' + m); process.exit(1); };

// 1) مساعدات السعر الفعلي — بعد تعريف Fulfillment
const helperAnchor = `type Fulfillment = 'pickup' | 'delivery';`;
if (!t.includes(helperAnchor)) fail('helper anchor');
t = t.replace(helperAnchor, helperAnchor + `
/* السعر الفعلي: سعر العرض إن وُجد وأقل من الأصلي */
const effPrice = (p: { price_cents: number; sale_price_cents?: number | null }) =>
  p.sale_price_cents != null && p.sale_price_cents < p.price_cents ? p.sale_price_cents : p.price_cents;
const hasOffer = (p: { price_cents: number; sale_price_cents?: number | null }) =>
  p.sale_price_cents != null && p.sale_price_cents < p.price_cents;`);

// 2) شريط الأكثر طلبًا (PopularStrip) — سعر فعلي + شارة
const psOld = `            <p className="px-1 pb-0.5 text-[12px] font-black text-[#5C6B3C]">{eur(p.price_cents, cur)}</p>`;
if (!t.includes(psOld)) fail('popular price');
t = t.replace(psOld, `            <p className="px-1 pb-0.5 text-[12px] font-black text-[#5C6B3C]">
              {hasOffer(p) ? <><span className="me-1 rounded-full bg-[#C4482E] px-1.5 py-0.5 text-[8px] font-black text-white">عرض</span>{eur(effPrice(p), cur)} <span className="text-[10px] font-bold text-neutral-400 line-through">{eur(p.price_cents, cur)}</span></> : eur(p.price_cents, cur)}
            </p>`);

// 3) الأكثر طلبًا — الشارة تنقل لليسار، وعرض يأخذ اليمين، وسعر فعلي
const moOld = `                <div className="relative">
                  <img src={p.image_url} alt={p.name_ar} loading="lazy" className="h-24 w-full rounded-[1rem] object-cover" />
                  <span className="absolute top-1.5 right-1.5 rounded-full bg-[#26301C] px-2 py-0.5 text-[8.5px] font-black text-[#C9D3A8] shadow">الأكثر طلبًا</span>
                </div>
                <h3 className="mt-1.5 truncate text-[13px] font-extrabold text-[#26301C]">{p.name_ar}</h3>
                <p className="truncate text-[9.5px] font-semibold uppercase tracking-wide text-[#94826A]">{p.name_en}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[13px] font-black text-[#26301C]">{eur(p.price_cents, cur)}</span>
                  <span className="grid size-7 place-items-center rounded-full bg-[#C9D3A8] text-[#26301C]"><Icon name="plus" size={13} strokeWidth={3} /></span>
                </div>`;
if (!t.includes(moOld)) fail('most-ordered card');
t = t.replace(moOld, `                <div className="relative">
                  <img src={p.image_url} alt={p.name_ar} loading="lazy" className="h-24 w-full rounded-[1rem] object-cover" />
                  <span className="absolute top-1.5 left-1.5 rounded-full bg-[#26301C] px-2 py-0.5 text-[8.5px] font-black text-[#C9D3A8] shadow">الأكثر طلبًا</span>
                  {hasOffer(p) && <span className="absolute top-1.5 right-1.5 rounded-full bg-[#C4482E] px-2 py-0.5 text-[8.5px] font-black text-white shadow">عرض</span>}
                </div>
                <h3 className="mt-1.5 truncate text-[13px] font-extrabold text-[#26301C]">{p.name_ar}</h3>
                <p className="truncate text-[9.5px] font-semibold uppercase tracking-wide text-[#94826A]">{p.name_en}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[13px] font-black text-[#26301C]">
                    {hasOffer(p) ? <><span className="text-neutral-400 line-through">{eur(p.price_cents, cur)}</span> {eur(effPrice(p), cur)}</> : eur(p.price_cents, cur)}
                  </span>
                  <span className="grid size-7 place-items-center rounded-full bg-[#C9D3A8] text-[#26301C]"><Icon name="plus" size={13} strokeWidth={3} /></span>
                </div>`);

// 4) شبكة المنيو — شارة عرض (يمين) مع نفذت الكمية عموديًا + سعر فعلي
const menuOld = `              <div className="relative">
                <img src={p.image_url} alt={p.name_ar} loading="lazy" className={\`h-28 w-full rounded-[1.3rem] object-cover \${p.is_available === false ? 'opacity-50 grayscale' : ''}\`} />
                {p.is_available === false && (
                  <span className="absolute top-1.5 right-1.5 rounded-full bg-[#C4482E] px-2.5 py-1 text-[9px] font-black text-white shadow">نفذت الكمية</span>
                )}
              </div>
              <div className="flex items-end justify-between px-1 pb-0.5 pt-2.5">
                <div className="min-w-0">
                  <h3 className="truncate text-[13px] font-extrabold text-[#26301C]">{p.name_ar}</h3>
                  <p className="mt-0.5 text-[13px] font-black text-[#26301C]">{eur(p.price_cents, cur)}</p>
                </div>
                <span className="grid size-9 flex-none place-items-center rounded-full bg-white shadow-md">
                  <Icon name="plus" size={15} className="text-[#26301C]" />
                </span>
              </div>`;
if (!t.includes(menuOld)) fail('menu card');
t = t.replace(menuOld, `              <div className="relative">
                <img src={p.image_url} alt={p.name_ar} loading="lazy" className={\`h-28 w-full rounded-[1.3rem] object-cover \${p.is_available === false ? 'opacity-50 grayscale' : ''}\`} />
                <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1">
                  {p.is_available === false && (
                    <span className="rounded-full bg-[#C4482E] px-2.5 py-1 text-[9px] font-black text-white shadow">نفذت الكمية</span>
                  )}
                  {hasOffer(p) && (
                    <span className="rounded-full bg-[#C4482E] px-2.5 py-1 text-[9px] font-black text-white shadow">عرض</span>
                  )}
                </div>
              </div>
              <div className="flex items-end justify-between px-1 pb-0.5 pt-2.5">
                <div className="min-w-0">
                  <h3 className="truncate text-[13px] font-extrabold text-[#26301C]">{p.name_ar}</h3>
                  <p className="mt-0.5 text-[13px] font-black text-[#26301C]">
                    {hasOffer(p) ? <><span className="text-[11px] font-bold text-neutral-400 line-through">{eur(p.price_cents, cur)}</span> {eur(effPrice(p), cur)}</> : eur(p.price_cents, cur)}
                  </p>
                </div>
                <span className="grid size-9 flex-none place-items-center rounded-full bg-white shadow-md">
                  <Icon name="plus" size={15} className="text-[#26301C]" />
                </span>
              </div>`);

// 5) بطاقة تفاصيل المنتج — شارة عرض + السعر الفعلي بجانب القديم
const sheetOld = `        <span className="absolute bottom-5 left-5 rounded-full bg-[#C9D3A8] px-5 py-2.5 text-xl font-black shadow-xl" style={{ color: '#26301C' }}>
          {eur(product.price_cents, cur)}
        </span>`;
if (!t.includes(sheetOld)) fail('sheet price');
t = t.replace(sheetOld, `        <div className="absolute bottom-5 left-5 flex items-center gap-2">
          {hasOffer(product) && <span className="rounded-full bg-[#C4482E] px-3 py-1.5 text-[11px] font-black text-white shadow-lg">عرض</span>}
          <span className="rounded-full bg-[#C9D3A8] px-5 py-2.5 text-xl font-black shadow-xl" style={{ color: '#26301C' }}>
            {hasOffer(product)
              ? <><span className="text-sm font-bold text-[#414D36] line-through">{eur(product.price_cents, cur)}</span> {eur(effPrice(product), cur)}</>
              : eur(product.price_cents, cur)}
          </span>
        </div>`);

// 6) السلة: الإجمالي وبنود السطر بالسعر الفعلي
const cartOld = `  const total = lines.reduce((a, l) => a + l.product.price_cents * l.qty, 0);`;
if (!t.includes(cartOld)) fail('cart total');
t = t.replace(cartOld, `  const total = lines.reduce((a, l) => a + effPrice(l.product) * l.qty, 0);`);
const lineOld = `            <p className="mt-1 text-sm font-black text-[#26301C]">{eur(l.product.price_cents * l.qty, cur)}</p>`;
if (!t.includes(lineOld)) fail('cart line');
t = t.replace(lineOld, `            <p className="mt-1 text-sm font-black text-[#26301C]">
              {hasOffer(l.product) ? <><span className="text-xs font-bold text-neutral-400 line-through">{eur(l.product.price_cents * l.qty, cur)}</span> {eur(effPrice(l.product) * l.qty, cur)}</> : eur(effPrice(l.product) * l.qty, cur)}
            </p>`);

// 7) المفضلة
const favOld = `              <span className="mt-0.5 block text-sm font-black text-[#5C6B3C]">{eur(p.price_cents)}</span>`;
if (!t.includes(favOld)) fail('fav price');
t = t.replace(favOld, `              <span className="mt-0.5 block text-sm font-black text-[#5C6B3C]">
                {hasOffer(p) ? <><span className="text-[11px] font-bold text-neutral-400 line-through">{eur(p.price_cents)}</span> {eur(effPrice(p))}</> : eur(p.price_cents)}
              </span>`);

// 8) المبلغ المشمول بالخصم + واتساب + إجمالي المراجعة
t = t.replace(/l\.product\.price_cents \* l\.qty/g, 'effPrice(l.product) * l.qty');
const waOld = `        items: flow.lines.map((l) => ({ name: l.product.name_ar, qty: l.qty, unitPriceCents: l.product.price_cents, options: (l.options || []).join('، ') })),`;
if (!t.includes(waOld)) fail('whatsapp items');
t = t.replace(waOld, `        items: flow.lines.map((l) => ({ name: l.product.name_ar, qty: l.qty, unitPriceCents: effPrice(l.product), options: (l.options || []).join('، ') })),`);

// 9) MidAd: زر تصفح عروض الفئة
const midSigOld = `function MidAd({ ad, cur, onClose }: { ad: Ad; cur: string; onClose: () => void }) {`;
if (!t.includes(midSigOld)) fail('midad sig');
t = t.replace(midSigOld, `function MidAd({ ad, cur, onClose, onBrowse }: { ad: Ad; cur: string; onClose: () => void; onBrowse?: (slug: string) => void }) {`);
const midCtaOld = `          <button onClick={onClose}
            className="mt-4 w-full rounded-full bg-gradient-to-l from-[#C9D3A8] to-[#A9B87F] py-3.5 text-base font-black text-[#26301C] shadow-lg shadow-[#8a6a48]/30 transition active:scale-[.98]">
            اطلب الآن
          </button>`;
if (!t.includes(midCtaOld)) fail('midad cta');
t = t.replace(midCtaOld, `          <button onClick={() => (onBrowse && ad.category_slug ? onBrowse(ad.category_slug) : onClose())}
            className="mt-4 w-full rounded-full bg-gradient-to-l from-[#C9D3A8] to-[#A9B87F] py-3.5 text-base font-black text-[#26301C] shadow-lg shadow-[#8a6a48]/30 transition active:scale-[.98]">
            {ad.category_slug ? 'تصفح عروض الفئة 🏷️' : 'اطلب الآن'}
          </button>`);

// 10) رفع حالة الفئة إلى App + تمريرها لـ Home و MidAd
const homeSigOld = `function Home({ catalog, openProduct, ads, onOpenAd }: { catalog: Catalog | null; openProduct: (p: Product) => void; ads: Ad[]; onOpenAd: (a: Ad) => void }) {
  const [cat, setCat] = useState('all');`;
if (!t.includes(homeSigOld)) fail('home sig');
t = t.replace(homeSigOld, `function Home({ catalog, openProduct, ads, onOpenAd, selectedCat, onSelectCat }: { catalog: Catalog | null; openProduct: (p: Product) => void; ads: Ad[]; onOpenAd: (a: Ad) => void; selectedCat: string; onSelectCat: (s: string) => void }) {
  const cat = selectedCat;
  const setCat = onSelectCat;`);

const appCatOld = `  const [closedOpen, setClosedOpen] = useState(false);`;
if (!t.includes(appCatOld)) fail('app cat anchor');
t = t.replace(appCatOld, appCatOld + `
  const [selectedCat, setSelectedCat] = useState('all');`);

const routeOld = `          <Route path="/" element={<Home catalog={catalog} openProduct={setProduct} ads={heroAds} onOpenAd={(a) => setAdOpen(a)} />} />`;
if (!t.includes(routeOld)) fail('home route');
t = t.replace(routeOld, `          <Route path="/" element={<Home catalog={catalog} openProduct={setProduct} ads={heroAds} onOpenAd={(a) => setAdOpen(a)} selectedCat={selectedCat} onSelectCat={setSelectedCat} />} />`);

const midRenderOld = `{welcomeDone && fsAd && !splashDone && midAdDue && <MidAd ad={fsAd} cur={cur} onClose={() => setSplashDone(true)} />}`;
if (!t.includes(midRenderOld)) fail('midad render');
t = t.replace(midRenderOld, `{welcomeDone && fsAd && !splashDone && midAdDue && (
        <MidAd ad={fsAd} cur={cur} onClose={() => setSplashDone(true)}
          onBrowse={(slug) => { setSplashDone(true); setSelectedCat(slug); nav('/'); setTimeout(() => document.getElementById('menu-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400); }} />
      )}`);

// 11) نافذة الإعلان المنبثقة: زر التصفح ينقل لفئة الإعلان
const adBtnOld = `              <button onClick={() => { setAdOpen(null); nav('/'); }} className="mt-4 w-fit px-10 rounded-full bg-[#C9D3A8] py-3 text-sm font-black text-[#26301C] shadow-md active:scale-95">تصفح القائمة</button>`;
if (!t.includes(adBtnOld)) fail('ad modal cta');
t = t.replace(adBtnOld, `              <button onClick={() => { setAdOpen(null); if (adOpen.category_slug) setSelectedCat(adOpen.category_slug); nav('/'); if (adOpen.category_slug) setTimeout(() => document.getElementById('menu-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400); }} className="mt-4 w-fit px-10 rounded-full bg-[#C9D3A8] py-3 text-sm font-black text-[#26301C] shadow-md active:scale-95">{adOpen.category_slug ? 'تصفح عروض الفئة 🏷️' : 'تصفح القائمة'}</button>`);

writeFileSync(cf, t);
console.log('customer offers patched');
