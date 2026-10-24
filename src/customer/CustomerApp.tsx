import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { rpc, sb } from '../lib/supabase';
import type { Ad, CartLine, Catalog, MyData, MyOrder, OrderItem, PopularProduct, Product, Redemption, Session } from '../lib/types';
import { eur, fmtDateTime, fmtDateTimeNum, deviceId, getCurrentLocation, urlBase64ToUint8Array, shopStatus, fmtDateNum } from '../lib/utils';
import { buildOrderMessage, waChatLink, whatsapp } from '../lib/whatsapp';
import { Icon, type IconName } from '../components/Icons';

const SESSION_KEY = 'dose_app_session_v1';
const CART_KEY = 'dose_cart_v1';
const VAPID_PUB = 'BCDKL0U34tZgWEGIygt6PLe6tpX_7kOn4bkavZYoO6OAPdEBC0kjDpLxuDouKqWNqjgsC5h9V2gNJ08POBsRLmo';

/* ============================ الحالة المشتركة ============================ */
function useAppSession() {
  const [session, setSession] = useState<Session | null>(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  });
  const [myData, setMyData] = useState<MyData | null>(null);

  const save = useCallback((s: Session | null) => {
    setSession(s);
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
    if (!s) setMyData(null);
  }, []);

  const refresh = useCallback(async () => {
    const cur = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as Session | null;
    if (!cur?.token) return;
    try {
      const d = await rpc<MyData>('get_my_data', { p_token: cur.token });
      if (d?.customer) { setMyData(d); setSession({ token: cur.token, customer: d.customer }); }
      else { localStorage.removeItem(SESSION_KEY); setSession(null); setMyData(null); }
    } catch { /* شبكة */ }
  }, []);

  useEffect(() => { refresh(); const t = setInterval(refresh, 25000); return () => clearInterval(t); }, [refresh]);
  return { session, myData, save, refresh };
}

function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => { rpc<Catalog>('get_catalog').then(setCatalog).catch(() => {}); }, []);
  return catalog;
}

/* ============================ السلة ============================ */
function useCart() {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(lines)); }, [lines]);

  const add = useCallback((line: CartLine) => {
    setLines((ls) => {
      const key = (l: CartLine) => l.product.id + '|' + (l.options || []).join(',');
      const i = ls.findIndex((l) => key(l) === key(line));
      if (i >= 0) {
        const cp = [...ls];
        cp[i] = { ...cp[i], qty: Math.min(50, cp[i].qty + line.qty) };
        return cp;
      }
      return [...ls, line];
    });
  }, []);

  const setQty = useCallback((idx: number, qty: number) => {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, qty: Math.max(1, Math.min(50, qty)) } : l)));
  }, []);

  const remove = useCallback((idx: number) => setLines((ls) => ls.filter((_, i) => i !== idx)), []);
  const clear = useCallback(() => setLines([]), []);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  return { lines, add, setQty, remove, clear, count };
}

/* ============================ عناصر مشتركة ============================ */
const Logo = ({ size = 42 }: { size?: number }) => (
  <img src="/logo.jpg" alt="Dose" style={{ width: size, height: size }}
    className="rounded-2xl object-cover shadow-md shadow-[#8a6a48]/15 ring-2 ring-white" />
);

function useToast() {
  const [toast, setToast] = useState<{ msg: string; kind?: 'ok' | 'err' } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = (msg: string, kind?: 'ok' | 'err') => {
    setToast({ msg, kind });
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3200);
  };
  const node = toast ? (
    <div className={`fixed inset-x-0 bottom-32 z-[300] mx-auto w-fit max-w-[92vw] rounded-full px-5 py-3 text-center text-sm font-bold shadow-2xl anim-pop ${
      toast.kind === 'err' ? 'bg-[#C4482E] text-white' : 'bg-[#26301C] text-[#E9EDD6]'}`}>{toast.msg}</div>
  ) : null;
  return { show, node };
}

type Fulfillment = 'pickup' | 'delivery';
/* السعر الفعلي: سعر العرض إن وُجد وأقل من الأصلي */
const effPrice = (p: { price_cents: number; sale_price_cents?: number | null }) =>
  p.sale_price_cents != null && p.sale_price_cents < p.price_cents ? p.sale_price_cents : p.price_cents;
const hasOffer = (p: { price_cents: number; sale_price_cents?: number | null }) =>
  p.sale_price_cents != null && p.sale_price_cents < p.price_cents;
const lineUnit = (l: CartLine) => effPrice(l.product) + (l.additions ?? []).reduce((a, x) => {
  const mode = x.price_mode === 'subtract' || (x.price_mode === undefined && /(كوب\s*صغير|small\s*cup)/i.test(x.name_ar ?? ''))
    ? 'subtract' : 'add';
  return mode === 'subtract' ? a - Math.abs(x.price_cents) : a + x.price_cents;
}, 0);
interface OrderFlow { step: 'contact' | 'fulfillment' | 'location' | 'promo' | 'review' | null; lines: CartLine[]; fulfillment?: Fulfillment; loc?: { lat: number; lng: number; mapUrl: string }; usePromo?: boolean; name?: string; phone?: string }

/* ============================ الإشعارات الفورية ============================ */
async function enablePushNotifications(session: Session): Promise<string> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'غير مدعوم في هذا المتصفح';
  const perm = Notification.permission;
  if (perm === 'denied') return 'الإشعارات محظورة من إعدادات المتصفح';
  const ask = perm === 'default' ? await Notification.requestPermission() : perm;
  if (ask !== 'granted') return 'لم يتم السماح بالإشعارات';
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUB),
    });
  }
  await rpc('save_push_subscription', { p_token: session.token, p_sub: JSON.stringify(sub) });
  return 'تم تفعيل الإشعارات على هذا الجهاز';
}

/** هل الإشعارات مفعّلة على هذا الجهاز؟ */
async function isPushEnabled(): Promise<boolean> {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch { return false; }
}

/** تعطيل الإشعارات على هذا الجهاز */
async function disablePushNotifications(): Promise<string> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'غير مدعوم في هذا المتصفح';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
  return 'تم تعطيل الإشعارات على هذا الجهاز';
}

/* ============================ إعلان وسط الشاشة — يظهر بعد دقيقتين من التصفح ============================ */
function MidAd({ ad, cur, onClose, onBrowse }: { ad: Ad; cur: string; onClose: () => void; onBrowse?: (slug: string) => void }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setP(Math.min(1, (Date.now() - start) / 20000)), 80);
    const end = setTimeout(onClose, 20000);
    return () => { clearInterval(t); clearTimeout(end); };
  }, []);
  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/60 p-5 backdrop-blur-sm anim-fade" onClick={onClose}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-white shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <img src={ad.image_url} alt={ad.title} className="h-56 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25" />
          <span className="absolute right-4 top-4 rounded-full bg-[#C9D3A8] px-3.5 py-1.5 text-[11px] font-black text-[#26301C] shadow-lg">عرض حصري ✨</span>
          <button onClick={onClose} className="absolute left-4 top-4 grid size-9 place-items-center rounded-full bg-black/45 text-white transition active:scale-90" aria-label="إغلاق">
            <Icon name="x" size={16} />
          </button>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
            <div className="h-full bg-[#EAC98F]" style={{ width: p * 100 + '%', transition: 'width .1s linear' }} />
          </div>
        </div>
        <div className="p-5 text-center">
          <h2 className="text-xl font-black text-[#26301C]">{ad.title}</h2>
          {ad.description_ar && <p className="mt-1 text-xs font-bold text-[#7C8665]">{ad.description_ar}</p>}
          {(ad.old_price_cents != null || ad.new_price_cents != null) && (
            <div className="mt-3 flex items-baseline justify-center gap-3">
              {ad.old_price_cents != null && <span className="text-sm font-bold text-neutral-400 line-through">{eur(ad.old_price_cents, cur)}</span>}
              {ad.new_price_cents != null && <span className="text-3xl font-black text-[#26301C]">{eur(ad.new_price_cents, cur)}</span>}
            </div>
          )}
          <button onClick={() => (onBrowse && ad.category_slug ? onBrowse(ad.category_slug) : onClose())}
            className="mt-4 w-full rounded-full bg-gradient-to-l from-[#C9D3A8] to-[#A9B87F] py-3.5 text-base font-black text-[#26301C] shadow-lg shadow-[#8a6a48]/30 transition active:scale-[.98]">
            {ad.category_slug ? 'تصفح عروض الفئة 🏷️' : 'اطلب الآن'}
          </button>
          <p className="mt-2 text-[10px] font-bold text-neutral-400">يُغلق تلقائيًا بعد 20 ثانية</p>
        </div>
      </div>
    </div>
  );
}

/* ============================ الشاشة الترحيبية — 3 ثوانٍ ============================ */
function WelcomeScreen({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-[#E9EDD6] anim-fade">
      <div className="pointer-events-none absolute -top-10 -left-10 size-44 rounded-full bg-[#D5DEB4]/60 blur-2xl" />
      <div className="pointer-events-none absolute bottom-16 -right-12 size-52 rounded-full bg-[#C4CF9E]/50 blur-2xl" />

      <img src="/logo.jpg" alt="Dose Coffee & More"
        className="size-36 rounded-[2.2rem] object-cover shadow-2xl shadow-[#8a6a48]/45 ring-4 ring-white" />

      <h1 className="mt-8 text-4xl font-black text-[#26301C]">حب من طرف قهوة</h1>
      <p className="mt-2 text-sm font-bold tracking-wide text-[#7C8665]">Dose Coffee &amp; More</p>

      <div className="absolute bottom-12 h-1 w-28 overflow-hidden rounded-full bg-[#D5DEB4]">
        <div className="h-full rounded-full bg-[#5C6B3C]" style={{ width: '100%', animation: 'welcome-progress 3s linear forwards' }} />
      </div>
    </div>
  );
}

/* ============================ بانر العروض ============================ */
function OfferBanners({ ads, cur, onOpen }: { ads: Ad[]; cur: string; onOpen: (a: Ad) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  if (!ads.length) return null;
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    setIdx(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
  };
  return (
    <div>
      <div ref={ref} onScroll={onScroll}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto">
        {ads.map((a) => (
          <button key={a.id} onClick={() => onOpen(a)}
            className="relative h-44 w-full flex-none snap-center overflow-hidden rounded-[1.9rem] text-right shadow-xl shadow-[#8a6a48]/35 sm:h-48">
            <img src={a.image_url} alt={a.title} className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-l from-[#333D25]/95 via-[#333D25]/60 to-transparent" />
            <div className="absolute inset-y-0 right-0 flex w-[62%] flex-col justify-center gap-1 p-6 text-white">
              <span className="text-[11px] font-bold text-[#C9D3A8]">اليوم فقط</span>
              <h3 className="text-[22px] font-black leading-tight">{a.title}</h3>
              <p className="text-[11px] font-medium text-white/80">{a.description_ar}</p>
              <div className="mt-1 flex items-baseline gap-2">
                {a.old_price_cents != null && <span className="text-xs font-bold text-white/60 line-through">{eur(a.old_price_cents, cur)}</span>}
                {a.new_price_cents != null && <span className="text-xl font-black text-[#C9D3A8]">{eur(a.new_price_cents, cur)}</span>}
              </div>
              <span className="mt-2 w-fit rounded-full bg-[#C9D3A8] px-4 py-1.5 text-[11px] font-black text-[#26301C] shadow">اطلب الآن</span>
            </div>
          </button>
        ))}
      </div>
      {ads.length > 1 && (
        <div className="mt-2.5 flex justify-center gap-1.5">
          {ads.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-5 bg-[#5C6B3C]' : 'w-1.5 bg-[#C4CF9E]'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================ الأكثر مبيعًا وطلبًا ============================ */
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
            style={{ animationDelay: `${i * 35}ms` }}>
            <img src={p.image_url} alt={p.name_ar} loading="lazy" className="h-24 w-full rounded-[1rem] object-cover" />
            <h3 className="mt-1.5 truncate px-1 text-[12px] font-extrabold text-[#26301C]">{p.name_ar}</h3>
            <p className="px-1 pb-0.5 text-[12px] font-black text-[#5C6B3C]">
              {hasOffer(p) ? <><span className="me-1 rounded-full bg-[#C4482E] px-1.5 py-0.5 text-[8px] font-black text-white">عرض</span>{eur(effPrice(p), cur)} <span className="text-[10px] font-bold text-neutral-400 line-through">{eur(p.price_cents, cur)}</span></> : eur(p.price_cents, cur)}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ============================ فئات مميزة ============================ */
const CAT_IMAGES: Record<string, string> = {
  hot_drinks: '/img/cappuccino.jpg',
  cold_drinks: '/img/iced-latte.jpg',
  matcha_tea: '/img/matcha.jpg',
  fresh: '/img/juice.jpg',
  mojito: '/img/mojito.jpg',
  dessert: '/img/chocolate-cake.jpg',
};

function FeaturedCategories({ catalog, cat, setCat }: { catalog: Catalog | null; cat: string; setCat: (s: string) => void }) {
  const items = [{ slug: 'all', name_ar: 'الكل' }, ...(catalog?.categories ?? [])];
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-[17px] font-black text-[#26301C]">فئات مميزة</h2>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {items.map((c) => {
          const active = cat === c.slug;
          return (
            <button key={c.slug} onClick={() => setCat(c.slug)}
              className={`relative h-24 w-32 flex-none overflow-hidden rounded-[1.3rem] shadow-md transition active:scale-95 anim-rise ${active ? 'ring-[3px] ring-[#5C6B3C]' : 'ring-1 ring-[#D5DEB4]'}`}>
              {c.slug === 'all'
                ? <span className="grid size-full place-items-center bg-gradient-to-br from-[#414D36] to-[#26301C] text-[#C9D3A8]"><Icon name="package" size={24} /></span>
                : <img src={CAT_IMAGES[c.slug] ?? '/img/latte.jpg'} alt={c.name_ar} className='size-full object-cover' loading='lazy' />}
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 pb-2 text-center text-[12px] font-black text-white drop-shadow">{c.name_ar}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* بطاقة كود الخصم المنشور */
function PromoBanner({ settings }: { settings: Record<string, string> }) {
  const code = settings?.promo_code;
  const disc = settings?.promo_discount;
  if (!code || !disc) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-[1.4rem] border-2 border-dashed border-[#8A6A48] bg-[#F1DCB0] px-4 py-3.5">
      <div>
        <p className="text-[10px] font-black text-[#7C8665]">🎁 كود خصم حصري</p>
        <p className='font-mono text-xl font-black tracking-[.2em] text-[#26301C]' dir='ltr'>{code}</p>
        <p className="text-[10.5px] font-bold text-[#7C8665]">استخدمه في الكشك واحصل على خصم {disc}%</p>
      </div>
      <span className="rounded-full bg-[#26301C] px-3 py-1.5 text-[10px] font-black text-[#C9D3A8]">خصم {disc}%</span>
    </div>
  );
}

/* ============================ الرئيسية ============================ */
function Home({ catalog, openProduct, ads, onOpenAd, selectedCat, onSelectCat }: { catalog: Catalog | null; openProduct: (p: Product) => void; ads: Ad[]; onOpenAd: (a: Ad) => void; selectedCat: string; onSelectCat: (s: string) => void }) {
  const cat = selectedCat;
  const setCat = onSelectCat;
  const [q, setQ] = useState('');
  const [selMenu, setSelMenu] = useState<number | null>(null);
  const products = catalog?.products ?? [];
  let shown = cat === 'all' ? products : products.filter((p) => p.category === cat);
  /* القائمة المختارة: تُعرض منتجاتها فقط */
  if (selMenu !== null) {
    const list = (catalog?.menus ?? []).find((m) => m.id === selMenu);
    if (list) {
      const ids = new Set((list.items ?? []).map((p) => p.id));
      shown = products.filter((p) => ids.has(p.id));
    }
  }
  if (q.trim()) {
    const needle = q.trim().toLowerCase();
    shown = shown.filter((p) => p.name_ar.includes(needle) || p.name_en.toLowerCase().includes(needle));
  }
  const cur = catalog?.settings?.currency_symbol ?? 'ل.س';
  const promoCode = catalog?.settings?.promo_code;
  const promoDisc = catalog?.settings?.promo_discount;
  const mostOrdered = catalog?.most_ordered ?? [];
  const menuLists = (catalog?.menus ?? []).filter((m) => (m.items ?? []).length > 0);
  const productMenuMap = new Map<number, string>();
  for (const m of (catalog?.menus ?? [])) for (const it of (m.items ?? [])) productMenuMap.set(it.id, m.title);
  const items = [{ slug: 'all', name_ar: 'الكل' }, ...(catalog?.categories ?? [])];
  const searching = q.trim() !== '';
  const selMenuTitle = selMenu !== null ? (catalog?.menus ?? []).find((m) => m.id === selMenu)?.title : null;
  /* عند اختيار فئة أو قائمة محددة تُعرض كل منتجاتها فورًا، ويظهر «عرض الكل» فقط مع فئة الكل */
  const menuItems = shown;
  const byCat = new Map<string, any[]>();
  for (const p of menuItems) {
    const key = p.category ?? 'all';
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key)!.push(p);
  }
  const catLabel = (slug: string) => {
    const c = (catalog?.categories ?? []).find((x) => x.slug === slug);
    return c ? c.name_ar : slug === 'all' ? 'الكل' : slug;
  };
  const jumpToMenu = () => setTimeout(() => document.getElementById('menu-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);

  // إعدادات الهيرو
const heroTitle = (catalog?.settings?.hero_title ?? '').trim();
const heroSubtitle = (catalog?.settings?.hero_subtitle ?? '').trim();
const heroBadge = (catalog?.settings?.hero_badge ?? '').trim();
  const heroImage = (catalog?.settings?.hero_image_url ?? '').trim();
  const heroActive = catalog?.settings?.hero_active !== 'false';

  // الهيرو المتنقل — إعلان كل 7 ثوانٍ
  const [heroIdx, setHeroIdx] = useState(0);
  useEffect(() => {
    if (ads.length <= 1) return;
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % ads.length), 7000);
    return () => clearInterval(t);
  }, [ads.length]);
  const currentAd = ads[heroIdx];
  const scrollToMenu = () => document.getElementById('menu-section')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="anim-rise">
      {/* الهيرو */}
      {heroActive && (
      <div className='relative overflow-hidden rounded-[1.8rem] p-5 text-white shadow-xl shadow-[#26301C]/40'>
        {heroImage ? (
          <img src={heroImage} alt='' className='absolute inset-0 size-full object-cover' />
        ) : ads.length > 0 ? (
          ads.map((a, i) => (
            <img key={a.id} src={a.image_url} alt='' className={`absolute inset-0 size-full object-cover transition-opacity duration-1000 ${heroIdx === i ? 'opacity-100' : 'opacity-0'}`} />
          ))
        ) : (
          <img src='/img/v60.jpg' alt='' className='absolute inset-0 size-full object-cover' />
        )}
        <div className='absolute inset-0 bg-gradient-to-bl from-[#26301C]/80 via-[#3A4531]/60 to-[#414D36]/75' />
        <div className='pointer-events-none absolute -bottom-16 -left-10 size-44 rounded-full bg-white/5 blur-2xl' />
        <div className='relative'>
          {currentAd && !heroImage && ads.length > 0 ? (
            <>
              <span className='rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-[#C9D3A8]'>عرض حصري</span>
              <h2 className='mt-2.5 text-[22px] font-black leading-snug'>{currentAd.title}</h2>
              <p className='mt-1.5 text-[11px] font-medium text-white/80'>{currentAd.description_ar}</p>
            </>
          ) : (
            <>
              <span className='rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-[#C9D3A8]'>{heroBadge || 'قهوة مختصة في كل رشفة'}</span>
              <h2 className='mt-2.5 text-[22px] font-black leading-snug'>
                {heroTitle ? heroTitle.replace(/\n/g, '\n') : 'قهوتك على ذوقك،\nوحلويات تُدللها'}
              </h2>
              <p className='mt-1.5 text-[11px] font-medium text-white/75'>
                {heroSubtitle || 'اطلب من القهوة والحلويات من المنيو واستمتع بجمع النقاط'}
              </p>
            </>
          )}
          <div className='mt-4 flex items-end justify-between gap-2'>
            {promoCode && promoDisc ? (
              <div className='rounded-xl border-2 border-dashed border-[#C9D3A8]/80 bg-[#26301C]/70 px-2.5 py-1.5 text-center backdrop-blur-sm'>
              <p className='text-[8.5px] font-bold text-[#C9D3A8]'>كود خصم {promoDisc}%</p>
              <p className='font-mono text-[13px] font-black tracking-widest' dir='ltr'>{promoCode}</p>
              </div>
            ) : <span />}
            <button onClick={scrollToMenu}
            className='flex items-center gap-1.5 rounded-full bg-[#C9D3A8] px-4 py-2.5 text-[13px] font-black text-[#26301C] shadow-lg transition active:scale-95'>
            اطلب الآن <Icon name="plus" size={14} strokeWidth={3} />
          </button>
          </div>
        </div>
      </div>
      )}

      {/* البحث */}
      {/* البحث */}
      <div className="relative mt-4">
        <Icon name="search" size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7C8665]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن مشروب أو حلوى…"
          className="h-12 w-full rounded-full border-2 border-[#D5DEB4] bg-white pr-11 pl-4 text-sm font-bold text-[#26301C] outline-none focus:border-[#7C8F52]" />
        {q && <button onClick={() => setQ('')} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7C8665]" aria-label="مسح"><Icon name="x" size={15} /></button>}
      </div>

      {/* الفئات + القوائم — دوائر */}
      <section className="mt-5">
        <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
          {items.map((c) => {
            const active = selMenu === null && cat === c.slug;
            return (
              <button key={c.slug} onClick={() => { setSelMenu(null); setCat(c.slug); jumpToMenu(); }} className="flex flex-none flex-col items-center gap-1.5 transition active:scale-95">
                <span className={`grid size-[62px] place-items-center overflow-hidden rounded-full shadow-md shadow-[#8a6a48]/15 transition-all ${active ? 'ring-2 ring-[#5C6B3C] ring-offset-2 ring-offset-[#F6E7C9]' : 'ring-1 ring-[#EAD3A0]'}`}>
                  {c.slug === 'all'
                    ? <span className='grid size-full place-items-center bg-gradient-to-br from-[#414D36] to-[#26301C] text-[#C9D3A8]'><Icon name='package' size={20} /></span>
                    : <img src={CAT_IMAGES[c.slug] ?? '/img/latte.jpg'} alt={c.name_ar} className='size-full object-cover' loading='lazy' />}
                </span>
                <span className={`text-[11px] font-extrabold ${active ? 'text-[#26301C]' : 'text-[#7C8665]'}`}>{c.name_ar}</span>
              </button>
            );
          })}
          {/* القوائم التي بناها صاحب المحل */}
          {menuLists.map((m) => {
            const active = selMenu === m.id;
            return (
              <button key={'menu-' + m.id} onClick={() => { setSelMenu(active ? null : m.id); jumpToMenu(); }} className="flex flex-none flex-col items-center gap-1.5 transition active:scale-95">
                <span className={`grid size-[62px] place-items-center overflow-hidden rounded-full shadow-md shadow-[#8a6a48]/15 transition-all ${active ? 'ring-2 ring-[#B07C3A] ring-offset-2 ring-offset-[#F6E7C9]' : 'ring-1 ring-[#EAD3A0]'}`}>
                  {m.image_url
                    ? <img src={m.image_url} alt={m.title} className='size-full object-cover' loading='lazy' />
                    : <span className='grid size-full place-items-center bg-gradient-to-br from-[#7A5A22] to-[#5C4318] text-xl'>{m.emoji || '☕'}</span>}
                </span>
                <span className={`text-[11px] font-extrabold ${active ? 'text-[#7A5A22]' : 'text-[#7C8665]'}`}>{m.title}</span>
              </button>
            );
          })}
        </div>
      </section>


      {/* الأكثر طلبًا — بطاقات أفقية */}
      {!searching && mostOrdered.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-3 flex items-center gap-1.5 text-[17px] font-black text-[#26301C]">
            <Icon name='star' size={15} filled className='text-[#B07C3A]' /> الأكثر طلبًا
          </h2>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {mostOrdered.map((p, i) => (
              <button key={p.id} onClick={() => openProduct(p as unknown as Product)}
                className='w-40 flex-none rounded-[1.4rem] bg-white p-2.5 text-right shadow-sm ring-1 ring-[#D5DEB4] transition hover:-translate-y-1 anim-rise'
                style={{ animationDelay: `${i * 35}ms` }}>
                <div className="relative">
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
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* استكشف المنيو */}
      <section id='menu-section' className='mt-5'>
        <div className="mb-3 flex items-end justify-between px-1">
          <h2 className="text-[17px] font-black text-[#26301C]">{selMenuTitle ? selMenuTitle : 'استكشف المنيو'}</h2>
        </div>
        <div className="pb-4">
          {Array.from(byCat.entries()).map(([slug, catProducts]) => (
            <div key={slug} className="mb-6">
              <h3 className="mb-2 mt-4 text-[13px] font-extrabold text-[#7C8665] px-2">{catLabel(slug)}</h3>
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
                {catProducts.map((p) => (
                  <button key={p.id} onClick={() => openProduct(p)}
                    className="rounded-[1.75rem] bg-white p-2.5 text-right shadow-sm shadow-[#8a6a48]/15 ring-1 ring-[#D5DEB4] transition hover:-translate-y-1 hover:shadow-lg anim-rise">
                    <div className="relative">
                      <img src={p.image_url} alt={p.name_ar} loading="lazy" className={`h-28 w-full rounded-[1.3rem] object-cover ${p.is_available === false ? 'opacity-50 grayscale' : ''}`} />
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
                        {productMenuMap.get(p.id) && <p className="truncate text-[9.5px] font-bold text-[#B07C3A]">{productMenuMap.get(p.id)}</p>}
                        <h3 className="truncate text-[13px] font-extrabold text-[#26301C]">{p.name_ar}</h3>
                        <p className="mt-0.5 text-[13px] font-black text-[#26301C]">
                          {hasOffer(p) ? <><span className="text-[11px] font-bold text-neutral-400 line-through">{eur(p.price_cents, cur)}</span> {eur(effPrice(p), cur)}</> : eur(p.price_cents, cur)}
                        </p>
                      </div>
                      <span className="grid size-9 flex-none place-items-center rounded-full bg-white shadow-md">
                        <Icon name="plus" size={15} className="text-[#26301C]" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {cat !== "all" && (
          <p className="pb-2 text-center text-[11px] text-[#94826A]">عرض فئة: {catalog?.categories?.find((c) => c.slug === cat)?.name_ar}</p>
        )}
      </section>
    </div>
  );
}

/* ============================ تفاصيل المنتج — ملء الشاشة مع الخيارات ============================ */
function ProductSheet({ product, catalog, onClose, onAdd, onOrderNow, isFav, onToggleFav }: {
  product: Product; catalog: Catalog | null; onClose: () => void;
  onAdd: (line: CartLine) => void; onOrderNow: (line: CartLine) => void;
  isFav: boolean; onToggleFav: (id: number) => void;
}) {
  const [qty, setQty] = useState(1);
  const [opts, setOpts] = useState<string[]>([]);
  const prodAdds = (catalog?.additions ?? []).filter((a) => (a.product_ids ?? []).includes(product.id));
  const [addIds, setAddIds] = useState<number[]>([]);
  const pickedAdds = prodAdds.filter((a) => addIds.includes(a.id));
  const addUnit = (x: any) => {
    const mode = x.price_mode === 'subtract' || (x.price_mode === undefined && /(كوب\s*صغير|small\s*cup)/i.test(x.name_ar ?? ''))
      ? 'subtract' : 'add';
    return mode === 'subtract' ? -Math.abs(x.price_cents) : x.price_cents;
  };
  const lineTotal = effPrice(product) + pickedAdds.reduce((a, x) => a + addUnit(x), 0);
  const cur = catalog?.settings?.currency_symbol ?? 'ل.س';
  const options = ((product as any).options || '').split(',').map((o: string) => o.trim()).filter(Boolean);
  const toggle = (o: string) => setOpts((os) => (os.includes(o) ? os.filter((x) => x !== o) : [...os, o]));

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white anim-rise">
      <div className="relative h-[42vh] min-h-56 flex-none overflow-hidden">
        <img src={product.image_url} alt={product.name_ar} className="size-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />
        <button onClick={() => onToggleFav(product.id)}
          className="absolute top-4 left-4 grid size-11 place-items-center rounded-full bg-white shadow-lg transition active:scale-90" aria-label="المفضلة">
          <Icon name="heart" size={19} filled={isFav} className={isFav ? 'text-[#C4482E]' : 'text-[#26301C]'} />
        </button>
        <button onClick={onClose}
          className="absolute top-4 right-4 grid size-11 place-items-center rounded-full bg-white shadow-lg transition active:scale-90"
          style={{ color: '#26301C' }} aria-label="رجوع">
          <Icon name="chevron" size={20} />
        </button>
        <div className="absolute bottom-5 left-5 flex items-center gap-2">
          {hasOffer(product) && <span className="rounded-full bg-[#C4482E] px-3 py-1.5 text-[11px] font-black text-white shadow-lg">عرض</span>}
          <span className="rounded-full bg-[#C9D3A8] px-5 py-2.5 text-xl font-black shadow-xl" style={{ color: '#26301C' }}>
            {hasOffer(product)
              ? <><span className="text-sm font-bold text-[#414D36] line-through">{eur(product.price_cents, cur)}</span> {eur(lineTotal, cur)}</>
              : eur(lineTotal, cur)}
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-40 pt-5">
        <h2 className="text-[26px] font-black leading-tight text-[#26301C]">{product.name_ar}</h2>
        <p className="mt-1 text-xs font-bold uppercase tracking-[.14em] text-[#7C8665]">{product.name_en}</p>

        {options.length > 0 && (
          <div className="mt-5">
            <h3 className="text-[15px] font-black text-[#26301C]">اطلبها على ذوقك</h3>
            <p className="mt-0.5 text-[11px] font-bold text-[#7C8665]">اختياري — اختر ما يناسب ذوقك</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {options.map((o) => {
                const on = opts.includes(o);
                return (
                  <button key={o} onClick={() => toggle(o)}
                    className={`flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-[13px] font-extrabold transition active:scale-95 ${
                      on ? 'border-[#5C6B3C] bg-[#C9D3A8]/40 text-[#26301C]' : 'border-[#D5DEB4] bg-[#EEF2DC] text-[#6B7357]'}`}>
                    {on && <Icon name="check" size={13} strokeWidth={2.6} />}
                    {o}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {prodAdds.length > 0 && (
          <div className="mt-5">
            <h3 className="text-[15px] font-black text-[#26301C]">أضف عليها 🍯</h3>
            <p className="mt-0.5 text-[11px] font-bold text-[#7C8665]">اختياري — تُضاف قيمتها على السعر</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {prodAdds.map((a) => {
                const on = addIds.includes(a.id);
                return (
                  <button key={a.id} onClick={() => setAddIds((ids) => (on ? ids.filter((x) => x !== a.id) : [...ids, a.id]))}
                    className={`flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-[13px] font-extrabold transition active:scale-95 ${
                      on ? 'border-[#5C6B3C] bg-[#C9D3A8]/40 text-[#26301C]' : 'border-[#D5DEB4] bg-[#EEF2DC] text-[#6B7357]'
                    }`}>
                    {on && <Icon name="check" size={13} strokeWidth={2.6} />}
                    {a.name_ar} <span className="text-[11px] font-black text-[#7A5A22]">+{eur(a.price_cents, cur)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-5 rounded-[1.4rem] p-4" style={{ background: '#EEF2DC' }}>
          <p className="text-[11px] font-extrabold text-[#5C6B3C]">الوصف</p>
          <p className="mt-1.5 text-sm leading-relaxed text-[#333D25]">
            {product.description_ar || 'مميز من Dose Cafe'}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between pb-2">
          <div>
            <p className="text-[11px] font-extrabold text-[#5C6B3C]">الكمية</p>
            <p className="mt-0.5 text-2xl font-black text-[#26301C]">{qty}</p>
          </div>
          <div className="flex items-center gap-3.5" dir="ltr">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}
              className="grid size-12 place-items-center rounded-full text-xl font-black shadow-md transition active:scale-90 disabled:opacity-40"
              style={{ background: '#E3E9C8', color: '#26301C' }}>−</button>
            <button onClick={() => setQty((q) => Math.min(50, q + 1))}
              className="grid size-12 place-items-center rounded-full text-xl font-black text-white shadow-md transition active:scale-90"
              style={{ background: '#26301C' }}>+</button>
          </div>
        </div>
      </div>

      <div className="flex-none bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_32px_-18px_rgba(38,48,28,.35)]">
        {product.is_available === false ? (
          <div className="rounded-[1.6rem] bg-[#FBEDE9] p-4 text-center">
            <p className="text-sm font-black text-[#C4482E]">😔 نفذت كمية هذا المنتج حاليًا</p>
            <p className="mt-1 text-[11px] font-bold text-[#A05B47]">يتوفر قريبًا — جرّب مشروبًا أو حلوى أخرى من المنيو</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => onAdd({ product, qty, options: opts, additions: pickedAdds.map((a) => ({ id: a.id, name_ar: a.name_ar, price_cents: a.price_cents, price_mode: a.price_mode })) })}
              className="rounded-full border-2 border-[#C9D3A8] py-4 text-sm font-black text-[#26301C] transition active:scale-[.98]">
              أضف إلى السلة
            </button>
            <button onClick={() => onOrderNow({ product, qty, options: opts, additions: pickedAdds.map((a) => ({ id: a.id, name_ar: a.name_ar, price_cents: a.price_cents, price_mode: a.price_mode })) })}
              className="rounded-full bg-gradient-to-l from-[#C9D3A8] to-[#A9B87F] py-4 text-sm font-black text-[#26301C] shadow-lg shadow-[#8a6a48]/35 transition active:scale-[.98]">
              اطلب الآن
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ صفحة السلة ============================ */
function CartPage({ lines, setQty, remove, onOrder, onBrowse }: {
  lines: CartLine[];
  setQty: (i: number, q: number) => void;
  remove: (i: number) => void;
  onOrder: () => void;
  onBrowse: () => void;
}) {
  const cur = 'ل.س';
  const total = lines.reduce((a, l) => a + lineUnit(l) * l.qty, 0);
  const points = lines.reduce((a, l) => a + l.product.points * l.qty, 0);

  if (!lines.length) return (
    <div className="grid place-items-center py-20 text-center anim-rise">
      <span className="mx-auto grid size-16 place-items-center rounded-[1.4rem] bg-[#E3E9C8] text-[#5C6B3C]"><Icon name="cart" size={26} /></span>
      <h3 className="mt-4 text-base font-extrabold text-[#26301C]">سلتك فارغة</h3>
      <p className="mt-1 text-xs text-neutral-500">أضف مشروباتك وحلوياتك المفضلة من القائمة</p>
      <button onClick={onBrowse} className="mt-5 rounded-full bg-[#C9D3A8] px-9 py-3 text-sm font-black text-[#26301C] shadow-md active:scale-95">تصفح القائمة</button>
    </div>
  );

  return (
    <div className="space-y-3 pb-4 anim-rise">
      {lines.map((l, i) => (
        <div key={i} className="flex items-center gap-3.5 rounded-[1.5rem] bg-white p-3 shadow-sm ring-1 ring-[#D5DEB4]">
          <img src={l.product.image_url} alt="" className="size-20 flex-none rounded-[1.1rem] object-cover" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-extrabold text-[#26301C]">{l.product.name_ar}</h3>
            {(l.options || []).length > 0 && <p className="mt-0.5 truncate text-[10.5px] font-bold text-[#5C6B3C]">✓ {l.options.join('، ')}</p>}
            {(l.additions ?? []).length > 0 && <p className="mt-0.5 truncate text-[10.5px] font-bold text-[#7A5A22]">🍯 {(l.additions ?? []).map((a) => a.name_ar).join('، ')}</p>}
            <p className="mt-1 text-sm font-black text-[#26301C]">
              {hasOffer(l.product) ? <><span className="text-xs font-bold text-neutral-400 line-through">{eur(lineUnit(l) * l.qty, cur)}</span> {eur(lineUnit(l) * l.qty, cur)}</> : eur(lineUnit(l) * l.qty, cur)}
            </p>
          </div>
          <div className="flex flex-none items-center gap-2.5" dir="ltr">
            <button onClick={() => setQty(i, l.qty - 1)} disabled={l.qty <= 1}
              className="grid size-8 place-items-center rounded-full border-2 border-[#C9D3A8] text-sm font-black text-[#26301C] disabled:opacity-30">−</button>
            <span className="w-5 text-center text-sm font-black text-[#26301C]">{l.qty}</span>
            <button onClick={() => setQty(i, l.qty + 1)}
              className="grid size-8 place-items-center rounded-full bg-[#C9D3A8] text-sm font-black text-[#26301C]">+</button>
          </div>
          <button onClick={() => remove(i)} className="grid size-9 flex-none place-items-center rounded-full bg-red-50 text-red-500 transition active:scale-90" aria-label="حذف">
            <Icon name="trash" size={15} />
          </button>
        </div>
      ))}
      <div className="rounded-[1.5rem] bg-[#E3E9C8] p-4 text-center">
        <p className="text-[11px] font-bold text-[#6B7357]">الإجمالي · ستكسب ⭐ {points} نقطة</p>
        <p className="mt-1 text-2xl font-black text-[#26301C]">{eur(total, cur)}</p>
      </div>
      <button onClick={onOrder} className="w-full rounded-full bg-[#C9D3A8] py-4 text-base font-black text-[#26301C] shadow-lg shadow-[#8a6a48]/35 transition active:scale-[.98]">
        اطلب الآن
      </button>
    </div>
  );
}


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
        <div key={p.id} className="flex items-center gap-3.5 rounded-[1.5rem] bg-white p-3 shadow-sm ring-1 ring-[#D5DEB4] anim-rise" style={{ animationDelay: `${i * 25}ms` }}>
          <button onClick={() => openProduct(p)} className="flex min-w-0 flex-1 items-center gap-3.5 text-right">
            <img src={p.image_url} alt="" className="size-16 flex-none rounded-[1rem] object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold text-[#26301C]">{p.name_ar}</span>
              <span className="mt-0.5 block text-sm font-black text-[#5C6B3C]">
                {hasOffer(p) ? <><span className="text-[11px] font-bold text-neutral-400 line-through">{eur(p.price_cents)}</span> {eur(effPrice(p))}</> : eur(p.price_cents)}
              </span>
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

/* ============================ استبدل نقاطك ============================ */
function RewardsPage({ catalog, myData, session, onRedeem }: any) {
  const [confirming, setConfirming] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  if (!session) return <NeedLogin />;
  return (
    <div className="anim-rise">
      <div className="rounded-[2rem] bg-gradient-to-bl from-[#414D36] to-[#23291B] p-6 text-center text-white shadow-xl shadow-[#8a6a48]/40">
        <p className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#C9D3A8]"><Icon name="star" size={13} filled /> رصيد نقاطك</p>
        <p className="mt-1 text-5xl font-black">{myData?.customer?.points ?? session.customer.points}</p>
        {(() => {
          const exp = myData?.customer?.points_expires_at;
          if (!exp) return null;
          return <p className="mt-2 text-[11px] font-extrabold text-[#EAC98F]">⏳ النقاط صالحة إلى التاريخ: {fmtDateNum(exp)}</p>;
        })()}
        <p className="mt-1 text-[11px] text-white/70">استبدل نقاطك بمشروبات وحلويات مجانية</p>
      </div>
      <div className="mt-5 space-y-3">
        {catalog?.rewards?.map((r: any, i: number) => {
          const can = (myData?.customer?.points ?? session.customer.points) >= r.points_cost;
          return (
            <div key={r.id} className="flex items-center gap-4 py-2 anim-rise" style={{ animationDelay: `${i * 30}ms` }}>
<img src={r.image_url} alt={r.name_ar} loading="lazy" className="size-[72px] flex-none rounded-[1.3rem] object-cover shadow-md shadow-[#8a6a48]/25" />
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-extrabold text-[#26301C]">{r.name_ar}</h3>
                <p className="mt-0.5 flex items-center gap-1 text-sm font-black text-[#7C8F52]">
                  <Icon name="star" size={13} filled /> {r.points_cost} نقطة
                </p>
                {r.expires_at && <p className="mt-1 text-[11px] font-extrabold text-amber-700">📅 صالح حتى: {fmtDateNum(r.expires_at)}</p>}
              </div>
              <button disabled={!can || busy} onClick={() => setConfirming(r)}
                className={`rounded-full px-5 py-2.5 text-sm font-black transition active:scale-95 ${can ? 'bg-[#C9D3A8] text-[#26301C] shadow-md shadow-[#8a6a48]/30' : 'bg-[#E3E9C8] text-[#7C8665]'}`}>
                {can ? 'استبدال' : 'غير كافية'}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-5 flex items-center justify-center gap-2 rounded-[1.4rem] border-2 border-dashed border-[#C9A96A] bg-[#F6E7C9]/70 px-4 py-3.5 text-center text-[11.5px] font-black leading-relaxed text-[#8A6A48]">
        <Icon name="store" size={15} className="flex-none" />
        المكافأة تُصرف ضمن المحل حصرًا
      </p>

      {confirming && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4 backdrop-blur-sm anim-fade" onClick={() => setConfirming(null)}>
          <div className="w-full max-w-sm rounded-[2rem] bg-white p-6 text-center shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
            <img src={confirming.image_url} alt="" className="mx-auto size-24 rounded-[1.5rem] object-cover shadow-lg" />
            <h3 className="mt-4 text-base font-extrabold leading-relaxed text-[#26301C]">هل تريد استبدال {confirming.points_cost} نقطة مقابل {confirming.name_ar}؟</h3>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button disabled={busy} onClick={async () => { setBusy(true); await onRedeem(confirming); setBusy(false); setConfirming(null); }}
                className="rounded-full bg-[#C9D3A8] py-3 text-sm font-black text-[#26301C] shadow-md active:scale-95 disabled:opacity-50">تأكيد الاستبدال</button>
              <button onClick={() => setConfirming(null)} className="rounded-full bg-neutral-100 py-3 text-sm font-black text-neutral-600 active:scale-95">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const NeedLogin = () => (
  <div className="grid place-items-center py-20 text-center anim-rise">
    <span className="mx-auto grid size-16 place-items-center rounded-[1.4rem] bg-[#E3E9C8] text-[#5C6B3C]"><Icon name="lock" size={26} /></span>
    <h3 className="mt-4 text-base font-extrabold text-[#26301C]">سجّل دخولك للمتابعة</h3>
    <p className="mt-1 text-xs text-neutral-500">برقم هاتفك ورمز PIN</p>
    <Link to="/login" className="mt-5 rounded-full bg-[#C9D3A8] px-9 py-3 text-sm font-black text-[#26301C] shadow-md active:scale-95">تسجيل الدخول</Link>
  </div>
);

const statusInfo = (s: string) => {
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: 'قيد المراجعة', color: 'bg-amber-100 text-amber-800' },
    confirmed: { label: 'مؤكد', color: 'bg-blue-100 text-blue-800' },
    preparing: { label: 'قيد التحضير', color: 'bg-orange-100 text-orange-800' },
    ready: { label: 'مكتمل', color: 'bg-emerald-100 text-emerald-800' },
    out_for_delivery: { label: 'جاري التوصيل', color: 'bg-indigo-100 text-indigo-800' },
    completed: { label: 'تم التسليم', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700' },
  };
  return map[s] ?? { label: s, color: 'bg-neutral-100 text-neutral-600' };
};

/* ============================ الطلبات ============================ */
/** الوقت المقدّر — يُعرض فقط للطلبات الجارية */
const etaLabel = (o: MyOrder, orderTimeMin = 0): string | null => {
  // الحالة «مكتمل» أو ما بعدها لا تحتاج وقتًا مقدّرًا
  if (!['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(o.status)) return null;
  // الدقائق حسب أوقات الأصناف عند طلب المنتج أو «وقت الطلب» الذي ضبطه المالك
  const itemEta = Math.max(0, ...((o.items ?? []) as any[]).map((it: any) => Number(it.eta_minutes) || 0));
  const setEta = Math.max(itemEta, Math.max(0, Number(orderTimeMin) || 0));
  if (setEta > 0) return `${setEta} دقيقة`;
  if (o.eta_minutes && o.eta_minutes > 0) return `${o.eta_minutes} دقيقة`;
  // احتياط: نُحسب من وقت الوصول المخزّن
  if (o.estimated_delivery_at) {
    const mins = Math.max(1, Math.round((new Date(o.estimated_delivery_at).getTime() - Date.now()) / 60000));
    return `${mins} دقيقة`;
  }
  return null;
};

/** الساعة المتوقّعة (أدنى تقدير) لتسهيل متابعة الزبون */
const etaClock = (o: MyOrder, orderTimeMin = 0): string | null => {
  if (!['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(o.status)) return null;
  if (o.estimated_delivery_at) {
    const d = new Date(o.estimated_delivery_at);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const itemEta = Math.max(0, ...((o.items ?? []) as any[]).map((it: any) => Number(it.eta_minutes) || 0));
  const setEta = Math.max(itemEta, Math.max(0, Number(orderTimeMin) || 0));
  if (setEta > 0) {
    const d = new Date(Date.now() + setEta * 60000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return null;
};

/** سطر تفصيل: التسمية يمينًا والقيمة يسارًا */
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-dashed border-[#C4CF9E]/70 py-[7px] last:border-0">
      <span className="flex-none text-[11px] font-bold text-[#7C8665]">{label}</span>
      <span className="min-w-0 text-left text-[12px] font-extrabold text-[#26301C]">{value}</span>
    </div>
  );
}

function OrderCard({ o, cur, orderTimeMin }: { o: MyOrder; cur: string; orderTimeMin?: number }) {
  const [open, setOpen] = useState(false);
  const qty = o.items.reduce((a, it) => a + (Number(it.qty) || 0), 0);
  const eta = etaLabel(o, orderTimeMin);
  const clock = etaClock(o, orderTimeMin);
  const addNames = (it: OrderItem) =>
    (it.additions ?? []).map((a: any) => `${a.name_ar ?? 'إضافة'} +${eur(a.price_cents ?? 0, cur)}`).join('، ');
  return (
    <div className="overflow-hidden rounded-[1.75rem] bg-[#E3E9C8] shadow-sm">
      {/* رأس البطاقة */}
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-black text-[#26301C]">
            <span className="grid size-8 place-items-center rounded-xl bg-white/80 text-[#5C6B3C]"><Icon name="receipt" size={15} /></span>
            طلب #{o.order_number}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${statusInfo(o.status).color}`}>{statusInfo(o.status).label}</span>
        </div>
        <p className="mt-1.5 text-[11.5px] font-bold text-[#6B7357]">
          {o.items.length} صنف · {qty} قطعة · {eur(o.total_cents, cur)}
        </p>
        <button onClick={() => setOpen((v) => !v)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-white py-2.5 text-[12px] font-black text-[#26301C] shadow-sm transition active:scale-[.98]"
          aria-expanded={open}>
          <Icon name={open ? 'chevron' : 'eye'} size={13} className={open ? 'rotate-180 transition' : 'transition'} />
          {open ? 'إخفاء التفاصيل' : 'عرض الطلب'}
        </button>
      </div>

      {/* تفاصيل الطلب */}
      {open && (
        <div className="border-t border-dashed border-[#C4CF9E] px-4 pb-4 pt-1 anim-rise">
          <DetailRow label="تاريخ الطلب" value={<span dir="ltr">{fmtDateTimeNum(o.created_at)}</span>} />
          <DetailRow label="طريقة الاستلام" value={
            <span className="flex items-center gap-1">
              <Icon name={o.fulfillment_type === 'delivery' ? 'pin' : 'home'} size={11} />
              {o.fulfillment_type === 'delivery' ? 'توصيل' : 'استلام من المحل'}
            </span>} />
          {eta && <DetailRow label="الوقت المقدّر" value={
            <span className="flex flex-col items-end leading-tight">
              <span className="flex items-center gap-1 font-black text-[#5C6B3C]"><Icon name="clock" size={11} />{eta}</span>
              {clock && <span className="text-[10.5px] font-bold text-[#7C8F52]" dir="ltr">≈ {clock}</span>}
            </span>} />}
          {o.status === 'completed' && o.completed_at && (
            <DetailRow label="وقت التسليم" value={<span dir="ltr">{fmtDateTimeNum(o.completed_at)}</span>} />
          )}
          {o.customer_name && <DetailRow label="اسم العميل" value={o.customer_name} />}
          {o.customer_phone && <DetailRow label="هاتف العميل" value={
            <a href={`tel:${o.customer_phone}`} className="flex items-center gap-1" dir="ltr"><Icon name="phone" size={11} />{o.customer_phone}</a>} />}
          {o.fulfillment_type === 'delivery' && o.delivery_map_url && (
            <DetailRow label="موقع التوصيل" value={
              <a href={o.delivery_map_url} target="_blank" rel="noopener" className="flex items-center gap-1 text-[#5C6B3C] underline">
                <Icon name="pin" size={11} />فتح الخريطة
              </a>} />
          )}
          {/* الأصناف — كل صنف بسطر */}
          <p className="mb-1 mt-3 text-[11px] font-black text-[#5C6B3C]">الأصناف ({o.items.length})</p>
          <div className="space-y-2">
            {o.items.map((it: OrderItem, i) => {
              const adds = addNames(it);
              const line = it.unit_price_cents * (Number(it.qty) || 0);
              return (
                <div key={i} className="rounded-2xl bg-white/70 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 text-[12.5px] font-extrabold text-[#26301C]">• {it.name_ar} × {it.qty}</span>
                    <span className="flex-none text-[12px] font-black text-[#26301C]">{eur(line, cur)}</span>
                  </div>
                  {it.options && <p className="mt-0.5 ps-3 text-[10.5px] font-bold text-[#7C8665]">↳ خيارات: {it.options}</p>}
                  {adds && <p className="mt-0.5 ps-3 text-[10.5px] font-bold text-[#7C8665]">🍯 ↳ {adds}</p>}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-[#C4CF9E] pt-2.5">
            <span className="text-[12px] font-black text-[#26301C]">الإجمالي</span>
            <span className="text-[15px] font-black text-[#26301C]">{eur(o.total_cents, cur)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function OrdersPage({ myData, session, catalog }: { myData: MyData | null; session: Session | null; catalog?: Catalog | null }) {
  if (!session) return <NeedLogin />;
  const orders = myData?.orders ?? [];
  const cur = catalog?.settings?.currency_symbol ?? 'ل.س';
  const orderTimeMin = Math.max(0, parseInt(catalog?.settings?.order_time_minutes || '0', 10) || 0);
  return (
    <div className="space-y-3 pb-4 anim-rise">
      {orders.length === 0 && (
        <div className="py-20 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-[1.4rem] bg-[#E3E9C8] text-[#5C6B3C]"><Icon name="receipt" size={26} /></span>
          <p className="mt-4 text-sm font-bold text-neutral-500">لا توجد طلبات بعد</p>
        </div>
      )}
      {orders.map((o) => <OrderCard key={o.id} o={o} cur={cur} orderTimeMin={orderTimeMin} />)}
    </div>
  );
}

/* ============================ الإشعارات ============================ */
function NotificationsPage({ myData, session, onSeen, onDeleteNotif }: {
  myData: MyData | null; session: Session | null; onSeen: () => void; onDeleteNotif: (id: number) => void;
}) {
  useEffect(() => { onSeen(); }, []);
  if (!session) return <NeedLogin />;
  const items = myData?.notifications ?? [];
  return (
    <div className="space-y-2.5 pb-4 anim-rise">
      {items.length === 0 && (
        <div className="py-16 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-[1.4rem] bg-[#E3E9C8] text-[#5C6B3C]"><Icon name="bell" size={26} /></span>
          <p className="mt-4 text-sm font-bold text-neutral-500">لا توجد إشعارات حاليًا</p>
        </div>
      )}
      {items.map((n) => (
        <div key={n.id} className={`flex items-start gap-2.5 rounded-[1.5rem] p-4 ${n.is_read ? 'bg-white/70' : 'bg-[#E3E9C8] shadow-sm'}`}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-[#26301C]">{n.title}</p>
            {n.body && <p className="mt-1 text-xs leading-relaxed text-[#6B7357]">{n.body}</p>}
            <span className="mt-1 block text-[10px] font-bold text-[#7C8665]">{fmtDateTime(n.created_at)}</span>
          </div>
          <button onClick={() => onDeleteNotif(n.id)}
            className="grid size-9 flex-none place-items-center rounded-full bg-white/80 text-[#C4482E] transition active:scale-90" aria-label="حذف الإشعار">
            <Icon name="trash" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
const AccountRow = ({ icon, label, onClick, badge, danger }: { icon: IconName; label: string; onClick: () => void; badge?: number; danger?: boolean }) => (
  <button onClick={onClick} className="flex w-full items-center justify-between rounded-[1.4rem] bg-[#E3E9C8] p-4 transition active:scale-[.98]">
    <span className={`flex items-center gap-3 text-sm font-extrabold ${danger ? 'text-[#C4482E]' : 'text-[#26301C]'}`}>
      <span className={`grid size-10 place-items-center rounded-2xl bg-white shadow-sm ${danger ? 'text-[#C4482E]' : 'text-[#5C6B3C]'}`}><Icon name={icon} size={18} /></span>
      {label}
    </span>
    <span className="flex items-center gap-2">
      {badge ? <span className="rounded-full bg-[#C9D3A8] px-2 py-0.5 text-[10px] font-black text-[#26301C]">{badge}</span> : null}
      <span className="text-[#A9B87F]"><Icon name="chevron" size={16} /></span>
    </span>
  </button>
);

function CodesPage({ myData, session }: { myData: MyData | null; session: Session | null }) {
  if (!session) return <NeedLogin />;
  return (
    <div className="anim-rise">
      <MyCodes redemptions={myData?.redemptions ?? []} />
    </div>
  );
}

function MyCodes({ redemptions }: { redemptions: Redemption[] }) {
  return (
    <div className="mt-6 anim-rise">
      <h3 className="mb-3 text-base font-black text-[#26301C]">أكواد مكافآتك</h3>
      {redemptions.length === 0 && <p className="rounded-[1.5rem] bg-[#E3E9C8] p-6 text-center text-xs font-bold text-[#7C8665]">لا توجد استبدالات بعد — اجمع النقاط واستبدلها من «استبدل نقاطك»</p>}
      <div className="space-y-2.5">
        {redemptions.map((r) => (
          <div key={r.code} className="flex items-center justify-between rounded-[1.5rem] bg-[#E3E9C8] p-4">
            <div>
              <p className="text-sm font-extrabold text-[#26301C]">{r.reward_name}</p>
              <p className="mt-0.5 text-[11px] text-[#7C8665]">{fmtDateTime(r.created_at)}</p>
            </div>
            <div className="text-center">
              <p className="rounded-2xl bg-[#26301C] px-3.5 py-2 font-mono text-base font-black tracking-widest text-[#C9D3A8]" dir="ltr">{r.code}</p>
              <p className={`mt-1 text-[10px] font-extrabold ${r.status === 'unused' ? 'text-[#6B7A45]' : 'text-[#7C8665]'}`}>
                {r.status === 'unused' ? 'غير مستعمل' : r.status === 'used' ? 'مستعمل' : 'منتهي'}
              </p>
              {r.status === 'unused' && (r.expires_at || (r as any).reward_expires_at) && <p className="mt-0.5 text-[9.5px] font-bold text-[#A05B47]">صالحة حتى {fmtDateNum(r.expires_at || (r as any).reward_expires_at)}</p>}
            </div>
          </div>
        ))}
      </div>
      {redemptions.length > 0 && (
        <p className="mt-4 flex items-center justify-center gap-2 rounded-[1.4rem] border-2 border-dashed border-[#C9A96A] bg-[#F6E7C9]/70 px-4 py-3.5 text-center text-[11.5px] font-black leading-relaxed text-[#8A6A48]">
          <Icon name="store" size={15} className="flex-none" />
          هذا الكود يُستخدم ضمن المحل حصرًا
        </p>
      )}
    </div>
  );
}

function AccountPage({ session, myData, waNumber, pushEnabled, onTogglePush, onLogout, onRename }: {
  session: Session; myData: MyData | null; waNumber: string; pushEnabled: boolean; onTogglePush: () => void; onLogout: () => void;
  onRename: (name: string) => Promise<void>;
}) {
  const [showCodesUnused, setShowCodesUnused] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const c = myData?.customer ?? session.customer;
  const redemptions = myData?.redemptions ?? [];
  const unread = (myData?.notifications ?? []).filter((n) => !n.is_read).length;
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(c.full_name);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMsg, setNameMsg] = useState('');
  return (
    <div className="anim-rise">
      <div className="rounded-[2rem] bg-gradient-to-bl from-[#414D36] to-[#23291B] p-6 text-center text-white shadow-xl shadow-[#8a6a48]/40">
        {/* صورة الملف الشخصي ثابتة — لوغو التطبيق */}
        <img src="/logo.jpg" alt="Dose Cafe" className="mx-auto size-20 rounded-full object-cover shadow-xl ring-4 ring-white/25" />
        <h2 className="mt-3 text-lg font-black">{c.full_name}</h2>
        {editingName ? (
          <div className="mt-2 flex items-center gap-2">
            <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={80}
              className="h-10 min-w-0 flex-1 rounded-full border-2 border-white/30 bg-white/15 px-4 text-center text-sm font-extrabold text-white outline-none placeholder:text-white/50 focus:border-white/60"
              placeholder="الاسم الجديد" />
            <button disabled={nameBusy || nameDraft.trim().length < 2}
              onClick={async () => {
                setNameBusy(true); setNameMsg('');
                try { await onRename(nameDraft.trim()); setEditingName(false); setNameMsg('تم تغيير الاسم ✓'); setTimeout(() => setNameMsg(''), 4000); }
                catch (e: any) { setNameMsg(e?.message || 'تعذر تغيير الاسم'); }
                finally { setNameBusy(false); }
              }}
              className="flex-none rounded-full bg-[#C9D3A8] px-4 py-2 text-xs font-black text-[#26301C] active:scale-95 disabled:opacity-50">حفظ</button>
            <button onClick={() => { setEditingName(false); setNameDraft(c.full_name); setNameMsg(''); }}
              className="flex-none rounded-full bg-white/20 px-4 py-2 text-xs font-black text-white active:scale-95">إلغاء</button>
          </div>
        ) : (
          <button onClick={() => { setNameDraft(c.full_name); setEditingName(true); setNameMsg(''); }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-[11px] font-black text-white transition active:scale-95">
            <Icon name="edit" size={12} /> تغيير الاسم
          </button>
        )}
        {nameMsg && <p className="mt-1.5 text-[11px] font-bold text-[#C9D3A8]">{nameMsg}</p>}
        <p className="mt-0.5 text-xs text-white/70" dir="ltr">{c.phone}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-white/10 py-3"><p className="text-xl font-black text-[#C9D3A8]">{c.points}</p><p className="text-[9px] font-bold text-white/60">{c.points_expires_at ? 'صالحة إلى ' + fmtDateNum(c.points_expires_at) : 'نقطة'}</p></div>
          <div className="rounded-3xl bg-white/10 py-3"><p className="text-xl font-black text-[#C9D3A8]">{c.orders_count}</p><p className="text-[10px] font-bold text-white/70">طلب</p></div>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        <AccountRow icon="receipt" label="الطلبات" onClick={() => _navRef?.('/orders')} />
        <AccountRow icon="gift" label="المكافآت" onClick={() => _navRef?.('/codes')} />
        <a href={waChatLink(waNumber, 'مرحبًا، أحتاج مساعدة من Dose Cafe')} target="_blank" rel="noopener"
          className="flex w-full items-center justify-between rounded-[1.4rem] bg-[#E3E9C8] p-4 transition active:scale-[.98]">
          <span className="flex items-center gap-3 text-sm font-extrabold text-[#26301C]">
            <span className="grid size-10 place-items-center rounded-2xl bg-white shadow-sm text-[#5C6B3C]"><Icon name="headset" size={18} /></span>
            المساعدة والدعم
          </span>
          <span className="text-[#A9B87F]"><Icon name="chevron" size={16} /></span>
        </a>
        <AccountRow icon="store" label="عن المحل" onClick={() => _navRef?.('/about')} />
        <AccountRow icon="bell" label="الإشعارات" badge={unread || undefined} onClick={() => _navRef?.('/notifications')} />
        <button onClick={onTogglePush}
          className="flex w-full items-center justify-between rounded-[1.4rem] bg-[#E3E9C8] p-4 transition active:scale-[.98]">
          <span className="flex items-center gap-3 text-sm font-extrabold text-[#26301C]">
            <span className="grid size-10 place-items-center rounded-2xl bg-white shadow-sm text-[#5C6B3C]">
              <Icon name={pushEnabled ? 'bell' : 'lock'} size={18} />
            </span>
            الإشعارات الفورية
          </span>
          <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${pushEnabled ? 'bg-[#7C8F52] text-white' : 'bg-white text-[#7C8665]'}`}>
            {pushEnabled ? 'مفعّلة — اضغط للتعطيل' : 'معطّلة — اضغط للتفعيل'}
          </span>
        </button>
        <button onClick={() => setConfirmLogout(true)}
          className="flex w-full items-center justify-between rounded-[1.4rem] bg-[#E3E9C8] p-4 transition active:scale-[.98]">
          <span className="flex items-center gap-3 text-sm font-extrabold text-[#C4482E]">
            <span className="grid size-10 place-items-center rounded-2xl bg-white shadow-sm text-[#C4482E]"><Icon name="logout" size={18} /></span>
            تسجيل الخروج
          </span>
          <span className="text-[#A9B87F]"><Icon name="chevron" size={16} /></span>
        </button>
      </div>


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

let _navRef: ((to: string) => void) | null = null;

/* ============================ الدخول / التسجيل ============================ */
function LoginPage({ onLogged }: { onLogged: (s: Session) => void }) {
  const nav = useNavigate();
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    setBusy(true); setErr('');
    try {
      const s = await rpc<Session>('customer_login', { p_phone: phone.replace(/\D/g, ''), p_pin: null });
      onLogged(s);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-sm py-10 anim-rise">
      <div className="rounded-[2rem] bg-white p-7 shadow-xl shadow-[#8a6a48]/15">
        <div className="text-center"><Logo size={60} /></div>
        <h2 className="mt-4 text-center text-xl font-black text-[#26301C]">تسجيل الدخول</h2>
        <p className="mt-1 text-center text-xs text-neutral-500">أدخل رقم هاتفك المسجّل للمتابعة</p>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" dir="ltr" placeholder="09XXXXXXXX"
          className="mt-5 h-12 w-full rounded-2xl border-2 border-[#D5DEB4] bg-[#EEF2DC] px-4 text-center text-base font-bold tracking-widest text-[#26301C] outline-none focus:border-[#A9B87F]" />
        {err && <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-600">{err}</p>}
        <button onClick={submit} disabled={busy || phone.replace(/\D/g, '').length < 8}
          className="mt-5 w-full rounded-full bg-[#C9D3A8] py-3.5 text-base font-black text-[#26301C] shadow-lg shadow-[#8a6a48]/35 active:scale-[.98] disabled:opacity-40">
          {busy ? 'جارٍ الدخول…' : 'دخول'}
        </button>
        <div className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/70 py-3 ring-1 ring-[#D5DEB4]">
          <span className="text-sm font-bold text-[#414D36]">ليس لديك حساب؟</span>
          <button onClick={() => nav('/signup')} className="rounded-full bg-[#26301C] px-4 py-1.5 text-sm font-black text-[#E9EDD6] shadow transition active:scale-95">أنشئ حسابك الآن</button>
        </div>
      </div>
    </div>
  );
}

function SignupPage({ onLogged }: { onLogged: (s: Session) => void }) {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    setErr('');
    if (name.trim().length < 2) return setErr('أدخل اسمك الكامل');
    if (phone.replace(/\D/g, '').length < 8) return setErr('أدخل رقم هاتف صحيح');
    setBusy(true);
    try {
      await rpc('create_customer', { p_full_name: name.trim(), p_phone: phone.replace(/\D/g, ''), p_device_id: deviceId });
      const s = await rpc<Session>('customer_login', { p_phone: phone.replace(/\D/g, ''), p_pin: null }).catch(() => null);
      if (s?.token) onLogged(s);
      else nav('/login');
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-sm py-8 anim-rise">
      <div className="rounded-[2rem] bg-white p-7 shadow-xl shadow-[#8a6a48]/15">
        <div className="text-center">
          <img src="/logo.jpg" alt="Dose" className="mx-auto size-16 rounded-2xl object-cover shadow-md ring-2 ring-white" />
        </div>
        <h2 className="mt-4 text-center text-xl font-black text-[#26301C]">مرحبًا بك في <span className="text-[#5C6B3C]">Dose Cafe</span></h2>
        <p className="mt-1 text-center text-xs text-neutral-500">أنشئ حسابك الآن واستمتع بالنقاط والمكافآت</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل"
          className="mt-4 h-12 w-full rounded-2xl border-2 border-[#D5DEB4] bg-[#EEF2DC] px-4 text-sm font-bold outline-none focus:border-[#A9B87F]" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" dir="ltr" placeholder="09XXXXXXXX"
          className="mt-3 h-12 w-full rounded-2xl border-2 border-[#D5DEB4] bg-[#EEF2DC] px-4 text-center text-sm font-bold outline-none focus:border-[#A9B87F]" />
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-[#EEF2DC] px-3 py-2.5 text-[11px] leading-relaxed text-[#7C8665]">
          <Icon name="lock" size={13} className="mt-0.5 flex-none" style={{ color: '#A9907E' }} />
          يُستخدم رقم هاتفك للتحقق من هويتك عند الطلب
        </p>
        {err && <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-600">{err}</p>}
        <button onClick={submit} disabled={busy}
          className="mt-4 w-full rounded-full bg-[#C9D3A8] py-3.5 text-base font-black text-[#26301C] shadow-lg shadow-[#8a6a48]/35 active:scale-[.98] disabled:opacity-50">
          {busy ? 'جارٍ الإنشاء…' : 'إنشاء الحساب والمتابعة'}
        </button>
        <button onClick={() => nav('/login')} className="mt-3 w-full py-2 text-center text-sm font-bold text-neutral-500">إلغاء والعودة</button>
      </div>
    </div>
  );
}

/* ============================ الهيكل العام ============================ */
export default function CustomerApp() {
  const nav = useNavigate();
  const pathname = useLocation().pathname;
  _navRef = nav;
  const catalog = useCatalog();
  const { session, myData, save, refresh } = useAppSession();
  const cart = useCart();
  const { show, node: toastNode } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const productPushedRef = useRef(false);
  useEffect(() => {
    if (product) {
      window.history.pushState({ doseProduct: true }, '');
      productPushedRef.current = true;
    } else if (productPushedRef.current) {
      productPushedRef.current = false;
      window.history.back();
    }
  }, [product]);
  useEffect(() => {
    const onPop = () => {
      if (product) { productPushedRef.current = false; setProduct(null); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [product]);
  const [flow, setFlow] = useState<OrderFlow>({ step: null, lines: [] });
  const [pinBusy, setPinBusy] = useState(false);
  const [doneOrder, setDoneOrder] = useState<{ orderNumber: number; points: number; free: boolean } | null>(null);
  const [pinBusyConfirm, setPinBusyConfirm] = useState(false);
  const [adOpen, setAdOpen] = useState<Ad | null>(null);
  const [closedOpen, setClosedOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState('all');
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [midAdDue, setMidAdDue] = useState(false);
  /* الإعلان الوسطي: بعد دقيقتين من بدء التصفح (?adtest=1 يجعله بعد 8 ثوانٍ للاختبار) */
  useEffect(() => {
    if (!welcomeDone) return;
    const delay = new URLSearchParams(location.search).has('adtest') ? 8000 : 120000;
    const t = setTimeout(() => setMidAdDue(true), delay);
    return () => clearTimeout(t);
  }, [welcomeDone]);
  /* الإعلان المنبثق: الإعلان المُختار ليظهر بعد دقيقتين (مع بقاء دعم الإعلانات القديمة) */
  const popupAd = useMemo(() => {
    const list = catalog?.ads ?? [];
    return list.find((a) => a.popup_after_2min) ?? list.find((a) => a.full_screen) ?? null;
  }, [catalog]);
  const favorites = useMemo(() => new Set<number>((myData?.favorites ?? []).map((p) => p.id)), [myData]);
  const unreadCount = (myData?.notifications ?? []).filter((n) => !n.is_read).length;
  const [pushEnabled, setPushEnabled] = useState(false);
  const toggleFav = async (id: number) => {
    if (!session) { nav('/login'); show('سجّل دخولك لاستخدام المفضلة'); return; }
    try {
      const now = await rpc<boolean>('toggle_favorite', { p_token: session.token, p_product_id: id });
      show(now ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة', 'ok');
      refresh();
    } catch (e: any) { show(e.message, 'err'); }
  };
  const promoCode = catalog?.settings?.promo_code;
  const promoDisc = catalog?.settings?.promo_discount;
  const promoScope = catalog?.settings?.promo_scope ?? 'all';
  const promoTarget = catalog?.settings?.promo_target ?? '';
  const waNumber = catalog?.settings?.whatsapp_number ?? '963936107119';
  const cur = catalog?.settings?.currency_symbol ?? 'ل.س';

  /* نطاق كود الخصم: مجموع الأصناف المشمولة بالخصم داخل السلة
     (سعر المنتج الأساسي فقط — مطابق لما يحسبه الخادم، الإضافات لا تدخل في الخصم) */
  const promoEligibleSubtotal = (lines: CartLine[]) => {
    if (promoScope === 'product')
      return lines.filter((l) => String(l.product.id) === String(promoTarget)).reduce((a, l) => a + effPrice(l.product) * l.qty, 0);
    if (promoScope === 'category')
      return lines.filter((l) => l.product.category === promoTarget).reduce((a, l) => a + effPrice(l.product) * l.qty, 0);
    return lines.reduce((a, l) => a + effPrice(l.product) * l.qty, 0);
  };
  /* وصف نطاق الكود للعرض: على طلبك كاملًا / على اسم منتج / على فئة */
  const promoWhereLabel = () => {
    if (promoScope === 'product')
      return 'على ' + ((catalog?.products ?? []).find((p) => String(p.id) === String(promoTarget))?.name_ar ?? 'منتج محدد');
    if (promoScope === 'category')
      return 'على فئة ' + ((catalog?.categories ?? []).find((c) => c.slug === promoTarget)?.name_ar ?? 'محددة');
    return 'على طلبك كاملًا';
  };

  const ads = catalog?.ads ?? [];
  /* الهيرو: يعرض الإعلانات المخصصة له فقط (الإعلان المنبثق وحده لا يظهر ضمن الهيرو) */
  const heroAds = useMemo(() => ads.filter((ad) => ad.show_in_hero !== false), [catalog]);

  /* تفعيل الإشعارات تلقائيًا بعد الدخول (إن كانت مسموحة مسبقًا) */
  useEffect(() => {
    if (!session?.token) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      enablePushNotifications(session).catch(() => {});
    }
  }, [session?.token]);

  /* حالة تفعيل الإشعارات على هذا الجهاز (تُعرض في الملف الشخصي) */
  useEffect(() => {
    if (!session?.token) { setPushEnabled(false); return; }
    let alive = true;
    isPushEnabled().then((v) => { if (alive) setPushEnabled(v); });
    return () => { alive = false; };
  }, [session?.token]);

  /* تفعيل/تعطيل الإشعارات من الملف الشخصي */
  const togglePush = async () => {
    if (!session) { nav('/login'); show('سجّل دخولك أولًا لإدارة الإشعارات'); return; }
    if (pushEnabled) {
      try {
        const m = await disablePushNotifications();
        setPushEnabled(false);
        show(m, 'ok');
      } catch { show('تعذر تعطيل الإشعارات', 'err'); }
    } else {
      const m = await enablePushNotifications(session).catch(() => 'تعذر التفعيل');
      const ok = m.includes('تم تفعيل');
      setPushEnabled(ok);
      show(m, ok ? 'ok' : 'err');
    }
  };

  /* إشعار الاقتراب من المحل: فحص موقع الزبون كل 90 ثانية أثناء التصفح — بلا تخزين للإحداثيات */
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; });
  useEffect(() => {
    if (!session?.token) return;
    let stopped = false;
    const check = async () => {
      try {
        const loc = await getCurrentLocation();
        if (stopped) return;
        const r = await rpc<any>('check_geo_proximity', { p_token: session.token, p_lat: loc.lat, p_lng: loc.lng });
        if (r?.notified) refreshRef.current();
      } catch { /* صامت — الموقع غير متاح أو مرفوض */ }
    };
    const t0 = setTimeout(check, 15000);
    const iv = setInterval(check, 90000);
    return () => { stopped = true; clearTimeout(t0); clearInterval(iv); };
  }, [session?.token]);

  const startOrder = (lines: CartLine[]) => {
    if (!lines.length) { show('سلتك فارغة'); return; }
    if (shopStatus(catalog?.settings).closed) { setClosedOpen(true); return; }
    if (lines.some((l) => l.product.is_available === false)) { show('نفذت كمية أحد منتجات سلتك — احذفه وأكمل طلبك', 'err'); return; }
    if (!session) { nav('/login'); show('سجّل دخولك أولًا لإتمام الطلب'); return; }
    setFlow({ step: 'contact', lines });
  };

  const confirmWhatsApp = async () => {
    if (!session) return;
    setPinBusy(true);
    try {
      const res = await rpc<any>('create_order', {
        p_customer_id: session.customer.id,
        p_pin: null,
        p_confirm_phone: session.customer.phone,
        p_fulfillment_type: flow.fulfillment ?? 'pickup',
        p_items: flow.lines.map((l) => ({
          product_id: l.product.id, qty: l.qty, options: (l.options || []).join('، '),
          additions: (l.additions ?? []).map((a) => a.id),
        })),
        p_latitude: flow.loc?.lat ?? null, p_longitude: flow.loc?.lng ?? null, p_map_url: flow.loc?.mapUrl ?? null,
        p_source: 'customer',
        p_reward_code: flow.usePromo && promoCode ? promoCode : null,
        p_customer_name: flow.name ?? null, p_customer_phone: flow.phone ?? null,
      });
      const msg = buildOrderMessage({
        orderNumber: res.order_number, customerName: res.customer_name, customerPhone: res.customer_phone,
        fulfillmentType: flow.fulfillment ?? 'pickup',
        items: flow.lines.map((l) => ({
          name: l.product.name_ar, qty: l.qty, unitPriceCents: lineUnit(l),
          options: (l.options || []).concat((l.additions ?? []).map((a) => a.name_ar + ' +' + a.price_cents)).join('، '),
        })),

        totalCents: res.total_cents, totalPoints: res.total_points,
        mapUrl: flow.loc?.mapUrl, createdAt: res.created_at,
        currencySymbol: cur,
      });
      whatsapp.send(waNumber, msg);
      cart.clear();
      setDoneOrder({ orderNumber: res.order_number, points: res.total_points, free: !!res.free });
      refresh();
    } catch (e: any) {
      show(e.message, 'err');
      setFlow({ step: null, lines: [] });
    } finally { setPinBusy(false); }
  };

  const cancelOrder = () => {
    setFlow({ step: null, lines: [] });
    show('أُلغي الطلب — لم يُرسل أي شيء إلى المحل');
  };

  const redeem = async (reward: any) => {
    if (!session) return;
    try {
      const res = await rpc<any>('redeem_reward', { p_token: session.token, p_reward_id: reward.id });
      show(`تم الاستبدال — كودك: ${res.code}`, 'ok');
      refresh();
    } catch (e: any) { show(e.message, 'err'); }
  };

  const deleteNotif = async (id: number) => {
    if (!session) return;
    try {
      await rpc('delete_notification', { p_token: session.token, p_notif_id: id });
      refresh();
      show('حُذف الإشعار', 'ok');
    } catch (e: any) { show(e.message, 'err'); }
  };

  const navItems: { to: string; icon: IconName; label: string; end?: boolean }[] = [
    { to: '/', icon: 'home', label: 'الرئيسية', end: true },
    { to: '/favorites', icon: 'heart', label: 'المفضلة' },
    { to: '/rewards', icon: 'star', label: 'النقاط' },
    { to: '/orders', icon: 'receipt', label: 'الطلبات' },
  ];

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col bg-gradient-to-b from-[#E9EDD6] to-[#DCE3C3]">
      <header className="sticky top-0 z-40 bg-[#E9EDD6]/85 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          {session ? (
            <>
              <Link to="/account" className="flex items-center gap-3 min-w-0" aria-label="حسابي">
                <img src="/logo.jpg" alt="" className="size-11 flex-none rounded-full object-cover shadow-md ring-2 ring-white" />
                <div className="min-w-0 leading-tight">
                  <p className="text-[10px] font-bold text-[#7C8665]">أهلًا بك</p>
                  <p className="truncate text-[14.5px] font-black text-[#26301C]">{session.customer.full_name}</p>
                </div>
              </Link>
              <div className="flex items-center gap-2">
                <span className="grid size-11 place-items-center rounded-full bg-white shadow-sm" aria-label="نقاطك">
                  <span className="flex items-center gap-1 text-xs font-black text-[#26301C]">
                    <Icon name="star" size={12} filled className="text-[#7C8F52]" /> {myData?.customer?.points ?? session.customer.points}
                  </span>
                </span>
                <Link to="/notifications" className="relative grid size-11 place-items-center rounded-full bg-white shadow-sm transition active:scale-90" aria-label="الإشعارات">
                  <Icon name="bell" size={18} className="text-[#26301C]" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -left-0.5 grid size-5 place-items-center rounded-full bg-[#C4482E] text-[10px] font-black text-white shadow">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
                <Link to="/cart" className="relative grid size-11 place-items-center rounded-full bg-[#C9D3A8] shadow-sm" aria-label="السلة">
                  <Icon name="cart" size={18} className="text-[#26301C]" />
                  {cart.count > 0 && <span className="absolute -top-0.5 -left-0.5 grid size-5 place-items-center rounded-full bg-[#26301C] text-[10px] font-black text-white">{cart.count}</span>}
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <Logo size={42} />
                <div className="leading-none">
                  <p className="text-[19px] font-black tracking-tight text-[#26301C]">Dose</p>
                  <span className="mt-1 inline-block rounded-full bg-white px-2 py-0.5 text-[8px] font-black tracking-[.16em] text-[#5C6B3C] shadow-sm">CAFE</span>
                </div>
              </div>
              <Link to="/login" className="rounded-full bg-[#C9D3A8] px-5 py-2.5 text-xs font-black text-[#26301C] shadow-md shadow-[#8a6a48]/30 active:scale-95">تسجيل الدخول</Link>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 pb-36 pt-2">
        <Routes>
          <Route path="/" element={<Home catalog={catalog} openProduct={setProduct} ads={heroAds} onOpenAd={(a) => setAdOpen(a)} selectedCat={selectedCat} onSelectCat={setSelectedCat} />} />
          <Route path="/cart" element={
            <CartPage lines={cart.lines} setQty={cart.setQty} remove={cart.remove}
              onOrder={() => startOrder(cart.lines)}
              onBrowse={() => nav('/')} />} />
          <Route path="/favorites" element={
            <FavoritesPage myData={myData} session={session} openProduct={setProduct} onToggleFav={toggleFav} />} />
          <Route path="/rewards" element={<RewardsPage catalog={catalog} myData={myData} session={session} onRedeem={redeem} />} />
          <Route path="/codes" element={<CodesPage myData={myData} session={session} />} />
          <Route path="/orders" element={<OrdersPage myData={myData} session={session} catalog={catalog} />} />
          <Route path="/notifications" element={
            <NotificationsPage myData={myData} session={session} onDeleteNotif={deleteNotif}
              onSeen={() => { if (session) rpc('mark_notifications_read', { p_token: session.token }).then(refresh).catch(() => {}); }} />} />
          <Route path="/account" element={session ? (
            <AccountPage session={session} myData={myData} waNumber={waNumber} pushEnabled={pushEnabled} onTogglePush={togglePush}
              onRename={async (n: string) => { await rpc('update_customer_profile', { p_token: session.token, p_full_name: n }); await refresh(); }}
              onLogout={async () => { if (session) await rpc('customer_logout', { p_token: session.token }).catch(() => {}); save(null); nav('/'); }} />
          ) : <NeedLogin />} />
          <Route path="/about" element={<AboutPage catalog={catalog} />} />
          <Route path="/login" element={<LoginPage onLogged={(s) => { save(s); nav('/'); show('أهلًا بك ' + s.customer.full_name, 'ok'); }} />} />
          <Route path="/signup" element={<SignupPage onLogged={(s) => { save(s); nav('/'); show('تم إنشاء حسابك بنجاح', 'ok'); }} />} />
          <Route path="*" element={<div className="py-20 text-center text-sm font-bold text-[#7C8665]">الصفحة غير موجودة</div>} />
        </Routes>
      </main>

      {/* شريط تنقل عائم + زر السلة */}
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center justify-around px-4"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="flex w-full items-center justify-around rounded-full bg-white px-2 py-2 shadow-[0_18px_40px_-14px_rgba(42,50,35,.45)]">
          {navItems.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end}
              className={({ isActive }) => isActive
                ? 'flex items-center gap-1.5 rounded-full bg-[#26301C] px-4 py-2 text-white shadow-md'
                : 'flex flex-col items-center gap-0.5 rounded-2xl px-2 py-1 text-[9.5px] font-bold text-[#7C8665] transition hover:text-[#26301C]'}>
              {({ isActive }) => (<>
                <Icon name={t.icon} size={isActive ? 16 : 19} filled={isActive && (t.icon === 'star' || t.icon === 'heart')} />
                {t.label}
              </>)}
            </NavLink>
          ))}
        </div>
      </nav>

      {product && <ProductSheet product={product} catalog={catalog}
        onClose={() => setProduct(null)}
        isFav={favorites.has(product.id)} onToggleFav={toggleFav}
        onAdd={(l) => { cart.add(l); setProduct(null); show('أُضيف إلى السلة', 'ok'); }}
        onOrderNow={(l) => { cart.add(l); setProduct(null); setTimeout(() => startOrder([l]), 50); }} />}

      {flow.step === 'contact' && (
        <ContactModal
          initial={{ name: flow.name ?? session?.customer?.full_name ?? '', phone: flow.phone ?? session?.customer?.phone ?? '' }}
          onClose={() => setFlow({ step: null, lines: [] })}
          onDone={(name, phone) => setFlow((st) => ({ ...st, step: 'fulfillment', name, phone }))} />
      )}
      {flow.step === 'fulfillment' && (
        <FulfillmentModal
          onClose={() => setFlow({ step: null, lines: [] })}
          onPick={(f) => {
            if (f === 'delivery') setFlow((s) => ({ ...s, step: 'location', fulfillment: 'delivery' }));
            else if (promoCode && promoDisc && promoEligibleSubtotal(flow.lines) > 0) setFlow((s) => ({ ...s, step: 'promo', fulfillment: 'pickup' }));
            else setFlow((s) => ({ ...s, step: 'review', fulfillment: 'pickup' }));
          }} />
      )}
      {flow.step === 'location' && (
        <LocationModal
          onClose={() => setFlow({ step: null, lines: [] })}
          onBack={() => setFlow((s) => ({ ...s, step: 'fulfillment' }))}
          onDone={(loc) => {
            if (promoCode && promoDisc && promoEligibleSubtotal(flow.lines) > 0) setFlow((s) => ({ ...s, step: 'promo', loc }));
            else setFlow((s) => ({ ...s, step: 'review', loc }));
          }} />
      )}
      {flow.step === 'promo' && (
        <PromoChoiceModal code={promoCode} disc={promoDisc} where={promoWhereLabel()} busy={pinBusyConfirm}
          onUse={() => { setFlow((st) => ({ ...st, step: 'review', usePromo: true })); }}
          onSkip={() => { setFlow((st) => ({ ...st, step: 'review', usePromo: false })); }} />
      )}
      {flow.step === 'review' && (
        <ConfirmOrderModal
          phase={doneOrder ? 'done' : 'review'}
          lines={flow.lines}
          total={flow.lines.reduce((a, l) => a + lineUnit(l) * l.qty, 0)
            - (flow.usePromo && promoCode && promoDisc
              ? Math.round(promoEligibleSubtotal(flow.lines) * Number(promoDisc) / 100)
              : 0)}
          points={flow.lines.reduce((a, l) => a + l.product.points * l.qty, 0)}
          free={false}
          busy={pinBusyConfirm || pinBusy}
          done={doneOrder}
          onConfirm={confirmWhatsApp}
          onCancel={cancelOrder}
          onClose={() => { setDoneOrder(null); setFlow({ step: null, lines: [] }); }}
        />
      )}
      {adOpen && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4 backdrop-blur-sm anim-fade" onClick={() => setAdOpen(null)}>
          <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-white shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
            <img src={adOpen.image_url} alt={adOpen.title} className="h-56 w-full object-cover" />
            <div className="p-5 text-center">
              <h3 className="text-lg font-black text-[#26301C]">{adOpen.title}</h3>
              <p className="mt-1 text-sm text-neutral-500">{adOpen.description_ar}</p>
              {adOpen.new_price_cents != null && (
                <div className="mt-3 flex items-center justify-center gap-3">
                  {adOpen.old_price_cents != null && <span className="text-sm font-bold text-neutral-400 line-through">{eur(adOpen.old_price_cents, cur)}</span>}
                  <span className="text-2xl font-black text-[#26301C]">{eur(adOpen.new_price_cents, cur)}</span>
                </div>
              )}
              <button onClick={() => { setAdOpen(null); if (adOpen.category_slug) setSelectedCat(adOpen.category_slug); nav('/'); if (adOpen.category_slug) setTimeout(() => document.getElementById('menu-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400); }} className="mt-4 w-fit px-10 rounded-full bg-[#C9D3A8] py-3 text-sm font-black text-[#26301C] shadow-md active:scale-95">{adOpen.category_slug ? 'تصفح عروض الفئة 🏷️' : 'تصفح القائمة'}</button>
            </div>
            <button onClick={() => setAdOpen(null)} className="absolute top-3 left-3 grid size-9 place-items-center rounded-full bg-black/50 text-white" aria-label="إغلاق"><Icon name="x" size={16} /></button>
          </div>
        </div>
      )}
      {!welcomeDone && <WelcomeScreen onClose={() => setWelcomeDone(true)} />}
      {welcomeDone && popupAd && !splashDone && midAdDue && (
        <MidAd ad={popupAd} cur={cur} onClose={() => setSplashDone(true)}
          onBrowse={(slug) => { setSplashDone(true); setSelectedCat(slug); nav('/'); setTimeout(() => document.getElementById('menu-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400); }} />
      )}
      {closedOpen && <ClosedModal open={catalog?.settings?.work_open ?? ''} note={catalog?.settings?.closed_message ?? ''} onClose={() => setClosedOpen(false)} />}
      {toastNode}
    </div>
  );
}

/* ============================ نوافذ تدفق الطلب ============================ */
function FulfillmentModal({ onPick, onClose }: { onPick: (f: Fulfillment) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4 backdrop-blur-sm anim-fade" onClick={onClose}>
      <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-center text-lg font-black text-[#26301C]">كيف تستلم طلبك؟</h3>
        <p className="mt-1 text-center text-xs text-neutral-500">اختر طريقة الاستلام قبل إرسال الطلب</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="rounded-[1.6rem] border-2 border-[#D5DEB4] bg-[#EEF2DC] p-5 transition hover:border-[#A9B87F] active:scale-95"
            onClick={() => onPick('pickup')}>
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-[#5C6B3C] shadow"><Icon name="check" size={24} /></span>
            <span className="mt-3 block text-base font-black text-[#26301C]">استلام من المحل</span>
            <span className="mt-1 block text-[11px] text-neutral-500">جهّز طلبك وتفضل بالاستلام</span>
          </button>
          <button className="rounded-[1.6rem] border-2 border-[#D5DEB4] bg-[#EEF2DC] p-5 transition hover:border-[#A9B87F] active:scale-95"
            onClick={() => onPick('delivery')}>
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-[#5C6B3C] shadow"><Icon name="pin" size={24} /></span>
            <span className="mt-3 block text-base font-black text-[#26301C]">توصيل</span>
            <span className="mt-1 block text-[11px] text-neutral-500">سنطلب موقعك للتوصيل</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function LocationModal({ onDone, onClose, onBack }: { onDone: (loc: { lat: number; lng: number; mapUrl: string }) => void; onClose: () => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const share = async () => {
    setBusy(true); setErr('');
    try { onDone(await getCurrentLocation()); } catch (e: any) { setErr(e.message); setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4 backdrop-blur-sm anim-fade" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[2rem] bg-white p-6 text-center shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto grid size-16 place-items-center rounded-[1.4rem] bg-[#E3E9C8] text-[#5C6B3C]"><Icon name="pin" size={30} /></span>
        <h3 className="mt-3 text-lg font-black text-[#26301C]">مشاركة موقعك</h3>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">نحتاج إلى موقعك لتوصيل الطلب إلى المكان الصحيح.</p>
        {err && <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{err}</p>}
        <button disabled={busy} onClick={share}
          className="mt-5 w-full rounded-full bg-[#C9D3A8] py-3.5 text-base font-black text-[#26301C] shadow-lg shadow-[#8a6a48]/35 transition active:scale-[.98] disabled:opacity-50">
          {busy ? 'جارٍ تحديد موقعك…' : 'مشاركة موقعي'}
        </button>
        <button onClick={onBack} className="mt-3 w-full rounded-2xl py-2.5 text-sm font-bold text-neutral-500 hover:text-neutral-800">إلغاء</button>
      </div>
    </div>
  );
}

/* ============================ بطاقة كود الخصم (استخدام / عدم الاستخدام) ============================ */
function PromoChoiceModal({ code, disc, where, busy, onUse, onSkip }: {
  code: string; disc: string; where: string; busy: boolean; onUse: () => void; onSkip: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[125] grid place-items-center bg-black/50 p-4 backdrop-blur-sm anim-fade">
      <div className="w-full max-w-sm rounded-[2rem] bg-white p-6 text-center shadow-2xl anim-pop">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#E3E9C8] text-[#5C6B3C]"><Icon name="gift" size={28} /></span>
        <h3 className="mt-3 text-lg font-black text-[#26301C]">لديك كود خصم 🎉</h3>
        <p className="mt-3 rounded-2xl bg-[#F1DCB0] px-4 py-2.5 font-mono text-2xl font-black tracking-[.3em] text-[#26301C]" dir="ltr">{code}</p>
        <p className="mt-2 text-sm font-extrabold text-[#7C8F52]">استخدمه الآن واحصل على خصم {disc}% {where}</p>
        <button onClick={onUse} disabled={busy}
          className="mt-5 w-full rounded-full bg-gradient-to-l from-[#EAC98F] to-[#D9B171] py-3.5 text-base font-black text-[#26301C] shadow-lg shadow-[#8a6a48]/35 transition active:scale-[.98] disabled:opacity-50">
          {busy ? 'جارٍ التطبيق…' : 'استخدام الكود'}
        </button>
        <button onClick={onSkip} disabled={busy}
          className="mt-3 w-full rounded-full bg-neutral-100 py-3 text-sm font-black text-neutral-600 transition active:scale-[.98] disabled:opacity-50">
          عدم الاستخدام
        </button>
      </div>
    </div>
  );
}

/* ============================ نافذة الاسم والهاتف — قبل اختيار الاستلام ============================ */
function ContactModal({ initial, onClose, onDone }: { initial: { name: string; phone: string }; onClose: () => void; onDone: (name: string, phone: string) => void }) {
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [err, setErr] = useState('');
  const go = () => {
    const p = phone.replace(/\D/g, '');
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
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s]/g, ''))} inputMode="tel" dir="ltr" placeholder="09XXXXXXXX"
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

/* ============================ نافذة المحل مغلق ============================ */
function ClosedModal({ open, note, onClose }: { open: string; note: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[135] grid place-items-center bg-black/55 p-4 backdrop-blur-sm anim-fade" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[2rem] bg-gradient-to-b from-[#FFF9EC] to-[#F6E7C9] p-7 text-center shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-[#26301C] text-[#EAC98F] shadow-lg shadow-[#26301C]/30">
          <Icon name="clock" size={34} />
        </span>
        <h3 className="mt-4 text-xl font-black text-[#26301C]">المحل مغلق الآن</h3>
        {note ? (
          <p className="mt-2 whitespace-pre-line text-sm font-bold leading-relaxed text-[#7C8665]">{note}</p>
        ) : (
          <p className="mt-2 text-sm font-bold leading-relaxed text-[#7C8665]">
            المحل مغلق حاليًا، نفتح في الموعد المذكور أدناه
          </p>
        )}
        {open && (
          <div className="mx-auto mt-4 w-fit rounded-2xl border-2 border-dashed border-[#C9A96A] bg-white/70 px-6 py-3">
            <p className="text-[10px] font-black tracking-wide text-[#94826A]">موعد الفتح</p>
            <p className="mt-0.5 text-2xl font-black text-[#26301C]" dir="ltr">{open}</p>
          </div>
        )}
        <button onClick={onClose}
          className="mt-5 w-full rounded-full bg-[#26301C] py-3.5 text-base font-black text-[#E9EDD6] shadow-lg transition active:scale-[.98]">
          حسنًا
        </button>
      </div>
    </div>
  );
}

/* ============================ نافذة تأكيد الطلب (واتساب / إلغاء) ============================ */
function ConfirmOrderModal({ phase, lines, total, points, free, busy, done, onConfirm, onCancel, onClose }: {
  phase: 'review' | 'done';
  lines: CartLine[];
  total: number;
  points: number;
  free: boolean;
  busy: boolean;
  done: { orderNumber: number; points: number; free: boolean } | null;
  onConfirm: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const cur = 'ل.س';
  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-black/50 p-4 backdrop-blur-sm anim-fade">
      <div className="w-full max-w-sm rounded-[2rem] bg-white p-6 shadow-2xl anim-pop">
        {phase === 'review' ? (
          <>
            <div className="rounded-[1.6rem] bg-[#E3E9C8] px-5 py-4 text-center">
              <span className="text-sm font-black text-[#26301C]">المبلغ</span>
              <p className="mt-1 text-3xl font-black text-[#26301C]">{free ? 'مجاني 🎁' : eur(total, cur)}</p>
            </div>
            <button onClick={onConfirm} disabled={busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3.5 text-base font-black text-white shadow-lg shadow-green-500/30 transition active:scale-[.98] disabled:opacity-50">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.7-4-4.8-4.2-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4.2.5.7 1.8.8 1.9.1.1.1.3 0 .5-.1.2-.1.3-.3.5l-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.5.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1l1.8.9c.3.1.5.2.5.3.1.1.1.7-.1 1.3Z"/></svg>
              {busy ? 'جارٍ التأكيد…' : 'تأكيد واتساب'}
            </button>
            <button onClick={onCancel} disabled={busy}
              className="mt-3 w-full rounded-full bg-red-50 py-3 text-sm font-black text-[#C4482E] transition active:scale-[.98] disabled:opacity-50">
              إلغاء الطلب
            </button>
          </>
        ) : (
          <>
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#C9D3A8] text-[#26301C] shadow-lg">
              <Icon name="check" size={30} strokeWidth={2.4} />
            </span>
            <h3 className="mt-3 text-lg font-black text-center text-[#26301C]">تم إرسال طلبك إلى المحل</h3>
            <p className="mt-1 text-sm font-bold text-center text-neutral-500">طلب رقم #{done?.orderNumber}</p>
            {done?.free && <p className="mt-2 text-center text-sm font-black text-[#5C6B3C]">🎁 طلبك مجاني برمز الخصم</p>}
            <p className="mt-2 text-center text-xs leading-relaxed text-neutral-500">ستكسب <b className="text-[#7C8F52]">{done?.points} نقطة</b> عند إكمال الطلب — وأصبح الطلب ظاهرًا لدى المحل.</p>
            <button onClick={onClose} className="mt-4 w-full rounded-full bg-[#C9D3A8] py-3 text-sm font-black text-[#26301C] shadow-md active:scale-[.98]">إغلاق</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================ عن المحل ============================ */
function AboutPage({ catalog }: { catalog: Catalog | null }) {
  const phone = catalog?.settings?.store_phone ?? '0936107119';
  const contactRow = (icon: IconName, label: string, value: string, href: string) => (
    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener"
      className="flex w-full items-center gap-3 rounded-[1.4rem] bg-white p-4 shadow-sm ring-1 ring-[#D5DEB4] transition active:scale-[.98]">
      <span className="grid size-10 place-items-center rounded-2xl bg-[#E3E9C8] text-[#5C6B3C]"><Icon name={icon} size={17} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold text-[#7C8665]">{label}</span>
        <span className="block truncate text-sm font-extrabold text-[#26301C]" dir="ltr">{value}</span>
      </span>
      <span className="text-[#A9B87F]"><Icon name="chevron" size={16} /></span>
    </a>
  );
  const credit = (name: string, role: string, phoneNum: string) => (
    <div className="rounded-[1.4rem] bg-white/10 p-4 text-right backdrop-blur">
      <p className="text-[15px] font-black">{name}</p>
      <p className="mt-0.5 text-[11px] font-bold text-[#C9D3A8]">{role}</p>
      <div className="mt-2.5 flex items-center gap-2" dir="ltr">
        <a href={`tel:${phoneNum}`} className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-extrabold transition hover:bg-white/25">
          <Icon name="phone" size={12} /> {phoneNum}
        </a>
        <a href={`https://wa.me/963${phoneNum.replace(/^0/, '')}`} target="_blank" rel="noopener"
          className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-extrabold transition hover:bg-white/25">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.7-4-4.8-4.2-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4.2.5.7 1.8.8 1.9.1.1.1.3 0 .5-.1.2-.1.3-.3.5l-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.5.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1l1.8.9c.3.1.5.2.5.3.1.1.1.7-.1 1.3Z"/></svg>
          واتساب
        </a>
      </div>
    </div>
  );
  return (
    <div className="anim-rise">
      <div className="rounded-[2rem] bg-gradient-to-bl from-[#414D36] to-[#23291B] p-6 text-center text-white shadow-xl shadow-[#8a6a48]/40">
        <img src="/logo.jpg" alt="Dose" className="mx-auto size-20 rounded-[1.6rem] object-cover shadow-2xl ring-4 ring-white/20" />
        <h2 className="mt-3 text-xl font-black">عن المحل</h2>
        <p className="mt-1 text-xs font-bold text-[#C9D3A8]" dir="ltr">Dose Cafe</p>
      </div>

      <div className="mt-4 rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-[#D5DEB4]">
        <p className="text-sm leading-loose text-[#333D25]">
          <b className="text-[#26301C]">Dose Cafe — أكثر من مجرد قهوة.</b>
          <br />نقدّم لك قهوة مختصة ومشروبات ساخنة وباردة على أصولها، وحلويات طازجة تُخبز يوميًا،
          مع خدمة سريعة وأجواء مريحة تناسب كل الأوقات.
          <br />مع نظام نقاط ومكافآت خاص: اجمع النقاط مع كل طلب، واستبدلها بمشروبات وحلويات مجانية.
        </p>
      </div>

      <h3 className="mb-2.5 mt-6 text-base font-black text-[#26301C]">تواصل معنا</h3>
      <div className="space-y-2.5">
        {contactRow('phone', 'هاتف المحل', phone, `tel:${phone}`)}
        {contactRow('instagram', 'إنستغرام', '@dose__cafe', 'https://www.instagram.com/dose__cafe')}
        {contactRow('tiktok', 'تيك توك', '@dose__cafe', 'https://www.tiktok.com/@dose__cafe')}
        {contactRow('facebook', 'فيسبوك', 'Dose Cafe', 'https://www.facebook.com/share/1DhShCC3Fm/')}
        {contactRow('pin', 'موقع المحل',
          (catalog?.settings?.shop_lat ?? '35.132845') + ' , ' + (catalog?.settings?.shop_lng ?? '36.752617'),
          'https://www.google.com/maps?q=' + (catalog?.settings?.shop_lat ?? '35.132845') + ',' + (catalog?.settings?.shop_lng ?? '36.752617'))}
      </div>

      <h3 className="mb-2.5 mt-7 text-base font-black text-[#26301C]">فريق العمل</h3>
      <div className="overflow-hidden rounded-[2rem] bg-gradient-to-bl from-[#414D36] via-[#37422C] to-[#23291B] p-5 text-white shadow-xl shadow-[#8a6a48]/40">
        <p className="flex items-center justify-center gap-2 text-xs font-black tracking-wide text-[#C9D3A8]">
          <Icon name="star" size={13} filled /> بطاقة مميزة
        </p>
        <div className="mt-4 space-y-3">
          {credit('براء دهبية', 'صاحب الفكرة والدعم', '0966333006')}
          {credit('قصي مهند الصالح', 'مطور المنصة وبرمجتها', '0952639157')}
        </div>
        <p className="mt-4 text-center text-[10px] font-bold text-white/60">صُنعت هذه المنصة بحب — Dose Cafe</p>
      </div>
    </div>
  );
}
