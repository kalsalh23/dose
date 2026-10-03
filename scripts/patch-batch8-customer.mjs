import { readFileSync, writeFileSync } from 'node:fs';
const fail = (m) => { console.error('MISSING: ' + m); process.exit(1); };

/* ===== utils.ts: تاريخ رقمي + حالة جاري التوصيل ===== */
const uf = 'src/lib/utils.ts';
let u = readFileSync(uf, 'utf8').replace(/\r\n/g, '\n');
if (!u.includes('fmtDateTimeNum')) {
  const a = `export const fmtDateTime = (iso: string) =>`;
  if (!u.includes(a)) fail('utils fmtDateTime anchor');
  u = u.replace(a, `export const fmtDateTimeNum = (iso: string) => {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return \`\${d.getDate()}/\${d.getMonth() + 1}/\${d.getFullYear()} · \${hh}:\${mm}\`;
};

export const fmtDateTime = (iso: string) =>`);
  u = u.replace(`  ready: { label: 'جاهز', color: 'bg-emerald-100 text-emerald-800' },`,
    `  ready: { label: 'جاهز', color: 'bg-emerald-100 text-emerald-800' },
  out_for_delivery: { label: 'جاري التوصيل', color: 'bg-indigo-100 text-indigo-800' },`);
  writeFileSync(uf, u);
  console.log('utils patched');
}

/* ===== types.ts ===== */
const tf = 'src/lib/types.ts';
let ty = readFileSync(tf, 'utf8').replace(/\r\n/g, '\n');
if (!ty.includes('interface Addition')) {
  const a = `export interface Reward { id: number; name_ar: string; name_en: string; image_url: string; points_cost: number; sort_order: number }`;
  if (!ty.includes(a)) fail('types reward anchor');
  ty = ty.replace(a, a + `
export interface Addition { id: number; name_ar: string; price_cents: number; product_ids: number[] }
export interface PickedAddition { id: number; name_ar: string; price_cents: number }`);
  ty = ty.replace(`  best_sellers?: PopularProduct[]; most_ordered?: PopularProduct[];`,
    `  best_sellers?: PopularProduct[]; most_ordered?: PopularProduct[]; additions?: Addition[];`);
  ty = ty.replace(`export interface CartLine { product: Product; qty: number; options?: string[] }`,
    `export interface CartLine { product: Product; qty: number; options?: string[]; additions?: PickedAddition[] }`);
  ty = ty.replace(`export interface Redemption { code: string; reward_name: string; points_cost: number; status: 'unused' | 'used' | 'expired'; created_at: string }`,
    `export interface Redemption { code: string; reward_name: string; points_cost: number; status: 'unused' | 'used' | 'expired'; created_at: string; expires_at?: string | null }`);
  writeFileSync(tf, ty);
  console.log('types patched');
}

/* ===== CustomerApp.tsx ===== */
const f = 'src/customer/CustomerApp.tsx';
let t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

/* 1) الإعلان المنبثق فقط — لا يظهر في الهيرو + 20 ثانية */
t = t.replace(`  const heroAds = useMemo(() => ads.filter((ad) => ad.show_in_hero !== false), [catalog]);`,
  `  const heroAds = useMemo(() => ads.filter((ad) => ad.show_in_hero !== false && !ad.full_screen), [catalog]);`);
t = t.replace(`const t = setInterval(() => setP(Math.min(1, (Date.now() - start) / 30000)), 80);`, `const t = setInterval(() => setP(Math.min(1, (Date.now() - start) / 20000)), 80);`);
t = t.replace(`const end = setTimeout(onClose, 30000);`, `const end = setTimeout(onClose, 20000);`);
t = t.replace(`يُغلق تلقائيًا بعد 30 ثانية`, `يُغلق تلقائيًا بعد 20 ثانية`);

/* 2) حالة جاري التوصيل في التطبيق */
const siOld = `    ready: { label: 'جاهز', color: 'bg-emerald-100 text-emerald-800' },`;
if (!t.includes(siOld)) fail('statusInfo anchor');
t = t.replace(siOld, siOld + `
    out_for_delivery: { label: 'جاري التوصيل', color: 'bg-indigo-100 text-indigo-800' },`);
t = t.replace(`completed: { label: 'مكتمل', color: 'bg-green-100 text-green-700' },`, `completed: { label: 'تم التسليم', color: 'bg-green-100 text-green-700' },`);

/* 3) صفحة أكواد مخصصة + إزالة العرض أسفل الحساب */
t = t.replace(`    { to: '/rewards', icon: 'star', label: 'النقاط' },`,
  `    { to: '/rewards', icon: 'star', label: 'النقاط' },
    { to: '/codes', icon: 'gift', label: 'المكافآت' },`);
const routeOld = `          <Route path="/rewards" element={<RewardsPage catalog={catalog} myData={myData} session={session} onRedeem={redeem} />} />`;
if (!t.includes(routeOld)) fail('rewards route');
t = t.replace(routeOld, routeOld + `
          <Route path="/codes" element={<CodesPage myData={myData} session={session} />} />`);
const accRowOld = `        <AccountRow icon="gift" label="المكافأة" onClick={() => setShowCodes(true)} badge={redemptions.filter((r) => r.status === 'unused').length || undefined} />\n`;
if (!t.includes(accRowOld)) fail('account row');
t = t.replace(accRowOld, '');
t = t.replace(`      {showCodes && <MyCodes redemptions={redemptions} />}\n`, '');
t = t.replace(`  const [showCodes, setShowCodes] = `, `  const [showCodesUnused, setShowCodesUnused] = `);
// صفحة الأكواد المخصصة قبل MyCodes
const mc = `function MyCodes({ redemptions }: { redemptions: Redemption[] }) {`;
if (!t.includes(mc)) fail('mycodes anchor');
t = t.replace(mc, `function CodesPage({ myData, session }: { myData: MyData | null; session: Session | null }) {
  if (!session) return <NeedLogin />;
  return (
    <div className="anim-rise">
      <MyCodes redemptions={myData?.redemptions ?? []} />
    </div>
  );
}

${mc}`);
/* 4) انتهاء الصلاحية تحت كل كود (10 أيام) */
const codeOld = `              <p className={\`mt-1 text-[10px] font-extrabold \${r.status === 'unused' ? 'text-[#6B7A45]' : 'text-[#7C8665]'}\`}>
                {r.status === 'unused' ? 'غير مستخدم' : r.status === 'used' ? 'مستخدم' : 'منتهي'}
              </p>`;
if (!t.includes(codeOld)) fail('code status line');
t = t.replace(codeOld, `              <p className={\`mt-1 text-[10px] font-extrabold \${r.status === 'unused' ? 'text-[#6B7A45]' : 'text-[#7C8665]'}\`}>
                {r.status === 'unused' ? 'غير مستخدم' : r.status === 'used' ? 'مستخدم' : 'منتهي'}
              </p>
              {r.status === 'unused' && r.expires_at && <p className="mt-0.5 text-[9.5px] font-bold text-[#A05B47]">صالحة حتى {fmtDateNum(r.expires_at)}</p>}`);

/* 5) الطلبات: تاريخ رقمي + الوقت التقديري */
t = t.replace(`              {o.fulfillment_type === 'delivery' ? 'توصيل' : 'استلام'} · {fmtDateTime(o.created_at)}`,
  `              {o.fulfillment_type === 'delivery' ? 'توصيل' : 'استلام'} · {fmtDateTimeNum(o.created_at)}`);
const etaCust = `            {['pending', 'preparing', 'ready', 'out_for_delivery'].includes(o.status) && (
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold text-[#5C6B3C] shadow-sm">⏱️ {o.fulfillment_type === 'delivery' ? 'يوصلك خلال 15-20 دقيقة' : 'جاهز خلال 5-10 دقائق'}</span>
            )}`;
const ordCardTail = `              <Icon name={o.fulfillment_type === 'delivery' ? 'pin' : 'home'} size={12} />
              {o.fulfillment_type === 'delivery' ? 'توصيل' : 'استلام'} · {fmtDateTimeNum(o.created_at)}
            </span>`;
if (!t.includes(ordCardTail)) fail('order card tail');
t = t.replace(ordCardTail, ordCardTail + `
            {['pending', 'preparing', 'ready', 'out_for_delivery'].includes(o.status) && (
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold text-[#5C6B3C] shadow-sm">⏱️ {o.fulfillment_type === 'delivery' ? 'يوصلك خلال 15-20 دقيقة' : 'جاهز خلال 5-10 دقائق'}</span>
            )}`);

/* 6) نافذة الاسم والهاتف قبل الاستلام */
t = t.replace(`interface OrderFlow { step: 'fulfillment' | 'location' | 'pin' | 'promo' | 'review' | null; lines: CartLine[]; fulfillment?: Fulfillment; loc?: { lat: number; lng: number; mapUrl: string }; pin?: string; usePromo?: boolean }`,
  `interface OrderFlow { step: 'contact' | 'fulfillment' | 'location' | 'pin' | 'promo' | 'review' | null; lines: CartLine[]; fulfillment?: Fulfillment; loc?: { lat: number; lng: number; mapUrl: string }; pin?: string; usePromo?: boolean; name?: string; phone?: string }`);
t = t.replace(`    if (shopStatus(catalog?.settings).closed) { setClosedOpen(true); return; }
    if (lines.some((l) => l.product.is_available === false)) { show('نفذت كمية أحد منتجات سلتك — احذفه وأكمل طلبك', 'err'); return; }
    if (!session) { nav('/login'); show('سجّل دخولك أولًا لإتمام الطلب'); return; }
    setFlow({ step: 'fulfillment', lines });`,
  `    if (shopStatus(catalog?.settings).closed) { setClosedOpen(true); return; }
    if (lines.some((l) => l.product.is_available === false)) { show('نفذت كمية أحد منتجات سلتك — احذفه وأكمل طلبك', 'err'); return; }
    if (!session) { nav('/login'); show('سجّل دخولك أولًا لإتمام الطلب'); return; }
    setFlow({ step: 'contact', lines });`);
t = t.replace(`      {flow.step === 'fulfillment' && (`,
  `      {flow.step === 'contact' && (
        <ContactModal
          initial={{ name: flow.name ?? session?.customer?.full_name ?? '', phone: flow.phone ?? session?.customer?.phone ?? '' }}
          onClose={() => setFlow({ step: null, lines: [] })}
          onDone={(name, phone) => setFlow((st) => ({ ...st, step: 'fulfillment', name, phone }))} />
      )}
      {flow.step === 'fulfillment' && (`);
const cm = `/* ============================ نافذة المحل مغلق ============================ */`;
if (!t.includes(cm)) fail('closed modal marker');
t = t.replace(cm, `/* ============================ نافذة الاسم والهاتف — قبل اختيار الاستلام ============================ */
function ContactModal({ initial, onClose, onDone }: { initial: { name: string; phone: string }; onClose: () => void; onDone: (name: string, phone: string) => void }) {
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [err, setErr] = useState('');
  const go = () => {
    const p = phone.replace(/\\D/g, '');
    if (name.trim().length < 2) { setErr('أدخل اسمك أولًا'); return; }
    if (p.length < 9 || p.length > 12) { setErr('أدخل رقم هاتف صحيح (9 أرقام على الأقل)'); return; }
    onDone(name.trim(), p);
  };
  return (
    <div className="fixed inset-0 z-[115] grid place-items-center bg-black/55 p-4 backdrop-blur-sm anim-fade" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[2rem] bg-[#FFF9EC] p-6 shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#26301C] text-[#C9D3A8]"><Icon name="user" size={24} /></span>
        <h3 className="mt-3 text-center text-lg font-black text-[#26301C]">معلومات الطلب</h3>
        <p className="mt-1 text-center text-[11px] font-bold text-[#7C8665]">اسمك ورقم هاتفك يُرسلان مع الطلب ليوصلك بسرعة</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-extrabold text-[#5C6B3C]">الاسم</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك الكامل"
              className="h-12 w-full rounded-2xl border-2 border-[#D5DEB4] bg-white px-4 text-sm font-bold text-[#26301C] outline-none focus:border-[#7C8F52]" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-extrabold text-[#5C6B3C]">رقم الهاتف</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\\d+\\s]/g, ''))} inputMode="tel" dir="ltr" placeholder="09XXXXXXXX"
              className="h-12 w-full rounded-2xl border-2 border-[#D5DEB4] bg-white px-4 text-sm font-bold text-[#26301C] outline-none focus:border-[#7C8F52]" />
          </div>
          {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-extrabold text-red-600">{err}</p>}
          <button onClick={go} className="w-full rounded-full bg-gradient-to-l from-[#C9D3A8] to-[#A9B87F] py-3.5 text-base font-black text-[#26301C] shadow-lg shadow-[#8a6a48]/30 transition active:scale-[.98]">متابعة الطلب</button>
          <button onClick={onClose} className="w-full rounded-2xl py-2 text-sm font-bold text-neutral-500">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

${cm}`);

/* 7) الإضافات: أداة السعر الفعلي للسطر + واجهة الاختيار + الإرسال */
const helperAnchor = `const hasOffer = (p: { price_cents: number; sale_price_cents?: number | null }) =>
  p.sale_price_cents != null && p.sale_price_cents < p.price_cents;`;
if (!t.includes(helperAnchor)) fail('helper anchor');
t = t.replace(helperAnchor, helperAnchor + `
const lineUnit = (l: CartLine) => effPrice(l.product) + (l.additions ?? []).reduce((a, x) => a + x.price_cents, 0);`);
t = t.replace(/effPrice\(l\.product\) \* l\.qty/g, 'lineUnit(l) * l.qty');

/* ProductSheet: شرائح الإضافات */
const psigOld = `function ProductSheet({ product, catalog, onClose, onAdd, onOrderNow, isFav, onToggleFav }: {`;
if (!t.includes(psigOld)) fail('sheet sig');
t = t.replace(psigOld, psigOld.replace('{ product, catalog, onClose, onAdd, onOrderNow, isFav, onToggleFav }', '{ product, catalog, onClose, onAdd, onOrderNow, isFav, onToggleFav }'));
const qtyState = `  const [qty, setQty] = useState(1);
  const [opts, setOpts] = useState<string[]>([]);`;
if (!t.includes(qtyState)) fail('sheet states');
t = t.replace(qtyState, qtyState + `
  const prodAdds = (catalog?.additions ?? []).filter((a) => (a.product_ids ?? []).includes(product.id));
  const [addIds, setAddIds] = useState<number[]>([]);
  const pickedAdds = prodAdds.filter((a) => addIds.includes(a.id));
  const lineTotal = effPrice(product) + pickedAdds.reduce((a, x) => a + x.price_cents, 0);`);
const sheetPriceOld = `          <span className="rounded-full bg-[#C9D3A8] px-5 py-2.5 text-xl font-black shadow-xl" style={{ color: '#26301C' }}>
            {hasOffer(product)
              ? <><span className="text-sm font-bold text-[#414D36] line-through">{eur(product.price_cents, cur)}</span> {eur(effPrice(product), cur)}</>
              : eur(product.price_cents, cur)}
          </span>`;
if (!t.includes(sheetPriceOld)) fail('sheet price');
t = t.replace(sheetPriceOld, `          <span className="rounded-full bg-[#C9D3A8] px-5 py-2.5 text-xl font-black shadow-xl" style={{ color: '#26301C' }}>
            {hasOffer(product)
              ? <><span className="text-sm font-bold text-[#414D36] line-through">{eur(product.price_cents, cur)}</span> {eur(lineTotal, cur)}</>
              : eur(lineTotal, cur)}
          </span>`);
const optsBlockEnd = `        <div className="mt-5 rounded-[1.4rem] p-4" style={{ background: '#EEF2DC' }}>
          <p className="text-[11px] font-extrabold text-[#5C6B3C]">الوصف</p>`;
if (!t.includes(optsBlockEnd)) fail('description block');
t = t.replace(optsBlockEnd, `        {prodAdds.length > 0 && (
          <div className="mt-5">
            <h3 className="text-[15px] font-black text-[#26301C]">أضف عليها 🍯</h3>
            <p className="mt-0.5 text-[11px] font-bold text-[#7C8665]">اختياري — تُضاف قيمتها على السعر</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {prodAdds.map((a) => {
                const on = addIds.includes(a.id);
                return (
                  <button key={a.id} onClick={() => setAddIds((ids) => (on ? ids.filter((x) => x !== a.id) : [...ids, a.id]))}
                    className={\`flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-[13px] font-extrabold transition active:scale-95 \${
                      on ? 'border-[#5C6B3C] bg-[#C9D3A8]/40 text-[#26301C]' : 'border-[#D5DEB4] bg-[#EEF2DC] text-[#6B7357]'
                    }\`}>
                    {on && <Icon name="check" size={13} strokeWidth={2.6} />}
                    {a.name_ar} <span className="text-[11px] font-black text-[#7A5A22]">+{eur(a.price_cents, cur)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-5 rounded-[1.4rem] p-4" style={{ background: '#EEF2DC' }}>
          <p className="text-[11px] font-extrabold text-[#5C6B3C]">الوصف</p>`);
t = t.replace(`onAdd({ product, qty, options: opts })`, `onAdd({ product, qty, options: opts, additions: pickedAdds.map((a) => ({ id: a.id, name_ar: a.name_ar, price_cents: a.price_cents })) })`);
t = t.replace(`onOrderNow({ product, qty, options: opts })`, `onOrderNow({ product, qty, options: opts, additions: pickedAdds.map((a) => ({ id: a.id, name_ar: a.name_ar, price_cents: a.price_cents })) })`);

/* CartPage: أسماء الإضافات */
const cartLineOld = `            {(l.options || []).length > 0 && <p className="mt-0.5 truncate text-[10.5px] font-bold text-[#5C6B3C]">✓ {l.options.join('، ')}</p>}`;
if (!t.includes(cartLineOld)) fail('cart line options');
t = t.replace(cartLineOld, cartLineOld + `
            {(l.additions ?? []).length > 0 && <p className="mt-0.5 truncate text-[10.5px] font-bold text-[#7A5A22]">🍯 {(l.additions ?? []).map((a) => a.name_ar).join('، ')}</p>}`);

/* confirmWhatsApp: الإضافات + الاسم/الهاتف */
const waOld = `        p_items: flow.lines.map((l) => ({ product_id: l.product.id, qty: l.qty, options: (l.options || []).join('، ') })),
        p_latitude: flow.loc?.lat ?? null, p_longitude: flow.loc?.lng ?? null, p_map_url: flow.loc?.mapUrl ?? null,
        p_source: 'customer',
        p_reward_code: flow.usePromo && promoCode ? promoCode : null,`;
if (!t.includes(waOld)) fail('create_order call');
t = t.replace(waOld, `        p_items: flow.lines.map((l) => ({
          product_id: l.product.id, qty: l.qty, options: (l.options || []).join('، '),
          additions: (l.additions ?? []).map((a) => a.id),
        })),
        p_latitude: flow.loc?.lat ?? null, p_longitude: flow.loc?.lng ?? null, p_map_url: flow.loc?.mapUrl ?? null,
        p_source: 'customer',
        p_reward_code: flow.usePromo && promoCode ? promoCode : null,
        p_customer_name: flow.name ?? null, p_customer_phone: flow.phone ?? null,`);
const waItemsOld = `        items: flow.lines.map((l) => ({ name: l.product.name_ar, qty: l.qty, unitPriceCents: effPrice(l.product), options: (l.options || []).join('، ') })),`;
if (!t.includes(waItemsOld)) fail('whatsapp items');
t = t.replace(waItemsOld, `        items: flow.lines.map((l) => ({
          name: l.product.name_ar, qty: l.qty, unitPriceCents: lineUnit(l),
          options: (l.options || []).concat((l.additions ?? []).map((a) => a.name_ar + ' +' + a.price_cents)).join('، '),
        })),
`);

writeFileSync(f, t);
console.log('customer batch8 patched');
