// التعديلات الستة على منصة العميل
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
let fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* ---------- 1) الاسم الكامل + صورة الأفاتار في الهيدر ---------- */
const oldHead = `<Link to="/account" className="flex items-center gap-3" aria-label="حسابي">
                <span className="grid size-11 place-items-center rounded-full bg-[#C9D3A8] text-base font-black text-[#26301C] shadow-md">
                  {session.customer.full_name.trim().charAt(0)}
                </span>
                <div className="leading-tight">
                  <p className="text-[10px] font-bold text-[#7C8665]">أهلًا بك</p>
                  <p className="text-[15px] font-black text-[#26301C]">{session.customer.full_name.split(' ')[0]}</p>
                </div>
              </Link>`;
if (!s.includes(oldHead)) fail('header avatar');
const newHead = `<Link to="/account" className="flex items-center gap-3 min-w-0" aria-label="حسابي">
                {session.customer.avatar_url
                  ? <img src={session.customer.avatar_url} alt="" className="size-11 flex-none rounded-full object-cover shadow-md ring-2 ring-white" />
                  : <span className="grid size-11 flex-none place-items-center rounded-full bg-[#C9D3A8] text-base font-black text-[#26301C] shadow-md">
                      {session.customer.full_name.trim().charAt(0)}
                    </span>}
                <div className="min-w-0 leading-tight">
                  <p className="text-[10px] font-bold text-[#7C8665]">أهلًا بك</p>
                  <p className="truncate text-[14.5px] font-black text-[#26301C]">{session.customer.full_name}</p>
                </div>
              </Link>`;
s = s.replace(oldHead, newHead);

/* ---------- 4) أيقونة السلة في الهيدر بجانب الإشعارات ---------- */
const oldBell = `<Link to="/notifications" className="relative grid size-11 place-items-center rounded-full bg-white shadow-sm" aria-label="الإشعارات">
                  <Icon name="bell" size={18} className="text-[#26301C]" />
                  {unread > 0 && <span className="absolute -top-0.5 -left-0.5 grid size-5 place-items-center rounded-full bg-[#C4482E] text-[10px] font-black text-white">{unread}</span>}
                </Link>`;
if (!s.includes(oldBell)) fail('bell link');
const newBell = `<Link to="/notifications" className="relative grid size-11 place-items-center rounded-full bg-white shadow-sm" aria-label="الإشعارات">
                  <Icon name="bell" size={18} className="text-[#26301C]" />
                  {unread > 0 && <span className="absolute -top-0.5 -left-0.5 grid size-5 place-items-center rounded-full bg-[#C4482E] text-[10px] font-black text-white">{unread}</span>}
                </Link>
                <Link to="/cart" className="relative grid size-11 place-items-center rounded-full bg-[#C9D3A8] shadow-sm" aria-label="السلة">
                  <Icon name="cart" size={18} className="text-[#26301C]" />
                  {cart.count > 0 && <span className="absolute -top-0.5 -left-0.5 grid size-5 place-items-center rounded-full bg-[#26301C] text-[10px] font-black text-white">{cart.count}</span>}
                </Link>`;
s = s.replace(oldBell, newBell);

/* ---------- 2) الشريط السفلي: المفضلة بدل الإشعارات + حذف السلة ---------- */
const oldNavItems = `  const navItems: { to: string; icon: IconName; label: string; end?: boolean }[] = [
    { to: '/', icon: 'home', label: 'الرئيسية', end: true },
    { to: '/rewards', icon: 'star', label: 'النقاط' },
    { to: '/orders', icon: 'receipt', label: 'الطلبات' },
    { to: '/notifications', icon: 'bell', label: 'الإشعارات' },
  ]`;
if (!s.includes(oldNavItems)) fail('navItems');
const newNavItems = `  const navItems: { to: string; icon: IconName; label: string; end?: boolean }[] = [
    { to: '/', icon: 'home', label: 'الرئيسية', end: true },
    { to: '/favorites', icon: 'heart', label: 'المفضلة' },
    { to: '/rewards', icon: 'star', label: 'النقاط' },
    { to: '/orders', icon: 'receipt', label: 'الطلبات' },
  ]`;
s = s.replace(oldNavItems, newNavItems);

// حذف زر السلة من الشريط السفلي
const oldCartNav = `          <Link to="/cart" className="relative grid size-11 flex-none place-items-center rounded-full shadow-md" style={{ background: '#C9D3A8', color: '#26301C' }} aria-label="السلة">
            <Icon name="cart" size={19} />
            {cart.count > 0 && <span className="absolute -top-1 -left-1 grid size-5 place-items-center rounded-full bg-[#26301C] text-[10px] font-black text-white">{cart.count}</span>}
          </Link>
`;
if (!s.includes(oldCartNav)) fail('cart in nav');
s = s.replace(oldCartNav, '');

/* ---------- 3) البحث في الرئيسية ---------- */
const oldHome = `function Home({ catalog, openProduct }: { catalog: Catalog | null; openProduct: (p: Product) => void }) {
  const [cat, setCat] = useState('all');
  const products = catalog?.products ?? [];
  const shown = cat === 'all' ? products : products.filter((p) => p.category === cat);
  const cur = catalog?.settings?.currency_symbol ?? 'ل.س';
  const activeName = cat === 'all' ? 'كل المنتجات' : catalog?.categories?.find((c) => c.slug === cat)?.name_ar;

  return (
    <div className="anim-rise">
      <FeaturedCategories catalog={catalog} cat={cat} setCat={setCat} />`;
if (!s.includes(oldHome)) fail('home fn');
const newHome = `function Home({ catalog, openProduct, favorites, onToggleFav }: { catalog: Catalog | null; openProduct: (p: Product) => void; favorites: Set<number>; onToggleFav: (id: number) => void }) {
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const products = catalog?.products ?? [];
  let shown = cat === 'all' ? products : products.filter((p) => p.category === cat);
  if (q.trim()) {
    const needle = q.trim().toLowerCase();
    shown = shown.filter((p) => p.name_ar.includes(needle) || p.name_en.toLowerCase().includes(needle));
  }
  const cur = catalog?.settings?.currency_symbol ?? 'ل.س';
  const activeName = q.trim() ? \`نتائج البحث عن "\${q.trim()}"\` : cat === 'all' ? 'كل المنتجات' : catalog?.categories?.find((c) => c.slug === cat)?.name_ar;

  return (
    <div className="anim-rise">
      {/* البحث */}
      <div className="relative mb-4">
        <Icon name="search" size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7C8665]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن مشروب أو حلوى…"
          className="h-12 w-full rounded-full border-2 border-[#D5DEB4] bg-white pr-11 pl-4 text-sm font-bold text-[#26301C] outline-none focus:border-[#7C8F52]" />
        {q && <button onClick={() => setQ('')} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7C8665]" aria-label="مسح"><Icon name="x" size={15} /></button>}
      </div>

      <FeaturedCategories catalog={catalog} cat={cat} setCat={(c) => { setCat(c); setQ(''); }} />`;
s = s.replace(oldHome, newHome);

// قلب المفضلة على بطاقات المنتج في الرئيسية
const oldCard = `              <img src={p.image_url} alt={p.name_ar} loading="lazy" className="h-28 w-full rounded-[1.3rem] object-cover" />
              <div className="flex items-end justify-between px-1 pb-0.5 pt-2.5">`;
if (!s.includes(oldCard)) fail('home card img');
const newCard = `              <div className="relative">
                <img src={p.image_url} alt={p.name_ar} loading="lazy" className="h-28 w-full rounded-[1.3rem] object-cover" />
                <button onClick={(e) => { e.stopPropagation(); onToggleFav(p.id); }}
                  className="absolute top-2 left-2 grid size-8 place-items-center rounded-full bg-white/95 shadow transition active:scale-90" aria-label="المفضلة">
                  <Icon name="heart" size={14} filled={favorites.has(p.id)} className={favorites.has(p.id) ? 'text-[#C4482E]' : 'text-[#7C8665]'} />
                </button>
              </div>
              <div className="flex items-end justify-between px-1 pb-0.5 pt-2.5">`;
s = s.replace(oldCard, newCard);

/* ---------- صفحة المفضلة ---------- */
const favPage = `
/* ============================ المفضلة ============================ */
function FavoritesPage({ myData, session, openProduct, onToggleFav }: any) {
  if (!session) return <NeedLogin />;
  const items = myData?.favorites ?? [];
  return (
    <div className="space-y-3 pb-4 anim-rise">
      <div className="mb-1 flex items-end justify-between px-1">
        <h2 className="text-[17px] font-black text-[#26301C]">مفضلتي</h2>
        <span className="text-[11px] font-bold text-[#7C8665]">{items.length} منتج</span>
      </div>
      {items.length === 0 && (
        <div className="py-16 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-[1.4rem] bg-[#E3E9C8] text-[#5C6B3C]"><Icon name="heart" size={26} /></span>
          <p className="mt-4 text-sm font-bold text-neutral-500">لا توجد منتجات مفضلة بعد</p>
          <p className="mt-1 text-xs text-neutral-400">اضغط على القلب ♥ في أي منتج لإضافته هنا</p>
        </div>
      )}
      {items.map((p, i) => (
        <div key={p.id} className="flex items-center gap-3.5 rounded-[1.5rem] bg-white p-3 shadow-sm ring-1 ring-[#D5DEB4] anim-rise" style={{ animationDelay: \`\${i * 25}ms\` }}>
          <button onClick={() => openProduct(p)} className="flex min-w-0 flex-1 items-center gap-3.5 text-right">
            <img src={p.image_url} alt="" className="size-16 flex-none rounded-[1rem] object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold text-[#26301C]">{p.name_ar}</span>
              <span className="mt-0.5 block text-sm font-black text-[#5C6B3C]">{eur(p.price_cents)}</span>
            </span>
          </button>
          <button onClick={() => onToggleFav(p.id)}
            className="grid size-10 flex-none place-items-center rounded-full bg-[#FBEDE9] text-[#C4482E] transition active:scale-90" aria-label="إزالة من المفضلة">
            <Icon name="heart" size={17} filled />
          </button>
        </div>
      ))}
    </div>
  );
}
`;
// إدراج صفحة المفضلة قبل "/* ============================ استبدل نقاطك"
const anchorRewards = '/* ============================ استبدل نقاطك ============================ */';
if (!s.includes(anchorRewards)) fail('rewards anchor');
s = s.replace(anchorRewards, favPage + '\n' + anchorRewards);

/* ---------- قلب المفضلة في نافذة تفاصيل المنتج ---------- */
s = s.replace(
  'function ProductSheet({ product, catalog, onClose, onAdd, onOrderNow }: {\n  product: Product; catalog: Catalog | null; onClose: () => void;\n  onAdd: (line: CartLine) => void; onOrderNow: (line: CartLine) => void;\n}) {',
  'function ProductSheet({ product, catalog, onClose, onAdd, onOrderNow, isFav, onToggleFav }: {\n  product: Product; catalog: Catalog | null; onClose: () => void;\n  onAdd: (line: CartLine) => void; onOrderNow: (line: CartLine) => void;\n  isFav: boolean; onToggleFav: (id: number) => void;\n}) {'
);
const oldSheetImg = `        <img src={product.image_url} alt={product.name_ar} className="size-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />
        <button onClick={onClose}`;
if (!s.includes(oldSheetImg)) fail('sheet img');
const newSheetImg = `        <img src={product.image_url} alt={product.name_ar} className="size-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />
        <button onClick={() => onToggleFav(product.id)}
          className="absolute top-4 left-4 grid size-11 place-items-center rounded-full bg-white shadow-lg transition active:scale-90" aria-label="المفضلة">
          <Icon name="heart" size={19} filled={isFav} className={isFav ? 'text-[#C4482E]' : 'text-[#26301C]'} />
        </button>
        <button onClick={onClose}`;
s = s.replace(oldSheetImg, newSheetImg);

/* ---------- 5) صورة الملف الشخصي: التسجيل + الحساب ---------- */
// تسجيل: حقل رفع صورة اختياري
const oldSignupBtn = `        <p className="mt-3 rounded-2xl bg-[#EEF2DC] px-3 py-2.5 text-[11px] leading-relaxed text-[#7C8665]">`;
if (!s.includes(oldSignupBtn)) fail('signup note');
const avatarPicker = `        <div className="mt-4 flex items-center justify-center gap-3">
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="size-16 rounded-full object-cover shadow-md ring-2 ring-white" />
            : <span className="grid size-16 place-items-center rounded-full bg-[#E3E9C8] text-[#5C6B3C]"><Icon name="user" size={24} /></span>}
          <label className="cursor-pointer rounded-full border-2 border-[#C9D3A8] bg-[#EEF2DC] px-4 py-2 text-[11px] font-black text-[#26301C] transition active:scale-95">
            {uploading ? 'جارٍ الرفع…' : avatarUrl ? 'تغيير الصورة' : 'صورة الملف الشخصي (اختياري)'}
            <input type="file" accept="image/*" className="hidden" disabled={uploading}
              onChange={(e) => { const file = e.target.files?.[0]; if (file) pickAvatar(file); e.target.value = ''; }} />
          </label>
        </div>
        <p className="mt-3 rounded-2xl bg-[#EEF2DC] px-3 py-2.5 text-[11px] leading-relaxed text-[#7C8665]">`;
s = s.replace(oldSignupBtn, avatarPicker);

// منطق الرفع في SignupPage
const oldSignupState = `  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    setErr('');
    if (name.trim().length < 2) return setErr('أدخل اسمك الكامل');`;
if (!s.includes(oldSignupState)) fail('signup state');
const newSignupState = `  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const pickAvatar = async (file: File) => {
    setUploading(true); setErr('');
    try {
      if (!file.type.startsWith('image/')) throw new Error('اختر ملف صورة');
      if (file.size > 5 * 1024 * 1024) throw new Error('حجم الصورة أقل من 5 ميجابايت مطلوب');
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace('jpeg', 'jpg');
      const path = 'avatars/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const { error } = await sb.storage.from('images').upload(path, file, { contentType: file.type });
      if (error) throw error;
      setAvatarUrl(sb.storage.from('images').getPublicUrl(path).data.publicUrl);
    } catch (e: any) { setErr(e.message || 'فشل رفع الصورة'); }
    setUploading(false);
  };
  const submit = async () => {
    if (busy) return;
    setErr('');
    if (name.trim().length < 2) return setErr('أدخل اسمك الكامل');`;
s = s.replace(oldSignupState, newSignupState);

// حفظ الصورة بعد إنشاء الحساب
const oldSignupDone = `      const s = await rpc<Session>('customer_login', { p_phone: phone.replace(/\\D/g, ''), p_pin: pin });
      onLogged(s);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-sm py-8 anim-rise">`;
if (!s.includes(oldSignupDone)) fail('signup done');
const newSignupDone = `      const s = await rpc<Session>('customer_login', { p_phone: phone.replace(/\\D/g, ''), p_pin: pin });
      if (avatarUrl) await rpc('update_avatar', { p_token: s.token, p_url: avatarUrl }).catch(() => {});
      onLogged(s);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-sm py-8 anim-rise">`;
s = s.replace(oldSignupDone, newSignupDone);

// استيراد sb في الأعلى
s = s.replace("import { rpc } from '../lib/supabase';", "import { rpc, sb } from '../lib/supabase';");

// AccountPage: صورة + زر تغيير الصورة فقط (الاسم والرقم غير قابلين للتعديل)
const oldAccAvatar = `        <span className="mx-auto grid size-16 place-items-center rounded-full bg-white/15 text-2xl font-black backdrop-blur">
          {c.full_name.trim().charAt(0)}
        </span>
        <h2 className="mt-3 text-lg font-black">{c.full_name}</h2>
        <p className="mt-0.5 text-xs text-white/70" dir="ltr">{c.phone}</p>`;
if (!s.includes(oldAccAvatar)) fail('account avatar');
const newAccAvatar = `        {c.avatar_url
          ? <img src={c.avatar_url} alt="" className="mx-auto size-20 rounded-full object-cover shadow-xl ring-4 ring-white/25" />
          : <span className="mx-auto grid size-20 place-items-center rounded-full bg-white/15 text-2xl font-black backdrop-blur">
              {c.full_name.trim().charAt(0)}
            </span>}
        <label className="mx-auto mt-2 block w-fit cursor-pointer rounded-full bg-white/15 px-4 py-1.5 text-[10px] font-black transition hover:bg-white/25">
          {uploadingAvatar ? 'جارٍ الرفع…' : 'تغيير الصورة'}
          <input type="file" accept="image/*" className="hidden" disabled={uploadingAvatar}
            onChange={(e) => { const file = e.target.files?.[0]; if (file) onAvatar(file); e.target.value = ''; }} />
        </label>
        <h2 className="mt-3 text-lg font-black">{c.full_name}</h2>
        <p className="mt-0.5 text-xs text-white/70" dir="ltr">{c.phone}</p>`;
s = s.replace(oldAccAvatar, newAccAvatar);

// خصائص AccountPage
s = s.replace(
  'function AccountPage({ session, myData, waNumber, onLogout, onPush, pushMsg }: {\n  session: Session; myData: MyData | null; waNumber: string; onLogout: () => void; onPush: () => void; pushMsg: string;\n}) {\n  const [showCodes, setShowCodes] = useState(false);',
  `function AccountPage({ session, myData, waNumber, onLogout, onPush, pushMsg, onAvatar, uploadingAvatar }: {
  session: Session; myData: MyData | null; waNumber: string; onLogout: () => void; onPush: () => void; pushMsg: string;
  onAvatar: (file: File) => void; uploadingAvatar: boolean;
}) {
  const [showCodes, setShowCodes] = useState(false);`
);

/* ---------- 6) إخفاء العروض من حسابي وعن المحل ---------- */
const oldBanner = `      <div className="px-4 pt-3">
        <OfferBanners ads={ads} cur={cur} onOpen={(a) => setAdOpen(a)} />
      </div>`;
if (!s.includes(oldBanner)) fail('banners block');
const newBanner = `      {pathname !== '/account' && pathname !== '/about' && (
        <div className="px-4 pt-3">
          <OfferBanners ads={ads} cur={cur} onOpen={(a) => setAdOpen(a)} />
        </div>
      )}`;
s = s.replace(oldBanner, newBanner);

// استيراد useLocation + pathname
s = s.replace(
  "import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';",
  "import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';"
);
s = s.replace(
  `export default function CustomerApp() {
  const nav = useNavigate();
  _navRef = nav;`,
  `export default function CustomerApp() {
  const nav = useNavigate();
  const pathname = useLocation().pathname;
  _navRef = nav;`
);

/* ---------- ربط المفضلة في الهيكل ---------- */
// حالة المفضلة: Set من المعرفات + دالة تبديل
s = s.replace(
  `  const [pushMsg, setPushMsg] = useState('');
  const waNumber = catalog?.settings?.whatsapp_number ?? '963936107119';`,
  `  const [pushMsg, setPushMsg] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const favorites = useMemo(() => new Set<number>((myData?.favorites ?? []).map((p) => p.id)), [myData]);
  const toggleFav = async (id: number) => {
    if (!session) { nav('/login'); show('سجّل دخولك لاستخدام المفضلة'); return; }
    try {
      const now = await rpc<boolean>('toggle_favorite', { p_token: session.token, p_product_id: id });
      show(now ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة', 'ok');
      refresh();
    } catch (e: any) { show(e.message, 'err'); }
  };
  const changeAvatar = async (file: File) => {
    if (!session) return;
    setUploadingAvatar(true);
    try {
      if (!file.type.startsWith('image/')) throw new Error('اختر ملف صورة');
      if (file.size > 5 * 1024 * 1024) throw new Error('حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace('jpeg', 'jpg');
      const path = 'avatars/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const { error } = await sb.storage.from('images').upload(path, file, { contentType: file.type });
      if (error) throw error;
      const url = sb.storage.from('images').getPublicUrl(path).data.publicUrl;
      await rpc('update_avatar', { p_token: session.token, p_url: url });
      show('تم تحديث الصورة', 'ok');
      refresh();
    } catch (e: any) { show(e.message || 'فشل رفع الصورة', 'err'); }
    setUploadingAvatar(false);
  };
  const waNumber = catalog?.settings?.whatsapp_number ?? '963936107119';`
);

// تمرير favorites للرئيسية ونافذة المنتج ومسار المفضلة
s = s.replace(
  '<Route path="/" element={<Home catalog={catalog} openProduct={setProduct} />} />',
  '<Route path="/" element={<Home catalog={catalog} openProduct={setProduct} favorites={favorites} onToggleFav={toggleFav} />} />'
);
s = s.replace(
  '<Route path="/rewards" element=',
  `<Route path="/favorites" element={
            <FavoritesPage myData={myData} session={session} openProduct={setProduct} onToggleFav={toggleFav} />} />
          <Route path="/rewards" element=`
);
s = s.replace(
  `{product && <ProductSheet product={product} catalog={catalog}
        onClose={() => setProduct(null)}
        onAdd={(l) => { cart.add(l); setProduct(null); show('أُضيف إلى السلة', 'ok'); }}
        onOrderNow={(l) => { cart.add(l); setProduct(null); setTimeout(() => startOrder([l]), 50); }} />}`,
  `{product && <ProductSheet product={product} catalog={catalog}
        onClose={() => setProduct(null)}
        isFav={favorites.has(product.id)} onToggleFav={toggleFav}
        onAdd={(l) => { cart.add(l); setProduct(null); show('أُضيف إلى السلة', 'ok'); }}
        onOrderNow={(l) => { cart.add(l); setProduct(null); setTimeout(() => startOrder([l]), 50); }} />}`
);
// تمرير onAvatar للحساب
s = s.replace(
  '<AccountPage session={session} myData={myData} waNumber={waNumber} pushMsg={pushMsg} onPush={enablePush}',
  '<AccountPage session={session} myData={myData} waNumber={waNumber} pushMsg={pushMsg} onPush={enablePush} onAvatar={changeAvatar} uploadingAvatar={uploadingAvatar}'
);
// في نبضة nav نشط: قلب مملوء للمفضلة
s = s.replace(
  "filled={isActive && t.icon === 'star'}",
  "filled={isActive && (t.icon === 'star' || t.icon === 'heart')}"
);

writeFileSync(f, s);
console.log('all 6 changes applied');
