import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { rpc } from '../lib/supabase';
import type { Ad, CartLine, Catalog, MyData, MyOrder, Product, Redemption, Session } from '../lib/types';
import { eur, fmtDateTime, deviceId, getCurrentLocation } from '../lib/utils';
import { buildOrderMessage, waChatLink, whatsapp } from '../lib/whatsapp';
import PinPad from '../components/PinPad';
import { Icon, type IconName } from '../components/Icons';

const SESSION_KEY = 'dose_app_session_v1';

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

/* ============================ عناصر مشتركة ============================ */
const Logo = ({ size = 40 }: { size?: number }) => (
  <img src="/logo.jpg" alt="Dose" style={{ width: size, height: size }}
    className="rounded-xl border-2 border-fresh-200 object-cover shadow" />
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
    <div className={`fixed inset-x-0 bottom-28 z-[300] mx-auto w-fit max-w-[92vw] rounded-2xl px-5 py-3 text-center text-sm font-bold shadow-2xl anim-pop ${
      toast.kind === 'err' ? 'bg-red-600 text-white' : 'bg-fresh-700 text-white'}`}>{toast.msg}</div>
  ) : null;
  return { show, node };
}

type Fulfillment = 'pickup' | 'delivery';
interface OrderFlow { step: 'fulfillment' | 'location' | 'pin' | null; lines: CartLine[]; fulfillment?: Fulfillment; loc?: { lat: number; lng: number; mapUrl: string } }

/* ============================ الإعلان الحصري (5 ثوانٍ) ============================ */
function SplashAd({ ad, cur, onClose }: { ad: Ad; cur: string; onClose: () => void }) {
  const [left, setLeft] = useState(5);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    const end = setTimeout(onClose, 5000);
    return () => { clearInterval(t); clearTimeout(end); };
  }, []);
  return (
    <div className="fixed inset-0 z-[200] bg-black/85 p-5 backdrop-blur-md anim-fade">
      <div className="relative mx-auto mt-8 max-w-sm overflow-hidden rounded-[2rem] bg-white shadow-2xl anim-pop">
        <div className="relative">
          <img src={ad.image_url} alt={ad.title} className="h-72 w-full object-cover" />
          <span className="absolute top-3 right-3 rounded-full bg-gold px-3 py-1 text-[11px] font-black text-white shadow-lg">عرض حصري</span>
          {/* حلقة العد التنازلي */}
          <button onClick={onClose} className="absolute top-3 left-3 grid size-11 place-items-center" aria-label="تخطي">
            <svg viewBox="0 0 44 44" className="absolute inset-0 size-full -rotate-90">
              <circle cx="22" cy="22" r="19" fill="rgba(0,0,0,.45)" stroke="rgba(255,255,255,.3)" strokeWidth="3" />
              <circle cx="22" cy="22" r="19" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 19}
                strokeDashoffset={2 * Math.PI * 19 * (1 - left / 5)}
                style={{ transition: 'stroke-dashoffset 1s linear' }} />
            </svg>
            <span className="relative text-sm font-black text-white">{Math.max(0, left)}</span>
          </button>
        </div>
        <div className="p-5 text-center">
          <h3 className="text-xl font-black text-coffee-900">{ad.title}</h3>
          <p className="mt-1 text-sm text-neutral-500">{ad.description_ar}</p>
          {ad.new_price_cents != null && (
            <div className="mt-3 flex items-center justify-center gap-3">
              {ad.old_price_cents != null && <span className="text-sm font-bold text-neutral-400 line-through">{eur(ad.old_price_cents, cur)}</span>}
              <span className="text-2xl font-black text-fresh-700">{eur(ad.new_price_cents, cur)}</span>
            </div>
          )}
          <button onClick={onClose} className="mt-4 w-full rounded-2xl bg-gradient-to-l from-fresh-500 to-fresh-700 py-3 text-base font-extrabold text-white shadow-lg shadow-fresh-900/25 active:scale-[.98]">
            اطلب الآن
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================ الهوية الفريش ============================ */
/* الأخضر: fresh-700 أساسي · fresh-500 تفاعلي · fresh-100 خلفيات · أبيض للبطاقات */

const CAT_IMAGES: Record<string, string> = {
  hot: '/img/cappuccino.jpg',
  cold: '/img/iced-latte.jpg',
  dessert: '/img/chocolate-cake.jpg',
  extras: '/img/caramel-macchiato.jpg',
};

/* بانر العروض — متصل بالشريط العلوي، سلايدر أفقي */
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
    <div className="anim-rise">
      <div ref={ref} onScroll={onScroll}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto"
        style={{ scrollBehavior: 'smooth' }}>
        {ads.map((a) => (
          <button key={a.id} onClick={() => onOpen(a)}
            className="relative h-40 w-full flex-none snap-center overflow-hidden rounded-3xl text-right shadow-lg shadow-fresh-900/15 sm:h-44">
            <img src={a.image_url} alt={a.title} className="size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-l from-black/60 via-black/25 to-transparent" />
            <div className="absolute inset-y-0 right-0 flex flex-col justify-center gap-1 p-5 text-white">
              <span className="w-fit rounded-full bg-fresh-500 px-3 py-1 text-[10px] font-black shadow">عرض حصري</span>
              <h3 className="text-xl font-black drop-shadow">{a.title}</h3>
              <p className="text-[11px] font-medium text-white/85">{a.description_ar}</p>
              <div className="mt-0.5 flex items-baseline gap-2">
                {a.old_price_cents != null && <span className="text-xs font-bold text-white/70 line-through">{eur(a.old_price_cents, cur)}</span>}
                {a.new_price_cents != null && <span className="text-lg font-black">{eur(a.new_price_cents, cur)}</span>}
              </div>
            </div>
          </button>
        ))}
      </div>
      {ads.length > 1 && (
        <div className="mt-2.5 flex justify-center gap-1.5">
          {ads.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-5 bg-fresh-600' : 'w-1.5 bg-fresh-200'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

/* فئات مميزة — صور دائرية */
function FeaturedCategories({ catalog, cat, setCat }: { catalog: Catalog | null; cat: string; setCat: (s: string) => void }) {
  const items = [{ slug: 'all', name_ar: 'الكل', img: '' }, ...(catalog?.categories ?? [])];
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-base font-extrabold text-fresh-ink">فئات مميزة</h2>
      <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
        {items.map((c) => {
          const active = cat === c.slug;
          return (
            <button key={c.slug} onClick={() => setCat(c.slug)} className="flex flex-none flex-col items-center gap-2 transition active:scale-95">
              <span className={`grid size-20 place-items-center overflow-hidden rounded-full shadow-md transition-all ${active ? 'ring-4 ring-fresh-500 ring-offset-2' : 'ring-4 ring-white'}`}>
                {c.slug === 'all'
                  ? <span className="grid size-full place-items-center bg-fresh-600 text-white"><Icon name="package" size={22} /></span>
                  : <img src={CAT_IMAGES[c.slug] ?? '/img/latte.jpg'} alt={c.name_ar} className="size-full object-cover" loading="lazy" />}
              </span>
              <span className={`text-xs font-extrabold ${active ? 'text-fresh-700' : 'text-neutral-500'}`}>{c.name_ar}</span>
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

  return (
    <div className="anim-rise">
      {/* فئات مميزة */}
      <FeaturedCategories catalog={catalog} cat={cat} setCat={setCat} />

      {/* المنتجات */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-fresh-ink">{cat === 'all' ? 'قائمتنا' : catalog?.categories?.find((c) => c.slug === cat)?.name_ar}</h2>
          <span className="text-[11px] font-bold text-neutral-400">{shown.length} منتج</span>
        </div>
        <div className="grid grid-cols-2 gap-3.5 pb-4 sm:grid-cols-3">
          {shown.map((p, i) => (
            <button key={p.id} onClick={() => openProduct(p)}
              className="rounded-[1.6rem] bg-white p-2.5 text-right shadow-[0_10px_30px_-18px_rgba(22,107,74,.45)] transition hover:-translate-y-1 hover:shadow-[0_16px_36px_-16px_rgba(22,107,74,.5)] anim-rise"
              style={{ animationDelay: `${i * 30}ms` }}>
              <div className="relative">
                <img src={p.image_url} alt={p.name_ar} loading="lazy" className="h-32 w-full rounded-[1.15rem] object-cover" />
                <span className="absolute bottom-2 right-2 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-black text-fresh-700 shadow">{eur(p.price_cents, cur)}</span>
              </div>
              <div className="px-1 pb-1 pt-2">
                <h3 className="truncate text-sm font-extrabold text-fresh-ink">{p.name_ar}</h3>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{p.name_en}</p>
              </div>
            </button>
          ))}
        </div>
        <p className="pb-2 text-center text-[11px] text-neutral-400">اجمع النقاط مع كل طلب واستبدلها من صفحة «استبدل نقاطك»</p>
      </section>
    </div>
  );
}
function FulfillmentModal({ onPick, onClose }: { onPick: (f: Fulfillment) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4 backdrop-blur-sm anim-fade" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-center text-lg font-extrabold text-coffee-900">كيف تستلم طلبك؟</h3>
        <p className="mt-1 text-center text-xs text-neutral-500">اختر طريقة الاستلام قبل إرسال الطلب</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="rounded-3xl border-2 border-fresh-100 bg-fresh-50 p-5 transition hover:border-sage hover:bg-sage/10 active:scale-95"
            onClick={() => onPick('pickup')}>
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-sage/20 text-sage"><Icon name="check" size={24} /></span>
            <span className="mt-3 block text-base font-extrabold text-coffee-900">استلام من المحل</span>
            <span className="mt-1 block text-[11px] text-neutral-500">جهّز طلبك وتفضل بالاستلام</span>
          </button>
          <button className="rounded-3xl border-2 border-fresh-100 bg-fresh-50 p-5 transition hover:border-gold hover:bg-gold/10 active:scale-95"
            onClick={() => onPick('delivery')}>
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-gold/15 text-fresh-700"><Icon name="pin" size={24} /></span>
            <span className="mt-3 block text-base font-extrabold text-coffee-900">توصيل</span>
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
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-gold/15 text-fresh-700"><Icon name="pin" size={30} /></span>
        <h3 className="mt-3 text-lg font-extrabold text-coffee-900">مشاركة موقعك</h3>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">نحتاج إلى موقعك لتوصيل الطلب إلى المكان الصحيح.</p>
        {err && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{err}</p>}
        <button disabled={busy} onClick={share}
          className="mt-5 w-full rounded-2xl bg-gradient-to-l from-fresh-500 to-fresh-700 py-3.5 text-base font-extrabold text-white shadow-lg shadow-fresh-900/25 transition active:scale-[.98] disabled:opacity-50">
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
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl anim-pop">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-br from-fresh-500 to-fresh-700 text-white shadow-lg shadow-fresh-900/25">
          <Icon name="check" size={30} strokeWidth={2.4} />
        </span>
        <h3 className="mt-3 text-lg font-extrabold text-coffee-900">تم تسجيل طلبك بنجاح</h3>
        <p className="mt-1 text-sm font-bold text-neutral-500">طلب رقم #{orderNumber}</p>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">ستكسب <b className="text-fresh-700">{points} نقطة</b> عند إكمال الطلب. أرسل الطلب الآن إلى المحل عبر WhatsApp:</p>
        <button onClick={send}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3.5 text-base font-extrabold text-white shadow-lg shadow-green-500/30 transition active:scale-[.98]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.7-4-4.8-4.2-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4.2.5.7 1.8.8 1.9.1.1.1.3 0 .5-.1.2-.1.3-.3.5l-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.5.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1l1.8.9c.3.1.5.2.5.3.1.1.1.7-.1 1.3Z"/></svg>
          {opened ? 'إعادة الإرسال عبر WhatsApp' : 'إرسال الطلب عبر WhatsApp'}
        </button>
        <button onClick={onClose} className="mt-3 w-full rounded-2xl py-2.5 text-sm font-bold text-neutral-500 hover:text-neutral-800">تم</button>
      </div>
    </div>
  );
}

/* ============================ صفحة المنتج ============================ */
function ProductSheet({ product, catalog, onClose, onOrder }: {
  product: Product; catalog: Catalog | null; onClose: () => void; onOrder: (line: CartLine) => void;
}) {
  const [qty, setQty] = useState(1);
  const cur = catalog?.settings?.currency_symbol ?? 'ل.س';
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm anim-fade" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-[2rem] bg-white pb-6 shadow-2xl anim-pop sm:mx-auto sm:max-w-md sm:rounded-[2rem] sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <img src={product.image_url} alt={product.name_ar} className="h-56 w-full object-cover" />
          <button onClick={onClose} className="absolute top-3 left-3 grid size-9 place-items-center rounded-full bg-black/50 text-white" aria-label="إغلاق"><Icon name="x" size={16} /></button>
        </div>
        <div className="p-5">
          <h2 className="text-xl font-black text-coffee-900">{product.name_ar}</h2>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">{product.name_en}</p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">{product.description_ar || 'مميز من Dose Coffee & More'}</p>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-fresh-50 px-4 py-3 ring-1 ring-fresh-100">
            <div className="flex items-center gap-3" dir="ltr">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-9 place-items-center rounded-full bg-white text-lg font-black text-coffee-900 shadow ring-1 ring-fresh-100">−</button>
              <span className="w-8 text-center text-lg font-black">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(50, q + 1))} className="grid size-9 place-items-center rounded-full bg-white text-lg font-black text-coffee-900 shadow ring-1 ring-fresh-100">+</button>
            </div>
            <span className="text-xl font-black text-fresh-700">{eur(product.price_cents * qty, cur)}</span>
          </div>
          <button onClick={() => onOrder({ product, qty })}
            className="mt-5 w-full rounded-2xl bg-gradient-to-l from-fresh-500 to-fresh-700 py-4 text-base font-extrabold text-white shadow-lg shadow-fresh-900/25 transition active:scale-[.98]">
            اطلب الآن
          </button>
        </div>
      </div>
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
      <div className="mb-5 rounded-3xl bg-gradient-to-l from-fresh-600 to-fresh-900 p-5 text-center text-cream shadow-lg">
        <p className="flex items-center justify-center gap-1.5 text-xs font-bold text-white"><Icon name="star" size={13} filled /> رصيد نقاطك</p>
        <p className="mt-1 text-4xl font-black">{myData?.customer?.points ?? session.customer.points}</p>
        <p className="mt-1 text-[11px] text-cream/60">استبدل نقاطك بمشروبات وحلويات مجانية</p>
      </div>
      <div className="grid grid-cols-2 gap-3 pb-4 sm:grid-cols-3">
        {catalog?.rewards?.map((r: any, i: number) => {
          const can = (myData?.customer?.points ?? session.customer.points) >= r.points_cost;
          return (
            <div key={r.id} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-fresh-100 anim-rise" style={{ animationDelay: `${i * 30}ms` }}>
              <img src={r.image_url} alt={r.name_ar} loading="lazy" className="h-28 w-full object-cover" />
              <div className="p-3 text-center">
                <h3 className="text-sm font-extrabold text-coffee-900">{r.name_ar}</h3>
                <p className="mt-1 flex items-center justify-center gap-1 text-sm font-black text-fresh-700">
                  <Icon name="star" size={13} filled /> {r.points_cost} نقطة
                </p>
                <button disabled={!can || busy} onClick={() => setConfirming(r)}
                  className="mt-3 w-full rounded-xl bg-coffee-900 py-2.5 text-sm font-extrabold text-cream transition active:scale-95 disabled:opacity-35">
                  {can ? 'استبدال' : 'نقاطك غير كافية'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {confirming && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4 backdrop-blur-sm anim-fade" onClick={() => setConfirming(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
            <img src={confirming.image_url} alt="" className="mx-auto size-20 rounded-2xl object-cover" />
            <h3 className="mt-3 text-base font-extrabold leading-relaxed text-coffee-900">هل تريد استبدال {confirming.points_cost} نقطة مقابل {confirming.name_ar}؟</h3>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button disabled={busy} onClick={async () => { setBusy(true); await onRedeem(confirming); setBusy(false); setConfirming(null); }}
                className="rounded-2xl bg-gradient-to-l from-fresh-500 to-fresh-700 py-3 text-sm font-extrabold text-white shadow active:scale-95 disabled:opacity-50">تأكيد الاستبدال</button>
              <button onClick={() => setConfirming(null)} className="rounded-2xl bg-neutral-100 py-3 text-sm font-extrabold text-neutral-600 active:scale-95">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const NeedLogin = () => (
  <div className="grid place-items-center py-20 text-center anim-rise">
    <span className="mx-auto grid size-16 place-items-center rounded-full bg-gold/15 text-fresh-700"><Icon name="lock" size={28} /></span>
    <h3 className="mt-4 text-base font-extrabold text-coffee-900">سجّل دخولك للمتابعة</h3>
    <p className="mt-1 text-xs text-neutral-500">برقم هاتفك ورمز PIN</p>
    <Link to="/login" className="mt-5 rounded-2xl bg-coffee-900 px-8 py-3 text-sm font-extrabold text-cream shadow active:scale-95">تسجيل الدخول</Link>
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
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-beige/50 text-neutral-400"><Icon name="receipt" size={28} /></span>
          <p className="mt-4 text-sm font-bold text-neutral-500">لا توجد طلبات بعد</p>
        </div>
      )}
      {orders.map((o) => (
        <div key={o.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-fresh-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-coffee-900">طلب #{o.order_number}</span>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${statusInfo(o.status).color}`}>{statusInfo(o.status).label}</span>
          </div>
          <div className="mt-2 space-y-1">
            {o.items.map((it, i) => (
              <p key={i} className="text-xs text-neutral-600">• {it.name_ar} × {it.qty} — {eur(it.unit_price_cents)}</p>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-dashed border-fresh-100 pt-3 text-xs">
            <span className="flex items-center gap-1 text-neutral-500">
              <Icon name={o.fulfillment_type === 'delivery' ? 'pin' : 'home'} size={12} />
              {o.fulfillment_type === 'delivery' ? 'توصيل' : 'استلام'} · {fmtDateTime(o.created_at)}
            </span>
            <span className="font-black text-fresh-700">{eur(o.total_cents)} · ★{o.total_points}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================ الإشعارات ============================ */
function NotificationsPage({ myData, session, onSeen }: { myData: MyData | null; session: Session | null; onSeen: () => void }) {
  useEffect(() => { onSeen(); }, []);
  if (!session) return <NeedLogin />;
  const items = myData?.notifications ?? [];
  return (
    <div className="space-y-2.5 pb-4 anim-rise">
      {items.length === 0 && (
        <div className="py-20 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-beige/50 text-neutral-400"><Icon name="bell" size={28} /></span>
          <p className="mt-4 text-sm font-bold text-neutral-500">لا توجد إشعارات حاليًا</p>
        </div>
      )}
      {items.map((n) => (
        <div key={n.id} className={`rounded-2xl p-4 shadow-sm ring-1 ${n.is_read ? 'bg-white ring-beige' : 'bg-gold/10 ring-fresh-300'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-coffee-900">{n.title}</p>
              {n.body && <p className="mt-1 text-xs leading-relaxed text-neutral-600">{n.body}</p>}
            </div>
            <span className="flex-none text-[10px] font-bold text-neutral-400">{fmtDateTime(n.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================ حسابي ============================ */
const AccountRow = ({ icon, label, onClick, badge }: { icon: IconName; label: string; onClick: () => void; badge?: number }) => (
  <button onClick={onClick} className="flex w-full items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-fresh-100 transition active:scale-[.98]">
    <span className="flex items-center gap-3 text-sm font-extrabold text-coffee-900">
      <span className="grid size-9 place-items-center rounded-xl bg-fresh-50 text-fresh-700"><Icon name={icon} size={18} /></span>
      {label}
    </span>
    <span className="flex items-center gap-2">
      {badge ? <span className="rounded-full bg-fresh-600 px-2 py-0.5 text-[10px] font-black text-white">{badge}</span> : null}
      <span className="text-neutral-300"><Icon name="chevron" size={16} /></span>
    </span>
  </button>
);

function MyCodes({ redemptions }: { redemptions: Redemption[] }) {
  return (
    <div className="mt-6 anim-rise">
      <h3 className="mb-3 text-base font-extrabold text-coffee-900">أكواد مكافآتك</h3>
      {redemptions.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-xs font-bold text-neutral-400 ring-1 ring-fresh-100">لا توجد استبدالات بعد — اجمع النقاط واستبدلها من «استبدل نقاطك»</p>}
      <div className="space-y-2.5">
        {redemptions.map((r) => (
          <div key={r.code} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-fresh-100">
            <div>
              <p className="text-sm font-extrabold text-coffee-900">{r.reward_name}</p>
              <p className="mt-0.5 text-[11px] text-neutral-400"> {r.points_cost} نقطة · {fmtDateTime(r.created_at)}</p>
            </div>
            <div className="text-center">
              <p className="rounded-xl bg-fresh-900 px-3 py-1.5 font-mono text-base font-black tracking-widest text-white" dir="ltr">{r.code}</p>
              <p className={`mt-1 text-[10px] font-extrabold ${r.status === 'unused' ? 'text-emerald-600' : 'text-neutral-400'}`}>
                {r.status === 'unused' ? 'غير مستخدم' : r.status === 'used' ? 'مستخدم' : 'منتهي'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountPage({ session, myData, waNumber, onLogout }: {
  session: Session; myData: MyData | null; waNumber: string; onLogout: () => void;
}) {
  const [showCodes, setShowCodes] = useState(false);
  const c = myData?.customer ?? session.customer;
  const redemptions = myData?.redemptions ?? [];
  return (
    <div className="anim-rise">
      <div className="rounded-3xl bg-gradient-to-l from-fresh-600 to-fresh-900 p-6 text-center text-cream shadow-lg">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-br from-fresh-500 to-fresh-700 text-2xl font-black text-white">
          {c.full_name.trim().charAt(0)}
        </span>
        <h2 className="mt-3 text-lg font-black">{c.full_name}</h2>
        <p className="mt-0.5 text-xs text-cream/60" dir="ltr">{c.phone}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 py-3"><p className="text-xl font-black text-white">{c.points}</p><p className="text-[10px] font-bold text-cream/60">نقطة</p></div>
          <div className="rounded-2xl bg-white/10 py-3"><p className="text-xl font-black text-white">{c.orders_count}</p><p className="text-[10px] font-bold text-cream/60">طلب</p></div>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        <AccountRow icon="receipt" label="الطلبات" onClick={() => _navRef?.('/orders')} />
        <AccountRow icon="gift" label="المكافأة" onClick={() => setShowCodes(true)} badge={redemptions.filter((r) => r.status === 'unused').length || undefined} />
        <a href={waChatLink(waNumber, 'مرحبًا، أحتاج مساعدة من Dose Coffee & More')} target="_blank" rel="noopener"
          className="flex w-full items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-fresh-100 transition active:scale-[.98]">
          <span className="flex items-center gap-3 text-sm font-extrabold text-coffee-900">
            <span className="grid size-9 place-items-center rounded-xl bg-fresh-50 text-fresh-700"><Icon name="headset" size={18} /></span>
            المساعدة والدعم
          </span>
          <span className="text-neutral-300"><Icon name="chevron" size={16} /></span>
        </a>
        <button onClick={onLogout}
          className="flex w-full items-center justify-between rounded-2xl bg-red-50 p-4 shadow-sm ring-1 ring-red-100 transition active:scale-[.98]">
          <span className="flex items-center gap-3 text-sm font-extrabold text-red-600">
            <span className="grid size-9 place-items-center rounded-xl bg-red-100 text-red-500"><Icon name="logout" size={18} /></span>
            تسجيل الخروج
          </span>
          <span className="text-red-300"><Icon name="chevron" size={16} /></span>
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
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-fresh-100">
        <div className="text-center"><Logo size={56} /></div>
        <h2 className="mt-4 text-center text-lg font-black text-coffee-900">تسجيل الدخول</h2>
        <p className="mt-1 text-center text-xs text-neutral-500">برقم هاتفك ورمز PIN الخاص بك</p>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" dir="ltr" placeholder="09XXXXXXXX"
          className="mt-5 h-12 w-full rounded-2xl border-2 border-fresh-100 bg-fresh-50 px-4 text-center text-base font-bold tracking-widest text-coffee-900 outline-none focus:border-fresh-500" />
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" type="password" dir="ltr" placeholder="PIN ••••"
          className="mt-3 h-12 w-full rounded-2xl border-2 border-fresh-100 bg-fresh-50 px-4 text-center text-lg font-black tracking-[.5em] outline-none focus:border-fresh-500" />
        {err && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-600">{err}</p>}
        <button onClick={submit} disabled={busy || pin.length !== 4 || phone.replace(/\D/g, '').length < 8}
          className="mt-5 w-full rounded-2xl bg-gradient-to-l from-fresh-500 to-fresh-700 py-3.5 text-base font-extrabold text-white shadow-lg shadow-fresh-900/25 active:scale-[.98] disabled:opacity-40">
          {busy ? 'جارٍ الدخول…' : 'دخول'}
        </button>
        <button onClick={() => nav('/signup')} className="mt-3 w-full py-2 text-center text-sm font-bold text-fresh-700">ليس لديك حساب؟ أنشئ حسابك الآن</button>
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
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-fresh-100">
        <h2 className="text-center text-lg font-black text-coffee-900">مرحبًا بك في <span className="font-serif text-fresh-700">Dose</span></h2>
        <p className="mt-1 text-center text-xs text-neutral-500">أنشئ حسابك الآن واستمتع بالنقاط والمكافآت</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل"
          className="mt-4 h-12 w-full rounded-2xl border-2 border-fresh-100 bg-fresh-50 px-4 text-sm font-bold outline-none focus:border-fresh-500" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" dir="ltr" placeholder="09XXXXXXXX"
          className="mt-3 h-12 w-full rounded-2xl border-2 border-fresh-100 bg-fresh-50 px-4 text-center text-sm font-bold outline-none focus:border-fresh-500" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} type="password" inputMode="numeric" dir="ltr" placeholder="PIN"
            className="h-12 w-full rounded-2xl border-2 border-fresh-100 bg-fresh-50 text-center text-base font-black tracking-widest outline-none focus:border-fresh-500" />
          <input value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 4))} type="password" inputMode="numeric" dir="ltr" placeholder="تأكيد PIN"
            className="h-12 w-full rounded-2xl border-2 border-fresh-100 bg-fresh-50 text-center text-base font-black tracking-widest outline-none focus:border-fresh-500" />
        </div>
        <p className="mt-3 rounded-xl bg-fresh-50 px-3 py-2.5 text-[11px] leading-relaxed text-neutral-500 ring-1 ring-fresh-100">
          🔒 يُستخدم رمز PIN للتحقق من هويتك عند الطلب — يُخزَّن مشفّرًا ولا يمكن لأحد رؤيته
        </p>
        {err && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-600">{err}</p>}
        <button onClick={submit} disabled={busy}
          className="mt-4 w-full rounded-2xl bg-gradient-to-l from-fresh-500 to-fresh-700 py-3.5 text-base font-extrabold text-white shadow-lg shadow-fresh-900/25 active:scale-[.98] disabled:opacity-50">
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
  const { show, node: toastNode } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [flow, setFlow] = useState<OrderFlow>({ step: null, lines: [] });
  const [pinErr, setPinErr] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [success, setSuccess] = useState<{ orderNumber: number; points: number; message: string } | null>(null);
  const [adOpen, setAdOpen] = useState<Ad | null>(null);
  const [splashDone, setSplashDone] = useState(false);
  const waNumber = catalog?.settings?.whatsapp_number ?? '963952639157';
  const cur = catalog?.settings?.currency_symbol ?? 'ل.س';

  const fsAd = useMemo(() => catalog?.ads?.find((a) => a.full_screen), [catalog]);
  const tickerAds = useMemo(() => (catalog?.ads ?? []).filter((a) => !a.full_screen), [catalog]);
  const unread = (myData?.notifications ?? []).filter((n) => !n.is_read).length;

  const startOrder = (line: CartLine) => {
    if (!session) { setProduct(null); nav('/login'); show('سجّل دخولك أولًا لإتمام الطلب'); return; }
    setProduct(null);
    setFlow({ step: 'fulfillment', lines: [line] });
  };

  const submitPin = async (pin: string) => {
    if (!session) return;
    setPinBusy(true); setPinErr('');
    try {
      const res = await rpc<any>('create_order', {
        p_customer_id: session.customer.id, p_pin: pin,
        p_fulfillment_type: flow.fulfillment ?? 'pickup',
        p_items: flow.lines.map((l) => ({ product_id: l.product.id, qty: l.qty })),
        p_latitude: flow.loc?.lat ?? null, p_longitude: flow.loc?.lng ?? null, p_map_url: flow.loc?.mapUrl ?? null,
        p_source: 'customer',
      });
      const msg = buildOrderMessage({
        orderNumber: res.order_number, customerName: res.customer_name, customerPhone: res.customer_phone,
        fulfillmentType: flow.fulfillment ?? 'pickup',
        items: flow.lines.map((l) => ({ name: l.product.name_ar, qty: l.qty, unitPriceCents: l.product.price_cents })),
        totalCents: res.total_cents, totalPoints: res.total_points,
        mapUrl: flow.loc?.mapUrl, createdAt: res.created_at,
        currencySymbol: cur,
      });
      setFlow({ step: null, lines: [] });
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
      show(`🎉 تم الاستبدال — كودك: ${res.code}`, 'ok');
      refresh();
    } catch (e: any) { show(e.message, 'err'); }
  };

  const navItems: { to: string; icon: IconName; label: string; end?: boolean }[] = [
    { to: '/', icon: 'home', label: 'الرئيسية', end: true },
    { to: '/rewards', icon: 'star', label: 'استبدل نقاطك' },
    { to: '/orders', icon: 'receipt', label: 'الطلبات' },
    { to: '/notifications', icon: 'bell', label: 'الإشعارات' },
    { to: '/account', icon: 'user', label: 'حسابي' },
  ];

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col bg-[#F3F9F4]">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-white/95 px-4 py-3 text-cream shadow-lg backdrop-blur">
        <div className="flex items-center gap-2.5">
          <Logo size={38} />
          <div className="leading-tight">
            <p className="font-serif text-base font-bold">Dose</p>
            <p className="text-[8px] font-bold uppercase tracking-[.2em] text-fresh-600">Coffee & More</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session ? (
            <>
              <span className="flex items-center gap-1 rounded-full bg-fresh-100 px-3 py-1.5 text-xs font-extrabold text-fresh-700 ring-1 ring-fresh-200">
                <Icon name="star" size={12} filled /> {myData?.customer?.points ?? session.customer.points}
              </span>
              <Link to="/notifications" className="relative grid size-10 place-items-center rounded-full bg-white/10 ring-1 ring-white/15" aria-label="الإشعارات">
                <Icon name="bell" size={18} />
                {unread > 0 && <span className="absolute -top-0.5 -left-0.5 grid size-5 place-items-center rounded-full bg-red-500 text-[10px] font-black">{unread}</span>}
              </Link>
              <Link to="/account" className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-fresh-500 to-fresh-700 text-sm font-black text-white">
                {session.customer.full_name.trim().charAt(0)}
              </Link>
            </>
          ) : (
            <Link to="/login" className="rounded-full border border-fresh-200 bg-fresh-50 px-4 py-2 text-xs font-extrabold text-fresh-700">تسجيل الدخول</Link>
          )}
        </div>
      </header>

      {/* بانر العروض — متصل بالشريط العلوي */}
      <div className="px-4 pt-3"><OfferBanners ads={tickerAds} cur={cur} onOpen={(a) => setAdOpen(a)} /></div>

      <main className="flex-1 px-4 pb-28 pt-2">
        <Routes>
          <Route path="/" element={<Home catalog={catalog} openProduct={setProduct} />} />
          <Route path="/rewards" element={<RewardsPage catalog={catalog} myData={myData} session={session} onRedeem={redeem} />} />
          <Route path="/orders" element={<OrdersPage myData={myData} session={session} />} />
          <Route path="/notifications" element={
            <NotificationsPage myData={myData} session={session}
              onSeen={() => { if (session) rpc('mark_notifications_read', { p_token: session.token }).then(refresh).catch(() => {}); }} />} />
          <Route path="/account" element={session ? (
            <AccountPage session={session} myData={myData} waNumber={waNumber}
              onLogout={async () => { if (session) await rpc('customer_logout', { p_token: session.token }).catch(() => {}); save(null); nav('/'); }} />
          ) : <NeedLogin />} />
          <Route path="/login" element={<LoginPage onLogged={(s) => { save(s); nav('/'); show('أهلًا بك ' + s.customer.full_name, 'ok'); }} />} />
          <Route path="/signup" element={<SignupPage onLogged={(s) => { save(s); nav('/'); show('تم إنشاء حسابك بنجاح', 'ok'); }} />} />
          <Route path="*" element={<div className="py-20 text-center text-sm font-bold text-neutral-400">الصفحة غير موجودة</div>} />
        </Routes>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-lg items-center justify-around border-t border-fresh-100 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-8px_24px_-12px_rgba(0,0,0,.15)] backdrop-blur">
        {navItems.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}
            className={({ isActive }) => `flex flex-col items-center gap-1 rounded-2xl px-2.5 py-1.5 text-[10px] font-extrabold transition ${isActive ? 'text-fresh-700' : 'text-neutral-400'}`}>
            {({ isActive }) => (<>
              <span className={`grid size-8 place-items-center rounded-xl transition ${isActive ? 'bg-gold/15' : ''}`}><Icon name={t.icon} size={19} filled={isActive && t.icon === 'star'} /></span>
              {t.label}
            </>)}
          </NavLink>
        ))}
      </nav>

      {product && <ProductSheet product={product} catalog={catalog} onClose={() => setProduct(null)} onOrder={startOrder} />}

      {/* نافذة تفاصيل الإعلان من الشريط */}
      {adOpen && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4 backdrop-blur-sm anim-fade" onClick={() => setAdOpen(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
            <img src={adOpen.image_url} alt={adOpen.title} className="h-56 w-full object-cover" />
            <div className="p-5 text-center">
              <h3 className="text-lg font-black text-coffee-900">{adOpen.title}</h3>
              <p className="mt-1 text-sm text-neutral-500">{adOpen.description_ar}</p>
              {adOpen.new_price_cents != null && (
                <div className="mt-3 flex items-center justify-center gap-3">
                  {adOpen.old_price_cents != null && <span className="text-sm font-bold text-neutral-400 line-through">{eur(adOpen.old_price_cents, cur)}</span>}
                  <span className="text-2xl font-black text-fresh-700">{eur(adOpen.new_price_cents, cur)}</span>
                </div>
              )}
              <button onClick={() => setAdOpen(null)} className="mt-4 w-full rounded-2xl bg-gradient-to-l from-fresh-500 to-fresh-700 py-3 text-sm font-extrabold text-white shadow active:scale-[.98]">تصفح القائمة</button>
            </div>
            <button onClick={() => setAdOpen(null)} className="absolute top-3 left-3 grid size-9 place-items-center rounded-full bg-black/50 text-white" aria-label="إغلاق"><Icon name="x" size={16} /></button>
          </div>
        </div>
      )}

      {/* الإعلان الحصري عند الدخول */}
      {fsAd && !splashDone && <SplashAd ad={fsAd} cur={cur} onClose={() => setSplashDone(true)} />}

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
      {toastNode}
    </div>
  );
}
