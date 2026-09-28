// الرئيسية بأسلوب coffeesir: هيرو + دوائر فئات + الأكثر طلبًا + استكشف المنيو (عرض الكل)
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

const start = s.indexOf('/* ============================ الرئيسية ============================ */');
const end = s.indexOf('/* ============================ تفاصيل المنتج');
if (start < 0 || end < 0 || end <= start) { console.error('Home bounds not found'); process.exit(1); }

const L = [];
L.push("/* ============================ الرئيسية ============================ */");
L.push("function Home({ catalog, openProduct }: { catalog: Catalog | null; openProduct: (p: Product) => void }) {");
L.push("  const [cat, setCat] = useState('all');");
L.push("  const [showAll, setShowAll] = useState(false);");
L.push("  const products = catalog?.products ?? [];");
L.push("  let shown = cat === 'all' ? products : products.filter((p) => p.category === cat);");
L.push("  const cur = catalog?.settings?.currency_symbol ?? 'ل.س';");
L.push("  const promoCode = catalog?.settings?.promo_code;");
L.push("  const promoDisc = catalog?.settings?.promo_discount;");
L.push("  const mostOrdered = catalog?.most_ordered ?? [];");
L.push("  const menuItems = showAll ? shown : shown.slice(0, 4);");
L.push("  const scrollToMenu = () => document.getElementById('menu-section')?.scrollIntoView({ behavior: 'smooth' });");
L.push('');
L.push('  return (');
L.push('    <div className="anim-rise">');
L.push('      {/* الهيرو */}');
L.push('      <div className="relative overflow-hidden rounded-[1.8rem] bg-gradient-to-bl from-[#414D36] to-[#26301C] p-5 text-white shadow-xl shadow-[#26301C]/40">');
L.push('        <div className="pointer-events-none absolute -bottom-16 -left-10 size-44 rounded-full bg-white/5 blur-2xl" />');
L.push('        <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-[#C9D3A8]">قهوة مختصة في كل رشفة</span>');
L.push('        <h2 className="mt-2.5 text-[22px] font-black leading-snug">قهوتك على ذوقك،<br />وحلويات تُدللها</h2>');
L.push('        <p className="mt-1.5 text-[11px] font-medium text-white/75">اطلب من القهوة والحلويات من المنيو واستمتع بجمع النقاط</p>');
L.push('        <div className="mt-4 flex items-end justify-between gap-2">');
L.push('          {promoCode && promoDisc ? (');
L.push('            <div className="rounded-xl border-2 border-dashed border-[#C9D3A8]/70 px-2.5 py-1.5 text-center">');
L.push('              <p className="text-[8.5px] font-bold text-[#C9D3A8]">كود خصم {promoDisc}%</p>');
L.push("              <p className='font-mono text-[13px] font-black tracking-widest' dir='ltr'>{promoCode}</p>");
L.push('            </div>');
L.push('          ) : <span />}');
L.push('          <button onClick={scrollToMenu}');
L.push("            className='flex items-center gap-1.5 rounded-full bg-[#C9D3A8] px-4 py-2.5 text-[13px] font-black text-[#26301C] shadow-lg transition active:scale-95'>");
L.push('            اطلب الآن <Icon name="plus" size={14} strokeWidth={3} />');
L.push('          </button>');
L.push('        </div>');
L.push('      </div>');
L.push('');
L.push('      {/* البحث */}');
L.push('      <div className="relative mt-4">');
L.push('        <Icon name="search" size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7C8665]" />');
L.push('        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن مشروب أو حلوى…"');
L.push('          className="h-12 w-full rounded-full border-2 border-[#D5DEB4] bg-white pr-11 pl-4 text-sm font-bold text-[#26301C] outline-none focus:border-[#7C8F52]" />');
L.push('        {q && <button onClick={() => setQ(\'\')} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7C8665]" aria-label="مسح"><Icon name="x" size={15} /></button>}');
L.push('      </div>');
L.push('');
L.push('      {/* الفئات — دوائر */}');
L.push('      <section className="mt-5">');
L.push('        <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1">');
L.push('          {items.map((c) => {');
L.push("            const active = cat === c.slug;");
L.push('            return (');
L.push('              <button key={c.slug} onClick={() => setCat(c.slug)} className="flex flex-none flex-col items-center gap-1.5 transition active:scale-95">');
L.push("                <span className={`grid size-[62px] place-items-center overflow-hidden rounded-full shadow-md shadow-[#8a6a48]/15 transition-all ${active ? 'ring-2 ring-[#5C6B3C] ring-offset-2 ring-offset-[#F6E7C9]' : 'ring-1 ring-[#EAD3A0]'}`}>");
L.push("                  {c.slug === 'all'");
L.push("                    ? <span className='grid size-full place-items-center bg-gradient-to-br from-[#414D36] to-[#26301C] text-[#C9D3A8]'><Icon name='package' size={20} /></span>");
L.push("                    : <img src={CAT_IMAGES[c.slug] ?? '/img/latte.jpg'} alt={c.name_ar} className='size-full object-cover' loading='lazy' />}");
L.push('                </span>');
L.push("                <span className={`text-[11px] font-extrabold ${active ? 'text-[#26301C]' : 'text-[#7C8665]'}`}>{c.name_ar}</span>");
L.push('              </button>');
L.push('            );');
L.push('          })}');
L.push('        </div>');
L.push('      </section>');
L.push('');
L.push('      {/* الأكثر طلبًا — بطاقات أفقية */}');
L.push('      {mostOrdered.length > 0 && (');
L.push('        <section className="mt-5">');
L.push('          <h2 className="mb-3 flex items-center gap-1.5 text-[17px] font-black text-[#26301C]">');
L.push("            <Icon name='star' size={15} filled className='text-[#B07C3A]' /> الأكثر طلبًا");
L.push('          </h2>');
L.push('          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">');
L.push('            {mostOrdered.map((p, i) => (');
L.push("              <button key={p.id} onClick={() => openProduct(p as unknown as Product)}");
L.push("                className='w-40 flex-none rounded-[1.4rem] bg-white p-2.5 text-right shadow-sm ring-1 ring-[#D5DEB4] transition hover:-translate-y-1 anim-rise'");
L.push("                style={{ animationDelay: `${i * 35}ms` }}>");
L.push('                <div className="relative">');
L.push('                  <img src={p.image_url} alt={p.name_ar} loading="lazy" className="h-24 w-full rounded-[1rem] object-cover" />');
L.push('                  <span className="absolute top-1.5 right-1.5 rounded-full bg-[#26301C] px-2 py-0.5 text-[8.5px] font-black text-[#C9D3A8] shadow">الأكثر طلبًا</span>');
L.push('                </div>');
L.push('                <h3 className="mt-1.5 truncate text-[13px] font-extrabold text-[#26301C]">{p.name_ar}</h3>');
L.push('                <p className="truncate text-[9.5px] font-semibold uppercase tracking-wide text-[#94826A]">{p.name_en}</p>');
L.push('                <div className="mt-1 flex items-center justify-between">');
L.push('                  <span className="text-[13px] font-black text-[#26301C]">{eur(p.price_cents, cur)}</span>');
L.push('                  <span className="grid size-7 place-items-center rounded-full bg-[#C9D3A8] text-[#26301C]"><Icon name="plus" size={13} strokeWidth={3} /></span>');
L.push('                </div>');
L.push('              </button>');
L.push('            ))}');
L.push('          </div>');
L.push('        </section>');
L.push('      )}');
L.push('');
L.push('      {/* استكشف المنيو */}');
L.push("      <section id='menu-section' className='mt-5'>");
L.push('        <div className="mb-3 flex items-end justify-between px-1">');
L.push('          <h2 className="text-[17px] font-black text-[#26301C]">استكشف المنيو</h2>');
L.push('          {shown.length > 4 && (');
L.push("            <button onClick={() => setShowAll(!showAll)} className='rounded-full bg-white px-3.5 py-1.5 text-[11px] font-black text-[#26301C] shadow-sm ring-1 ring-[#EAD3A0] transition active:scale-95'>");
L.push('              {showAll ? "عرض أقل" : "عرض الكل"}');
L.push('            </button>');
L.push('          )}');
L.push('        </div>');
L.push('        <div className="grid grid-cols-2 gap-3.5 pb-4 sm:grid-cols-3">');
L.push('          {menuItems.map((p) => (');
L.push("            <button key={p.id} onClick={() => openProduct(p)}");
L.push('              className="rounded-[1.75rem] bg-[#F1DCB0] p-2.5 text-right shadow-sm shadow-[#8a6a48]/15 transition hover:-translate-y-1 hover:shadow-lg anim-rise">');
L.push('              <img src={p.image_url} alt={p.name_ar} loading="lazy" className="h-28 w-full rounded-[1.3rem] object-cover" />');
L.push('              <div className="flex items-end justify-between px-1 pb-0.5 pt-2.5">');
L.push('                <div className="min-w-0">');
L.push('                  <h3 className="truncate text-[13px] font-extrabold text-[#26301C]">{p.name_ar}</h3>');
L.push('                  <p className="mt-0.5 text-[13px] font-black text-[#26301C]">{eur(p.price_cents, cur)}</p>');
L.push('                </div>');
L.push('                <span className="grid size-9 flex-none place-items-center rounded-full bg-white shadow-md">');
L.push('                  <Icon name="plus" size={15} className="text-[#26301C]" />');
L.push('                </span>');
L.push('              </div>');
L.push('            </button>');
L.push('          ))}');
L.push('        </div>');
L.push('        {cat !== "all" && (');
L.push('          <p className="pb-2 text-center text-[11px] text-[#94826A]">عرض فئة: {catalog?.categories?.find((c) => c.slug === cat)?.name_ar}</p>');
L.push('        )}');
L.push('      </section>');
L.push('    </div>');
L.push('  );');
L.push('}');
L.push('');

s = s.slice(0, start) + L.join('\n') + '\n' + s.slice(end);

/* البحث يحتاج حالة q — أضفها ضمن Home (استُخدمت أعلاه) */
s = s.replace(
  "  const [showAll, setShowAll] = useState(false);",
  "  const [showAll, setShowAll] = useState(false);\n  const [q, setQ] = useState('');"
);

/* حذف شريط العروض من الرئيسية (الهيرو يحل محله) — الإعلانات تبقى عبر Splash والإشعارات */
const oldBanner = `      {/* بانر العروض — متصل بالهيدر */}
      <div className="px-4 pt-3">
        <OfferBanners ads={ads} cur={cur} onOpen={(a) => setAdOpen(a)} />
      </div>

`;
if (s.includes(oldBanner)) {
  s = s.replace(oldBanner, '');
  console.log('home banner removed');
}

/* تحديث مسار الرئيسية: بلا favorites */
s = s.replace(
  '<Route path="/" element={<Home catalog={catalog} openProduct={setProduct} favorites={favorites} onToggleFav={toggleFav} />} />',
  '<Route path="/" element={<Home catalog={catalog} openProduct={setProduct} />} />'
);

writeFileSync(f, s);
console.log('Home rewritten to coffeesir style');
