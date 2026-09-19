import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { rpc } from '../lib/supabase';
import type { Ad, AppNotification, CartLine, Catalog, MyData, MyOrder, Product, Redemption, Session } from '../lib/types';
import { eur, fmtDateTime, deviceId, getCurrentLocation } from '../lib/utils';
import { buildOrderMessage, waChatLink, whatsapp } from '../lib/whatsapp';
import PinPad from '../components/PinPad';

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
      if (d?.customer) {
        setMyData(d);
        setSession({ token: cur.token, customer: d.customer });
      } else {
        localStorage.removeItem(SESSION_KEY);
        setSession(null); setMyData(null);
      }
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
    className="rounded-xl border-2 border-gold/50 object-cover shadow" />
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
      toast.kind === 'err' ? 'bg-red-600 text-white' : 'bg-coffee-900 text-cream'}`}>{toast.msg}</div>
  ) : null;
  return { show, node };
}

type Fulfillment = 'pickup' | 'delivery';
interface OrderFlow { step: 'fulfillment' | 'location' | 'pin' | null; lines: CartLine[]; fulfillment?: Fulfillment; loc?: { lat: number; lng: number; mapUrl: string } }

/* ============================ نوافذ تدفق الطلب ============================ */
function FulfillmentModal({ onPick, onClose }: { onPick: (f: Fulfillment) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4 backdrop-blur-sm anim-fade" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-center text-lg font-extrabold text-coffee-900">كيف تستلم طلبك؟</h3>
        <p className="mt-1 text-center text-xs text-neutral-500">اختر طريقة الاستلام قبل إرسال الطلب</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="rounded-3xl border-2 border-beige bg-[#FAF5EA] p-5 transition hover:border-sage hover:bg-sage/10 active:scale-95"
            onClick={() => onPick('pickup')}>
            <span className="block text-4xl">🏪</span>
            <span className="mt-3 block text-base font-extrabold text-coffee-900">استلام من المحل</span>
            <span className="mt-1 block text-[11px] text-neutral-500">جهّز طلبك وتفضل بالاستلام</span>
          </button>
          <button className="rounded-3xl border-2 border-beige bg-[#FAF5EA] p-5 transition hover:border-gold hover:bg-gold/10 active:scale-95"
            onClick={() => onPick('delivery')}>
            <span className="block text-4xl">🚚</span>
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
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-gold/15 text-3xl">📍</span>
        <h3 className="mt-3 text-lg font-extrabold text-coffee-900">مشاركة موقعك</h3>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">نحتاج إلى موقعك لتوصيل الطلب إلى المكان الصحيح.</p>
        {err && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{err}</p>}
        <button disabled={busy} onClick={share}
          className="mt-5 w-full rounded-2xl bg-gradient-to-l from-gold to-gold-deep py-3.5 text-base font-extrabold text-white shadow-lg shadow-gold/40 transition active:scale-[.98] disabled:opacity-50">
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
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-br from-gold to-gold-deep text-white shadow-lg shadow-gold/40">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4.2 4.2L19 7.5"/></svg>
        </span>
        <h3 className="mt-3 text-lg font-extrabold text-coffee-900">تم تسجيل طلبك بنجاح</h3>
        <p className="mt-1 text-sm font-bold text-neutral-500">طلب رقم #{orderNumber}</p>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">ستكسب <b className="text-gold-deep">{points} نقطة</b> عند إكمال الطلب. أرسل الطلب الآن إلى المحل عبر WhatsApp:</p>
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

/* ============================ الرئيسية ============================ */
function Home({ catalog, openProduct }: { catalog: Catalog | null; openProduct: (p: Product) => void }) {
  const [cat, setCat] = useState('all');
  const [fsAdShown, setFsAdShown] = useState(false);
  const fsAd: Ad | undefined = useMemo(() => catalog?.ads?.find((a) => a.full_screen), [catalog]);
  const products = catalog?.products ?? [];
  const shown = cat === 'all' ? products : products.filter((p) => p.category === cat);
  const cur = catalog?.settings?.currency_symbol ?? '€';

  return (
    <div className="anim-rise">
      {fsAd && !fsAdShown && (
        <div className="fixed inset-0 z-[140] grid place-items-center bg-black/80 p-4 backdrop-blur-sm anim-fade">
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl anim-pop">
            <img src={fsAd.image_url} alt={fsAd.title} className="h-64 w-full object-cover" />
            <div className="p-5 text-center">
              <h3 className="text-xl font-extrabold text-coffee-900">{fsAd.title}</h3>
              <p className="mt-1 text-sm text-neutral-500">{fsAd.description_ar}</p>
              {fsAd.new_price_cents != null && (
                <div className="mt-3 flex items-center justify-center gap-3">
                  {fsAd.old_price_cents != null && <span className="text-sm font-bold text-neutral-400 line-through">{eur(fsAd.old_price_cents, cur)}</span>}
                  <span className="text-2xl font-black text-gold-deep">{eur(fsAd.new_price_cents, cur)}</span>
                </div>
              )}
              <button onClick={() => setFsAdShown(true)} className="mt-4 w-full rounded-2xl bg-gradient-to-l from-gold to-gold-deep py-3 text-base font-extrabold text-white shadow-lg shadow-gold/40 active:scale-[.98]">
                تصفح القائمة
              </button>
            </div>
            <button onClick={() => setFsAdShown(true)} className="absolute top-3 left-3 grid size-9 place-items-center rounded-full bg-black/50 text-white" aria-label="إغلاق">✕</button>
          </div>
        </div>
      )}

      {catalog && catalog.ads.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-base font-extrabold text-coffee-900">🔥 عروض اليوم</h2>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {catalog.ads.map((a) => (
              <div key={a.id} className="w-56 flex-none overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-beige anim-rise">
                <div className="relative">
                  <img src={a.image_url} alt={a.title} className="h-28 w-full object-cover" loading="lazy" />
                  {a.discount_percent != null && (
                    <span className="absolute top-2 left-2 rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-black text-white">-{a.discount_percent}%</span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-extrabold text-coffee-900">{a.title}</h3>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">{a.description_ar}</p>
                  {a.new_price_cents != null && (
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-lg font-black text-gold-deep">{eur(a.new_price_cents, cur)}</span>
                      {a.old_price_cents != null && <span className="text-xs font-bold text-neutral-400 line-through">{eur(a.old_price_cents, cur)}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        <button onClick={() => setCat('all')}
          className={`flex-none rounded-full px-4 py-2 text-sm font-bold transition ${cat === 'all' ? 'bg-coffee-900 text-cream shadow' : 'bg-white text-neutral-600 ring-1 ring-beige'}`}>الكل</button>
        {catalog?.categories?.map((c) => (
          <button key={c.id} onClick={() => setCat(c.slug)}
            className={`flex-none rounded-full px-4 py-2 text-sm font-bold transition ${cat === c.slug ? 'bg-coffee-900 text-cream shadow' : 'bg-white text-neutral-600 ring-1 ring-beige'}`}>
            {c.emoji} {c.name_ar}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 pb-4 sm:grid-cols-3">
        {shown.map((p, i) => (
          <button key={p.id} onClick={() => openProduct(p)}
            className="overflow-hidden rounded-3xl bg-white text-right shadow-sm ring-1 ring-beige transition hover:-translate-y-0.5 hover:shadow-lg anim-rise"
            style={{ animationDelay: `${i * 30}ms` }}>
            <div className="h-32 bg-beige/40"><img src={p.image_url} alt={p.name_ar} loading="lazy" className="size-full object-cover" /></div>
            <div className="p-3">
              <h3 className="text-sm font-extrabold leading-snug text-coffee-900">{p.name_ar}</h3>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{p.name_en}</p>
              <p className="mt-1.5 text-base font-black text-gold-deep">{eur(p.price_cents, cur)}</p>
            </div>
          </button>
        ))}
      </div>
      <p className="pb-2 text-center text-[11px] text-neutral-400">اجمع النقاط مع كل طلب واستبدلها من صفحة «استبدل نقاطك»</p>
    </div>
  );
}

/* ============================ صفحة المنتج ============================ */
function ProductSheet({ product, catalog, onClose, onOrder }: {
  product: Product; catalog: Catalog | null; onClose: () => void; onOrder: (line: CartLine) => void;
}) {
  const [qty, setQty] = useState(1);
  const cur = catalog?.settings?.currency_symbol ?? '€';
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm anim-fade" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-[2rem] bg-white pb-6 shadow-2xl anim-pop sm:mx-auto sm:max-w-md sm:rounded-[2rem] sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <img src={product.image_url} alt={product.name_ar} className="h-56 w-full object-cover" />
          <button onClick={onClose} className="absolute top-3 left-3 grid size-9 place-items-center rounded-full bg-black/50 text-white" aria-label="إغلاق">✕</button>
        </div>
        <div className="p-5">
          <h2 className="text-xl font-black text-coffee-900">{product.name_ar}</h2>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">{product.name_en}</p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">{product.description_ar || 'مميز من Dose Coffee & More'}</p>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#FAF5EA] px-4 py-3 ring-1 ring-beige">
            <div className="flex items-center gap-3" dir="ltr">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-9 place-items-center rounded-full bg-white text-lg font-black text-coffee-900 shadow ring-1 ring-beige">−</button>
              <span className="w-8 text-center text-lg font-black">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(50, q + 1))} className="grid size-9 place-items-center rounded-full bg-white text-lg font-black text-coffee-900 shadow ring-1 ring-beige">+</button>
            </div>
            <span className="text-xl font-black text-gold-deep">{eur(product.price_cents * qty, cur)}</span>
          </div>
          <button onClick={() => onOrder({ product, qty })}
            className="mt-5 w-full rounded-2xl bg-gradient-to-l from-gold to-gold-deep py-4 text-base font-extrabold text-white shadow-lg shadow-gold/40 transition active:scale-[.98]">
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
  if (!session) return <NeedLogin title="سجّل دخولك لاستبدال نقاطك" />;
  return (
    <div className="anim-rise">
      <div className="mb-5 rounded-3xl bg-gradient-to-l from-coffee-800 to-coffee-950 p-5 text-center text-cream shadow-lg">
        <p className="text-xs font-bold text-gold">رصيد نقاطك</p>
        <p className="mt-1 text-4xl font-black">{myData?.customer?.points ?? session.customer.points}</p>
        <p className="mt-1 text-[11px] text-cream/60">استبدل نقاطك بمشروبات وحلويات مجانية</p>
      </div>
      <div className="grid grid-cols-2 gap-3 pb-4 sm:grid-cols-3">
        {catalog?.rewards?.map((r: any, i: number) => {
          const can = (myData?.customer?.points ?? session.customer.points) >= r.points_cost;
          return (
            <div key={r.id} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-beige anim-rise" style={{ animationDelay: `${i * 30}ms` }}>
              <img src={r.image_url} alt={r.name_ar} loading="lazy" className="h-28 w-full object-cover" />
              <div className="p-3 text-center">
                <h3 className="text-sm font-extrabold text-coffee-900">{r.name_ar}</h3>
                <p className="mt-1 flex items-center justify-center gap-1 text-sm font-black text-gold-deep">⭐ {r.points_cost} نقطة</p>
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
                className="rounded-2xl bg-gradient-to-l from-gold to-gold-deep py-3 text-sm font-extrabold text-white shadow active:scale-95 disabled:opacity-50">تأكيد الاستبدال</button>
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
    <span className="grid size-16 place-items-center rounded-full bg-gold/15 text-3xl">🔐</span>
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
        <div className="py-20 text-center"><span className="text-5xl">🧾</span><p className="mt-4 text-sm font-bold text-neutral-500">لا توجد طلبات بعد</p></div>
      )}
      {orders.map((o) => (
        <div key={o.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-beige">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-coffee-900">طلب #{o.order_number}</span>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${statusInfo(o.status).color}`}>{statusInfo(o.status).label}</span>
          </div>
          <div className="mt-2 space-y-1">
            {o.items.map((it, i) => (
              <p key={i} className="text-xs text-neutral-600">• {it.name_ar} × {it.qty} — {eur(it.unit_price_cents)}</p>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-dashed border-beige pt-3 text-xs">
            <span className="text-neutral-500">{o.fulfillment_type === 'delivery' ? '🚚 توصيل' : '🏪 استلام'} · {fmtDateTime(o.created_at)}</span>
            <span className="font-black text-gold-deep">{eur(o.total_cents)} · ⭐{o.total_points}</span>
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
        <div className="py-20 text-center"><span className="text-5xl">🔔</span><p className="mt-4 text-sm font-bold text-neutral-500">لا توجد إشعارات حاليًا</p></div>
      )}
      {items.map((n) => (
        <div key={n.id} className={`rounded-2xl p-4 shadow-sm ring-1 ${n.is_read ? 'bg-white ring-beige' : 'bg-gold/10 ring-gold/40'}`}>
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
const AccountRow = ({ icon, label, onClick, badge }: { icon: string; label: string; onClick: () => void; badge?: number }) => (
  <button onClick={onClick} className="flex w-full items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-beige transition active:scale-[.98]">
    <span className="flex items-center gap-3 text-sm font-extrabold text-coffee-900">{icon} {label}</span>
    <span className="flex items-center gap-2">
      {badge ? <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-black text-white">{badge}</span> : null}
      <span className="text-neutral-300">←</span>
    </span>
  </button>
);

function MyCodes({ redemptions }: { redemptions: Redemption[] }) {
  return (
    <div className="mt-6 anim-rise">
      <h3 className="mb-3 text-base font-extrabold text-coffee-900">أكواد مكافآتك</h3>
      {redemptions.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-xs font-bold text-neutral-400 ring-1 ring-beige">لا توجد استبدالات بعد — اجمع النقاط واستبدلها من «استبدل نقاطك»</p>}
      <div className="space-y-2.5">
        {redemptions.map((r) => (
          <div key={r.code} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-beige">
            <div>
              <p className="text-sm font-extrabold text-coffee-900">{r.reward_name}</p>
              <p className="mt-0.5 text-[11px] text-neutral-400">⭐ {r.points_cost} نقطة · {fmtDateTime(r.created_at)}</p>
            </div>
            <div className="text-center">
              <p className="rounded-xl bg-coffee-950 px-3 py-1.5 font-mono text-base font-black tracking-widest text-gold" dir="ltr">{r.code}</p>
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
      <div className="rounded-3xl bg-gradient-to-l from-coffee-800 to-coffee-950 p-6 text-center text-cream shadow-lg">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-br from-gold to-gold-deep text-2xl font-black text-white">
          {c.full_name.trim().charAt(0)}
        </span>
        <h2 className="mt-3 text-lg font-black">{c.full_name}</h2>
        <p className="mt-0.5 text-xs text-cream/60" dir="ltr">{c.phone}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 py-3"><p className="text-xl font-black text-gold">{c.points}</p><p className="text-[10px] font-bold text-cream/60">نقطة</p></div>
          <div className="rounded-2xl bg-white/10 py-3"><p className="text-xl font-black text-gold">{c.orders_count}</p><p className="text-[10px] font-bold text-cream/60">طلب</p></div>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        <AccountRow icon="🧾" label="الطلبات" onClick={() => useNavGo('/orders')} />
        <AccountRow icon="🎁" label="المكافأة" onClick={() => setShowCodes(true)} badge={redemptions.filter((r) => r.status === 'unused').length || undefined} />
        <a href={waChatLink(waNumber, 'مرحبًا، أحتاج مساعدة من Dose Coffee & More')} target="_blank" rel="noopener"
          className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-beige transition active:scale-[.98]">
          <span className="flex items-center gap-3 text-sm font-extrabold text-coffee-900">💬 المساعدة والدعم</span>
          <span className="text-neutral-300">←</span>
        </a>
        <button onClick={onLogout}
          className="flex w-full items-center justify-between rounded-2xl bg-red-50 p-4 shadow-sm ring-1 ring-red-100 transition active:scale-[.98]">
          <span className="flex items-center gap-3 text-sm font-extrabold text-red-600">🚪 تسجيل الخروج</span>
          <span className="text-red-300">←</span>
        </button>
      </div>

      {showCodes && <MyCodes redemptions={redemptions} />}
    </div>
  );
}

// مخرج تنقل بسيط من داخل الصفحة
let _navRef: ((to: string) => void) | null = null;
const useNavGo = (to: string) => { _navRef?.(to); };

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
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-beige">
        <div className="text-center"><Logo size={56} /></div>
        <h2 className="mt-4 text-center text-lg font-black text-coffee-900">تسجيل الدخول</h2>
        <p className="mt-1 text-center text-xs text-neutral-500">برقم هاتفك ورمز PIN الخاص بك</p>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" dir="ltr" placeholder="09XXXXXXXX"
          className="mt-5 h-12 w-full rounded-2xl border-2 border-beige bg-[#FAF5EA] px-4 text-center text-base font-bold tracking-widest text-coffee-900 outline-none focus:border-gold" />
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" type="password" dir="ltr" placeholder="PIN ••••"
          className="mt-3 h-12 w-full rounded-2xl border-2 border-beige bg-[#FAF5EA] px-4 text-center text-lg font-black tracking-[.5em] outline-none focus:border-gold" />
        {err && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-600">{err}</p>}
        <button onClick={submit} disabled={busy || pin.length !== 4 || phone.replace(/\D/g, '').length < 8}
          className="mt-5 w-full rounded-2xl bg-gradient-to-l from-gold to-gold-deep py-3.5 text-base font-extrabold text-white shadow-lg shadow-gold/40 active:scale-[.98] disabled:opacity-40">
          {busy ? 'جارٍ الدخول…' : 'دخول'}
        </button>
        <button onClick={() => nav('/signup')} className="mt-3 w-full py-2 text-center text-sm font-bold text-gold-deep">ليس لديك حساب؟ أنشئ حسابك الآن</button>
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
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-beige">
        <h2 className="text-center text-lg font-black text-coffee-900">مرحبًا بك في <span className="font-serif text-gold-deep">Dose</span></h2>
        <p className="mt-1 text-center text-xs text-neutral-500">أنشئ حسابك الآن واستمتع بالنقاط والمكافآت</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل"
          className="mt-4 h-12 w-full rounded-2xl border-2 border-beige bg-[#FAF5EA] px-4 text-sm font-bold outline-none focus:border-gold" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" dir="ltr" placeholder="09XXXXXXXX"
          className="mt-3 h-12 w-full rounded-2xl border-2 border-beige bg-[#FAF5EA] px-4 text-center text-sm font-bold outline-none focus:border-gold" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} type="password" inputMode="numeric" dir="ltr" placeholder="PIN"
            className="h-12 w-full rounded-2xl border-2 border-beige bg-[#FAF5EA] text-center text-base font-black tracking-widest outline-none focus:border-gold" />
          <input value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 4))} type="password" inputMode="numeric" dir="ltr" placeholder="تأكيد PIN"
            className="h-12 w-full rounded-2xl border-2 border-beige bg-[#FAF5EA] text-center text-base font-black tracking-widest outline-none focus:border-gold" />
        </div>
        <p className="mt-3 rounded-xl bg-[#FAF5EA] px-3 py-2.5 text-[11px] leading-relaxed text-neutral-500 ring-1 ring-beige">
          🔒 يُستخدم رمز PIN للتحقق من هويتك عند الطلب — يُخزَّن مشفّرًا ولا يمكن لأحد رؤيته
        </p>
        {err && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-600">{err}</p>}
        <button onClick={submit} disabled={busy}
          className="mt-4 w-full rounded-2xl bg-gradient-to-l from-gold to-gold-deep py-3.5 text-base font-extrabold text-white shadow-lg shadow-gold/40 active:scale-[.98] disabled:opacity-50">
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
  const waNumber = catalog?.settings?.whatsapp_number ?? '963952639157';

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
        currencySymbol: catalog?.settings?.currency_symbol,
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

  const navItems = [
    { to: '/', icon: '🏠', label: 'الرئيسية', end: true },
    { to: '/rewards', icon: '⭐', label: 'استبدل نقاطك' },
    { to: '/orders', icon: '🧾', label: 'الطلبات' },
    { to: '/notifications', icon: '🔔', label: 'الإشعارات' },
    { to: '/account', icon: '👤', label: 'حسابي' },
  ];

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col bg-[#F6F0E5]">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-coffee-950/95 px-4 py-3 text-cream shadow-lg backdrop-blur">
        <div className="flex items-center gap-2.5">
          <Logo size={38} />
          <div className="leading-tight">
            <p className="font-serif text-base font-bold">Dose</p>
            <p className="text-[8px] font-bold uppercase tracking-[.2em] text-gold/80">Coffee & More</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session ? (
            <>
              <span className="rounded-full bg-gold/15 px-3 py-1.5 text-xs font-extrabold text-gold ring-1 ring-gold/30">⭐ {myData?.customer?.points ?? session.customer.points}</span>
              <Link to="/notifications" className="relative grid size-10 place-items-center rounded-full bg-white/10 ring-1 ring-white/15" aria-label="الإشعارات">
                <span className="text-lg">🔔</span>
                {unread > 0 && <span className="absolute -top-0.5 -left-0.5 grid size-5 place-items-center rounded-full bg-red-500 text-[10px] font-black">{unread}</span>}
              </Link>
              <Link to="/account" className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-gold to-gold-deep text-sm font-black text-white">
                {session.customer.full_name.trim().charAt(0)}
              </Link>
            </>
          ) : (
            <Link to="/login" className="rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-xs font-extrabold text-gold">تسجيل الدخول</Link>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-5">
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
          <Route path="/login" element={<LoginPage onLogged={(s) => { save(s); nav('/'); }} />} />
          <Route path="/signup" element={<SignupPage onLogged={(s) => { save(s); nav('/'); show('تم إنشاء حسابك بنجاح 🎉', 'ok'); }} />} />
        </Routes>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-lg items-center justify-around border-t border-beige bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-8px_24px_-12px_rgba(0,0,0,.15)] backdrop-blur">
        {navItems.map((t) => (
          <NavLink key={t.to} to={t.to} end={'end' in t ? (t as any).end : false}
            className={({ isActive }) => `flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px] font-extrabold transition ${isActive ? 'text-gold-deep' : 'text-neutral-400'}`}>
            <span className="text-xl">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>

      {product && <ProductSheet product={product} catalog={catalog} onClose={() => setProduct(null)} onOrder={startOrder} />}

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
