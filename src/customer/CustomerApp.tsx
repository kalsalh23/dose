import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { rpc } from '../lib/supabase';
import type { Ad, CartLine, Catalog, MyData, MyOrder, Product, Redemption, Session } from '../lib/types';
import { eur, fmtDateTime, deviceId, getCurrentLocation, urlBase64ToUint8Array } from '../lib/utils';
import { buildOrderMessage, waChatLink, whatsapp } from '../lib/whatsapp';
import PinPad from '../components/PinPad';
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
interface OrderFlow { step: 'fulfillment' | 'location' | 'pin' | null; lines: CartLine[]; fulfillment?: Fulfillment; loc?: { lat: number; lng: number; mapUrl: string } }

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

/* ============================ فئات مميزة ============================ */
const CAT_IMAGES: Record<string, string> = {
  hot: '/img/cappuccino.jpg',
  cold: '/img/iced-latte.jpg',
  dessert: '/img/chocolate-cake.jpg',
  extras: '/img/caramel-macchiato.jpg',
};

function FeaturedCategories({ catalog, cat, setCat }: { catalog: Catalog | null; cat: string; setCat: (s: string) => void }) {
  const items = [{ slug: 'all', name_ar: 'الكل' }, ...(catalog?.categories ?? [])];
  return (
    <section className="mt-7">
      <h2 className="mb-3.5 text-[17px] font-black text-[#26301C]">فئات مميزة</h2>
      <div className="no-scrollbar -mx-4 flex gap-5 overflow-x-auto px-4 pb-1">
        {items.map((c) => {
          const active = cat === c.slug;
          return (
            <button key={c.slug} onClick={() => setCat(c.slug)} className="flex flex-none flex-col items-center gap-2 transition active:scale-95">
              <span className={`grid size-[76px] place-items-center overflow-hidden rounded-full shadow-md shadow-[#8a6a48]/10 transition-all ${
                active ? 'ring-2 ring-[#5C6B3C] ring-offset-2 ring-offset-[#E9EDD6]' : 'ring-1 ring-[#D5DEB4]'}`}>
                {c.slug === 'all'
                  ? <span className="grid size-full place-items-center bg-[#C9D3A8] text-[#26301C]"><Icon name="search" size={20} /></span>
                  : <img src={CAT_IMAGES[c.slug] ?? '/img/latte.jpg'} alt={c.name_ar} className="size-full object-cover" loading="lazy" />}
              </span>
              <span className={`text-[11.5px] font-extrabold ${active ? 'text-[#26301C]' : 'text-[#7C8665]'}`}>{c.name_ar}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ============================ الرئيسية ============================ */
function Home({ catalog, openProduct }: { catalog: Catalog | null; openProduct: (p: Product) => void }) {
  const [cat, setCat] = useState('all');
  const products = catalog?.products ?? [];
  const shown = cat === 'all' ? products : products.filter((p) => p.category === cat);
  const cur = catalog?.settings?.currency_symbol ?? 'ل.س';
  const activeName = cat === 'all' ? 'كل المنتجات' : catalog?.categories?.find((c) => c.slug === cat)?.name_ar;

  return (
    <div className="anim-rise">
      <FeaturedCategories catalog={catalog} cat={cat} setCat={setCat} />

      <section className="mt-5">
        <div className="mb-3 flex items-end justify-between px-1">
          <h2 className="text-[17px] font-black text-[#26301C]">{activeName}</h2>
          <span className="text-[11px] font-bold text-[#7C8665]">{shown.length} منتج</span>
        </div>
        <div className="grid grid-cols-2 gap-3.5 pb-4 sm:grid-cols-3">
          {shown.map((p, i) => (
            <button key={p.id} onClick={() => openProduct(p)}
              className="rounded-[1.75rem] bg-[#E3E9C8] p-2.5 text-right shadow-sm shadow-[#8a6a48]/15 transition hover:-translate-y-1 hover:shadow-lg anim-rise"
              style={{ animationDelay: `${i * 30}ms` }}>
              <img src={p.image_url} alt={p.name_ar} loading="lazy" className="h-28 w-full rounded-[1.3rem] object-cover" />
              <div className="flex items-end justify-between px-1 pb-0.5 pt-2.5">
                <div className="min-w-0">
                  <h3 className="truncate text-[13px] font-extrabold text-[#26301C]">{p.name_ar}</h3>
                  <p className="mt-0.5 text-[13px] font-black text-[#26301C]">{eur(p.price_cents, cur)}</p>
                </div>
                <span className="grid size-9 flex-none place-items-center rounded-full bg-white shadow-md">
                  <Icon name="plus" size={15} className="text-[#26301C]" />
                </span>
              </div>
            </button>
          ))}
        </div>
        <p className="pb-2 text-center text-[11px] text-[#7C8665]">اجمع النقاط مع كل طلب واستبدلها من صفحة «استبدل نقاطك»</p>
      </section>
    </div>
  );
}

/* ============================ تفاصيل المنتج — ملء الشاشة مع الخيارات ============================ */
function ProductSheet({ product, catalog, onClose, onAdd, onOrderNow }: {
  product: Product; catalog: Catalog | null; onClose: () => void;
  onAdd: (line: CartLine) => void; onOrderNow: (line: CartLine) => void;
}) {
  const [qty, setQty] = useState(1);
  const [opts, setOpts] = useState<string[]>([]);
  const cur = catalog?.settings?.currency_symbol ?? 'ل.س';
  const options = ((product as any).options || '').split(',').map((o: string) => o.trim()).filter(Boolean);
  const toggle = (o: string) => setOpts((os) => (os.includes(o) ? os.filter((x) => x !== o) : [...os, o]));

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white anim-rise">
      <div className="relative h-[42vh] min-h-56 flex-none overflow-hidden">
        <img src={product.image_url} alt={product.name_ar} className="size-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />
        <button onClick={onClose}
          className="absolute top-4 right-4 grid size-11 place-items-center rounded-full bg-white shadow-lg transition active:scale-90"
          style={{ color: '#26301C' }} aria-label="رجوع">
          <Icon name="chevron" size={20} />
        </button>
        <span className="absolute bottom-5 left-5 rounded-full bg-[#C9D3A8] px-5 py-2.5 text-xl font-black shadow-xl" style={{ color: '#26301C' }}>
          {eur(product.price_cents, cur)}
        </span>
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
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => onAdd({ product, qty, options: opts })}
            className="rounded-full border-2 border-[#C9D3A8] py-4 text-sm font-black text-[#26301C] transition active:scale-[.98]">
            أضف إلى السلة
          </button>
          <button onClick={() => onOrderNow({ product, qty, options: opts })}
            className="rounded-full bg-gradient-to-l from-[#C9D3A8] to-[#A9B87F] py-4 text-sm font-black text-[#26301C] shadow-lg shadow-[#8a6a48]/35 transition active:scale-[.98]">
            اطلب الآن
          </button>
        </div>
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
  const total = lines.reduce((a, l) => a + l.product.price_cents * l.qty, 0);
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
            <p className="mt-1 text-sm font-black text-[#26301C]">{eur(l.product.price_cents * l.qty, cur)}</p>
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
              </div>
              <button disabled={!can || busy} onClick={() => setConfirming(r)}
                className={`rounded-full px-5 py-2.5 text-sm font-black transition active:scale-95 ${can ? 'bg-[#C9D3A8] text-[#26301C] shadow-md shadow-[#8a6a48]/30' : 'bg-[#E3E9C8] text-[#7C8665]'}`}>
                {can ? 'استبدال' : 'غير كافية'}
              </button>
            </div>
          );
        })}
      </div>

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
    ready: { label: 'جاهز', color: 'bg-emerald-100 text-emerald-800' },
    completed: { label: 'مكتمل', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700' },
  };
  return map[s] ?? { label: s, color: 'bg-neutral-100 text-neutral-600' };
};

/* ============================ الطلبات ============================ */
function OrdersPage({ myData, session }: { myData: MyData | null; session: Session | null }) {
  if (!session) return <NeedLogin />;
  const orders = myData?.orders ?? [];
  return (
    <div className="space-y-3 pb-4 anim-rise">
      {orders.length === 0 && (
        <div className="py-20 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-[1.4rem] bg-[#E3E9C8] text-[#5C6B3C]"><Icon name="receipt" size={26} /></span>
          <p className="mt-4 text-sm font-bold text-neutral-500">لا توجد طلبات بعد</p>
        </div>
      )}
      {orders.map((o) => (
        <div key={o.id} className="rounded-[1.75rem] bg-[#E3E9C8] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-[#26301C]">طلب #{o.order_number}</span>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${statusInfo(o.status).color}`}>{statusInfo(o.status).label}</span>
          </div>
          <div className="mt-2 space-y-1">
            {o.items.map((it: any, i) => (
              <p key={i} className="text-xs text-[#5c5142]">• {it.name_ar} × {it.qty}{it.options ? ` (${it.options})` : ''} — {eur(it.unit_price_cents)}</p>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-dashed border-[#C4CF9E] pt-3 text-xs">
            <span className="flex items-center gap-1 text-[#6B7357]">
              <Icon name={o.fulfillment_type === 'delivery' ? 'pin' : 'home'} size={12} />
              {o.fulfillment_type === 'delivery' ? 'توصيل' : 'استلام'} · {fmtDateTime(o.created_at)}
            </span>
            <span className="font-black text-[#26301C]">{eur(o.total_cents)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================ الإشعارات ============================ */
function NotificationsPage({ myData, session, onSeen, onEnablePush, pushMsg }: {
  myData: MyData | null; session: Session | null; onSeen: () => void; onEnablePush: () => void; pushMsg: string;
}) {
  useEffect(() => { onSeen(); }, []);
  if (!session) return <NeedLogin />;
  const items = myData?.notifications ?? [];
  return (
    <div className="space-y-2.5 pb-4 anim-rise">
      <button onClick={onEnablePush} className="flex w-full items-center justify-between rounded-[1.4rem] bg-gradient-to-l from-[#414D36] to-[#23291B] p-4 text-right text-white shadow-lg">
        <span className="flex items-center gap-3 text-sm font-extrabold">
          <span className="grid size-10 place-items-center rounded-2xl bg-white/15"><Icon name="bell" size={18} /></span>
          تفعيل الإشعارات الفورية
        </span>
        <span className="max-w-[38%] text-[10px] font-bold text-[#C9D3A8]">{pushMsg || 'اضغط للتفعيل'}</span>
      </button>
      {items.length === 0 && (
        <div className="py-16 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-[1.4rem] bg-[#E3E9C8] text-[#5C6B3C]"><Icon name="bell" size={26} /></span>
          <p className="mt-4 text-sm font-bold text-neutral-500">لا توجد إشعارات حاليًا</p>
        </div>
      )}
      {items.map((n) => (
        <div key={n.id} className={`rounded-[1.5rem] p-4 ${n.is_read ? 'bg-white/70' : 'bg-[#E3E9C8] shadow-sm'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-[#26301C]">{n.title}</p>
              {n.body && <p className="mt-1 text-xs leading-relaxed text-[#6B7357]">{n.body}</p>}
            </div>
            <span className="flex-none text-[10px] font-bold text-[#7C8665]">{fmtDateTime(n.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================ حسابي ============================ */
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
                {r.status === 'unused' ? 'غير مستخدم' : r.status === 'used' ? 'مستخدم' : 'منتهي'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountPage({ session, myData, waNumber, onLogout, onPush, pushMsg }: {
  session: Session; myData: MyData | null; waNumber: string; onLogout: () => void; onPush: () => void; pushMsg: string;
}) {
  const [showCodes, setShowCodes] = useState(false);
  const c = myData?.customer ?? session.customer;
  const redemptions = myData?.redemptions ?? [];
  return (
    <div className="anim-rise">
      <div className="rounded-[2rem] bg-gradient-to-bl from-[#414D36] to-[#23291B] p-6 text-center text-white shadow-xl shadow-[#8a6a48]/40">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-white/15 text-2xl font-black backdrop-blur">
          {c.full_name.trim().charAt(0)}
        </span>
        <h2 className="mt-3 text-lg font-black">{c.full_name}</h2>
        <p className="mt-0.5 text-xs text-white/70" dir="ltr">{c.phone}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-white/10 py-3"><p className="text-xl font-black text-[#C9D3A8]">{c.points}</p><p className="text-[10px] font-bold text-white/70">نقطة</p></div>
          <div className="rounded-3xl bg-white/10 py-3"><p className="text-xl font-black text-[#C9D3A8]">{c.orders_count}</p><p className="text-[10px] font-bold text-white/70">طلب</p></div>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        <AccountRow icon="receipt" label="الطلبات" onClick={() => _navRef?.('/orders')} />
        <AccountRow icon="gift" label="المكافأة" onClick={() => setShowCodes(true)} badge={redemptions.filter((r) => r.status === 'unused').length || undefined} />
        <a href={waChatLink(waNumber, 'مرحبًا، أحتاج مساعدة من Dose Cafe')} target="_blank" rel="noopener"
          className="flex w-full items-center justify-between rounded-[1.4rem] bg-[#E3E9C8] p-4 transition active:scale-[.98]">
          <span className="flex items-center gap-3 text-sm font-extrabold text-[#26301C]">
            <span className="grid size-10 place-items-center rounded-2xl bg-white shadow-sm text-[#5C6B3C]"><Icon name="headset" size={18} /></span>
            المساعدة والدعم
          </span>
          <span className="text-[#A9B87F]"><Icon name="chevron" size={16} /></span>
        </a>
        <AccountRow icon="store" label="عن المحل" onClick={() => _navRef?.('/about')} />
        <button onClick={onPush} className="flex w-full items-center justify-between rounded-[1.4rem] bg-[#E3E9C8] p-4 transition active:scale-[.98]">
          <span className="flex items-center gap-3 text-sm font-extrabold text-[#26301C]">
            <span className="grid size-10 place-items-center rounded-2xl bg-white shadow-sm text-[#5C6B3C]"><Icon name="bell" size={18} /></span>
            الإشعارات الفورية
          </span>
          <span className="max-w-[38%] truncate text-[10px] font-bold text-[#6B7A45]">{pushMsg || 'اضغط للتفعيل'}</span>
        </button>
        <button onClick={onLogout}
          className="flex w-full items-center justify-between rounded-[1.4rem] bg-[#E3E9C8] p-4 transition active:scale-[.98]">
          <span className="flex items-center gap-3 text-sm font-extrabold text-[#C4482E]">
            <span className="grid size-10 place-items-center rounded-2xl bg-white shadow-sm text-[#C4482E]"><Icon name="logout" size={18} /></span>
            تسجيل الخروج
          </span>
          <span className="text-[#A9B87F]"><Icon name="chevron" size={16} /></span>
        </button>
      </div>

      {showCodes && <MyCodes redemptions={redemptions} />}
    </div>
  );
}

let _navRef: ((to: string) => void) | null = null;

/* ============================ الدخول / التسجيل ============================ */
function LoginPage({ onLogged }: { onLogged: (s: Session) => void }) {
  const nav = useNavigate();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    setBusy(true); setErr('');
    try {
      const s = await rpc<Session>('customer_login', { p_phone: phone.replace(/\D/g, ''), p_pin: pin });
      onLogged(s);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-sm py-10 anim-rise">
      <div className="rounded-[2rem] bg-white p-7 shadow-xl shadow-[#8a6a48]/15">
        <div className="text-center"><Logo size={60} /></div>
        <h2 className="mt-4 text-center text-xl font-black text-[#26301C]">تسجيل الدخول</h2>
        <p className="mt-1 text-center text-xs text-neutral-500">برقم هاتفك ورمز PIN الخاص بك</p>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" dir="ltr" placeholder="09XXXXXXXX"
          className="mt-5 h-12 w-full rounded-2xl border-2 border-[#D5DEB4] bg-[#EEF2DC] px-4 text-center text-base font-bold tracking-widest text-[#26301C] outline-none focus:border-[#A9B87F]" />
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" type="password" dir="ltr" placeholder="PIN ••••"
          className="mt-3 h-12 w-full rounded-2xl border-2 border-[#D5DEB4] bg-[#EEF2DC] px-4 text-center text-lg font-black tracking-[.5em] outline-none focus:border-[#A9B87F]" />
        {err && <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-600">{err}</p>}
        <button onClick={submit} disabled={busy || pin.length !== 4 || phone.replace(/\D/g, '').length < 8}
          className="mt-5 w-full rounded-full bg-[#C9D3A8] py-3.5 text-base font-black text-[#26301C] shadow-lg shadow-[#8a6a48]/35 active:scale-[.98] disabled:opacity-40">
          {busy ? 'جارٍ الدخول…' : 'دخول'}
        </button>
        <button onClick={() => nav('/signup')} className="mt-3 w-full py-2 text-center text-sm font-bold text-[#5C6B3C]">ليس لديك حساب؟ أنشئ حسابك الآن</button>
      </div>
    </div>
  );
}

function SignupPage({ onLogged }: { onLogged: (s: Session) => void }) {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    setErr('');
    if (name.trim().length < 2) return setErr('أدخل اسمك الكامل');
    if (phone.replace(/\D/g, '').length < 8) return setErr('أدخل رقم هاتف صحيح');
    if (pin.length !== 4) return setErr('رمز PIN يجب أن يكون 4 أرقام');
    if (pin !== pin2) return setErr('رمزا PIN غير متطابقين');
    setBusy(true);
    try {
      await rpc('create_customer', { p_full_name: name.trim(), p_phone: phone.replace(/\D/g, ''), p_pin: pin, p_device_id: deviceId });
      const s = await rpc<Session>('customer_login', { p_phone: phone.replace(/\D/g, ''), p_pin: pin });
      onLogged(s);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-sm py-8 anim-rise">
      <div className="rounded-[2rem] bg-white p-7 shadow-xl shadow-[#8a6a48]/15">
        <h2 className="text-center text-xl font-black text-[#26301C]">مرحبًا بك في <span className="text-[#5C6B3C]">Dose Cafe</span></h2>
        <p className="mt-1 text-center text-xs text-neutral-500">أنشئ حسابك الآن واستمتع بالنقاط والمكافآت</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل"
          className="mt-4 h-12 w-full rounded-2xl border-2 border-[#D5DEB4] bg-[#EEF2DC] px-4 text-sm font-bold outline-none focus:border-[#A9B87F]" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" dir="ltr" placeholder="09XXXXXXXX"
          className="mt-3 h-12 w-full rounded-2xl border-2 border-[#D5DEB4] bg-[#EEF2DC] px-4 text-center text-sm font-bold outline-none focus:border-[#A9B87F]" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} type="password" inputMode="numeric" dir="ltr" placeholder="PIN"
            className="h-12 w-full rounded-2xl border-2 border-[#D5DEB4] bg-[#EEF2DC] text-center text-base font-black tracking-widest outline-none focus:border-[#A9B87F]" />
          <input value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 4))} type="password" inputMode="numeric" dir="ltr" placeholder="تأكيد PIN"
            className="h-12 w-full rounded-2xl border-2 border-[#D5DEB4] bg-[#EEF2DC] text-center text-base font-black tracking-widest outline-none focus:border-[#A9B87F]" />
        </div>
        <p className="mt-3 rounded-2xl bg-[#EEF2DC] px-3 py-2.5 text-[11px] leading-relaxed text-[#7C8665]">
          يُستخدم رمز PIN للتحقق من هويتك عند الطلب — يُخزَّن مشفّرًا ولا يمكن لأحد رؤيته
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
  _navRef = nav;
  const catalog = useCatalog();
  const { session, myData, save, refresh } = useAppSession();
  const cart = useCart();
  const { show, node: toastNode } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [flow, setFlow] = useState<OrderFlow>({ step: null, lines: [] });
  const [pinErr, setPinErr] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [success, setSuccess] = useState<{ orderNumber: number; points: number; message: string } | null>(null);
  const [adOpen, setAdOpen] = useState<Ad | null>(null);
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [pushMsg, setPushMsg] = useState('');
  const waNumber = catalog?.settings?.whatsapp_number ?? '963936107119';
  const cur = catalog?.settings?.currency_symbol ?? 'ل.س';

  const ads = catalog?.ads ?? [];
  const unread = (myData?.notifications ?? []).filter((n) => !n.is_read).length;

  /* تفعيل الإشعارات تلقائيًا بعد الدخول (إن كانت مسموحة مسبقًا) */
  useEffect(() => {
    if (!session?.token) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      enablePushNotifications(session).then(() => setPushMsg('مفعّلة')).catch(() => {});
    }
  }, [session?.token]);

  const startOrder = (lines: CartLine[]) => {
    if (!lines.length) { show('سلتك فارغة'); return; }
    if (!session) { nav('/login'); show('سجّل دخولك أولًا لإتمام الطلب'); return; }
    setFlow({ step: 'fulfillment', lines });
  };

  const submitPin = async (pin: string) => {
    if (!session) return;
    setPinBusy(true); setPinErr('');
    try {
      const res = await rpc<any>('create_order', {
        p_customer_id: session.customer.id, p_pin: pin,
        p_fulfillment_type: flow.fulfillment ?? 'pickup',
        p_items: flow.lines.map((l) => ({ product_id: l.product.id, qty: l.qty, options: (l.options || []).join('، ') })),
        p_latitude: flow.loc?.lat ?? null, p_longitude: flow.loc?.lng ?? null, p_map_url: flow.loc?.mapUrl ?? null,
        p_source: 'customer',
      });
      const msg = buildOrderMessage({
        orderNumber: res.order_number, customerName: res.customer_name, customerPhone: res.customer_phone,
        fulfillmentType: flow.fulfillment ?? 'pickup',
        items: flow.lines.map((l) => ({ name: l.product.name_ar, qty: l.qty, unitPriceCents: l.product.price_cents, options: (l.options || []).join('، ') })),
        totalCents: res.total_cents, totalPoints: res.total_points,
        mapUrl: flow.loc?.mapUrl, createdAt: res.created_at,
        currencySymbol: cur,
      });
      setFlow({ step: null, lines: [] });
      cart.clear();
      setSuccess({ orderNumber: res.order_number, points: res.total_points, message: msg });
      refresh();
    } catch (e: any) {
      setPinErr(e.message);
    } finally { setPinBusy(false); }
  };

  const redeem = async (reward: any) => {
    if (!session) return;
    try {
      const res = await rpc<any>('redeem_reward', { p_token: session.token, p_reward_id: reward.id });
      show(`تم الاستبدال — كودك: ${res.code}`, 'ok');
      refresh();
    } catch (e: any) { show(e.message, 'err'); }
  };

  const enablePush = async () => {
    if (!session) { nav('/login'); return; }
    const m = await enablePushNotifications(session).catch(() => 'تعذر التفعيل');
    setPushMsg(m.includes('تم تفعيل') ? 'مفعّلة' : m);
    show(m, m.includes('تم تفعيل') ? 'ok' : 'err');
  };

  const navItems: { to: string; icon: IconName; label: string; end?: boolean }[] = [
    { to: '/', icon: 'home', label: 'الرئيسية', end: true },
    { to: '/rewards', icon: 'star', label: 'النقاط' },
    { to: '/orders', icon: 'receipt', label: 'الطلبات' },
    { to: '/notifications', icon: 'bell', label: 'الإشعارات' },
  ];

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col bg-gradient-to-b from-[#E9EDD6] to-[#DCE3C3]">
      <header className="sticky top-0 z-40 bg-[#E9EDD6]/85 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          {session ? (
            <>
              <Link to="/account" className="flex items-center gap-3" aria-label="حسابي">
                <span className="grid size-11 place-items-center rounded-full bg-[#C9D3A8] text-base font-black text-[#26301C] shadow-md">
                  {session.customer.full_name.trim().charAt(0)}
                </span>
                <div className="leading-tight">
                  <p className="text-[10px] font-bold text-[#7C8665]">أهلًا بك</p>
                  <p className="text-[15px] font-black text-[#26301C]">{session.customer.full_name.split(' ')[0]}</p>
                </div>
              </Link>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-[#26301C] shadow-sm">
                  <Icon name="star" size={12} filled className="text-[#7C8F52]" /> {myData?.customer?.points ?? session.customer.points}
                </span>
                <Link to="/notifications" className="relative grid size-11 place-items-center rounded-full bg-white shadow-sm" aria-label="الإشعارات">
                  <Icon name="bell" size={18} className="text-[#26301C]" />
                  {unread > 0 && <span className="absolute -top-0.5 -left-0.5 grid size-5 place-items-center rounded-full bg-[#C4482E] text-[10px] font-black text-white">{unread}</span>}
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

      <div className="px-4 pt-3">
        <OfferBanners ads={ads} cur={cur} onOpen={(a) => setAdOpen(a)} />
      </div>

      <main className="flex-1 px-4 pb-36 pt-2">
        <Routes>
          <Route path="/" element={<Home catalog={catalog} openProduct={setProduct} />} />
          <Route path="/cart" element={
            <CartPage lines={cart.lines} setQty={cart.setQty} remove={cart.remove}
              onOrder={() => startOrder(cart.lines)}
              onBrowse={() => nav('/')} />} />
          <Route path="/rewards" element={<RewardsPage catalog={catalog} myData={myData} session={session} onRedeem={redeem} />} />
          <Route path="/orders" element={<OrdersPage myData={myData} session={session} />} />
          <Route path="/notifications" element={
            <NotificationsPage myData={myData} session={session} pushMsg={pushMsg}
              onSeen={() => { if (session) rpc('mark_notifications_read', { p_token: session.token }).then(refresh).catch(() => {}); }}
              onEnablePush={enablePush} />} />
          <Route path="/account" element={session ? (
            <AccountPage session={session} myData={myData} waNumber={waNumber} pushMsg={pushMsg} onPush={enablePush}
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
                <Icon name={t.icon} size={isActive ? 16 : 19} filled={isActive && t.icon === 'star'} />
                {t.label}
              </>)}
            </NavLink>
          ))}
          <Link to="/cart" className="relative grid size-11 flex-none place-items-center rounded-full shadow-md" style={{ background: '#C9D3A8', color: '#26301C' }} aria-label="السلة">
            <Icon name="cart" size={19} />
            {cart.count > 0 && <span className="absolute -top-1 -left-1 grid size-5 place-items-center rounded-full bg-[#26301C] text-[10px] font-black text-white">{cart.count}</span>}
          </Link>
        </div>
      </nav>

      {product && <ProductSheet product={product} catalog={catalog}
        onClose={() => setProduct(null)}
        onAdd={(l) => { cart.add(l); setProduct(null); show('أُضيف إلى السلة', 'ok'); }}
        onOrderNow={(l) => { cart.add(l); setProduct(null); setTimeout(() => startOrder([l]), 50); }} />}

      {flow.step === 'fulfillment' && (
        <FulfillmentModal
          onClose={() => setFlow({ step: null, lines: [] })}
          onPick={(f) => {
            if (f === 'delivery') setFlow((s) => ({ ...s, step: 'location', fulfillment: 'delivery' }));
            else setFlow((s) => ({ ...s, step: 'pin', fulfillment: 'pickup' }));
          }} />
      )}
      {flow.step === 'location' && (
        <LocationModal
          onClose={() => setFlow({ step: null, lines: [] })}
          onBack={() => setFlow((s) => ({ ...s, step: 'fulfillment' }))}
          onDone={(loc) => setFlow((s) => ({ ...s, step: 'pin', loc }))} />
      )}
      {flow.step === 'pin' && (
        <PinPad title="تأكيد هويتك" subtitle="أدخل رمز PIN المكوّن من 4 أرقام لتأكيد طلبك"
          loading={pinBusy} error={pinErr} onFill={submitPin}
          onClose={() => { setFlow({ step: null, lines: [] }); setPinErr(''); }} />
      )}
      {success && <OrderSuccessModal {...success} waNumber={waNumber} onClose={() => setSuccess(null)} />}
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
              <button onClick={() => { setAdOpen(null); nav('/'); }} className="mt-4 w-fit px-10 rounded-full bg-[#C9D3A8] py-3 text-sm font-black text-[#26301C] shadow-md active:scale-95">تصفح القائمة</button>
            </div>
            <button onClick={() => setAdOpen(null)} className="absolute top-3 left-3 grid size-9 place-items-center rounded-full bg-black/50 text-white" aria-label="إغلاق"><Icon name="x" size={16} /></button>
          </div>
        </div>
      )}
      {!welcomeDone && <WelcomeScreen onClose={() => setWelcomeDone(true)} />}
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

function OrderSuccessModal({ orderNumber, points, waNumber, message, onClose }: {
  orderNumber: number; points: number; waNumber: string; message: string; onClose: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const send = () => { whatsapp.send(waNumber, message); setOpened(true); };
  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-black/50 p-4 backdrop-blur-sm anim-fade">
      <div className="w-full max-w-sm rounded-[2rem] bg-white p-6 text-center shadow-2xl anim-pop">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#C9D3A8] text-[#26301C] shadow-lg">
          <Icon name="check" size={30} strokeWidth={2.4} />
        </span>
        <h3 className="mt-3 text-lg font-black text-[#26301C]">تم تسجيل طلبك بنجاح</h3>
        <p className="mt-1 text-sm font-bold text-neutral-500">طلب رقم #{orderNumber}</p>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">ستكسب <b className="text-[#5C6B3C]">{points} نقطة</b> عند إكمال الطلب. أرسل الطلب الآن إلى المحل عبر WhatsApp:</p>
        <button onClick={send}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3.5 text-base font-black text-white shadow-lg shadow-green-500/30 transition active:scale-[.98]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.7-4-4.8-4.2-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4.2.5.7 1.8.8 1.9.1.1.1.3 0 .5-.1.2-.1.3-.3.5l-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.5.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1l1.8.9c.3.1.5.2.5.3.1.1.1.7-.1 1.3Z"/></svg>
          {opened ? 'إعادة الإرسال عبر WhatsApp' : 'إرسال الطلب عبر WhatsApp'}
        </button>
        <button onClick={onClose} className="mt-3 w-full rounded-full py-2.5 text-sm font-bold text-neutral-500 hover:text-neutral-800">تم</button>
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
        {contactRow('pin', 'موقع المحل', '35.1327334 , 36.7526210', 'https://www.google.com/maps?q=35.1327334,36.7526210')}
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
