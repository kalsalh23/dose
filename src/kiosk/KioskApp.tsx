import { useCallback, useEffect, useRef, useState } from 'react';
import { rpc } from '../lib/supabase';
import type { Catalog, Product } from '../lib/types';
import { deviceId, getCurrentLocation } from '../lib/utils';
import { buildOrderMessage, whatsapp } from '../lib/whatsapp';
import PinPad from '../components/PinPad';

/* ============================================================
   منصة المحل الداخلية — Tablet Kiosk
   التصميم المعتمد: رملي F3DEBA · ميرمية ABC4AA · تايب 675D50
   التدفق: اسم ← منتجات ← استلام/توصيل ← (موقع) ← PIN ← WhatsApp
   ============================================================ */

type Fulfillment = 'pickup' | 'delivery';
interface Suggestion { id: string; full_name: string; mask: string }
type Step = 'idle' | 'fulfillment' | 'location' | 'pin' | 'success';

export default function KioskApp() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [cat, setCat] = useState('hot');
  const [cart, setCart] = useState<Map<number, number>>(new Map());
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[] | 'idle' | 'loading' | 'empty' | 'error'>('idle');
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [view, setView] = useState<'lookup' | 'signup'>('lookup');
  const [step, setStep] = useState<Step>('idle');
  const [loc, setLoc] = useState<{ lat: number; lng: number; mapUrl: string } | null>(null);
  const [pinErr, setPinErr] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [done, setDone] = useState<{ orderNumber: number; points: number; message: string; waSent: boolean } | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind?: 'ok' | 'err' } | null>(null);
  const searchTimer = useRef<number | undefined>(undefined);
  const waNumber = catalog?.settings?.whatsapp_number ?? '963952639157';

  const showToast = (msg: string, kind?: 'ok' | 'err') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => { rpc<Catalog>('get_catalog').then(setCatalog).catch(() => {}); }, []);

  // بحث الأسماء مع اقتراحات
  const onQuery = (q: string) => {
    setQuery(q);
    clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setSuggestions('idle'); return; }
    setSuggestions('loading');
    searchTimer.current = window.setTimeout(async () => {
      try {
        const rows = await rpc<Suggestion[]>('search_customers', { p_query: q });
        setSuggestions(rows.length ? rows : 'empty');
      } catch { setSuggestions('error'); }
    }, 250);
  };

  const products = (catalog?.products ?? []).filter((p) => p.category === cat);
  const itemsCount = [...cart.values()].reduce((a, b) => a + b, 0);

  const addProduct = (p: Product) => {
    setCart((m) => new Map(m).set(p.id, (m.get(p.id) ?? 0) + 1));
  };
  const decProduct = (p: Product) => {
    setCart((m) => { const n = new Map(m); const q = (n.get(p.id) ?? 0) - 1; if (q <= 0) n.delete(p.id); else n.set(p.id, q); return n; });
  };

  const orderNow = () => {
    if (!cart.size) return showToast('اضغط على المنتجات لإضافتها إلى طلبك');
    if (!customer) { showToast('اختر اسمك أولًا من البطاقة'); return; }
    setStep('fulfillment');
  };

  const reset = () => {
    setCart(new Map()); setCustomer(null); setQuery(''); setSuggestions('idle');
    setLoc(null); setStep('idle'); setDone(null); setView('lookup');
  };

  const submitPin = async (pin: string) => {
    if (!customer) return;
    setPinBusy(true); setPinErr('');
    try {
      const items = [...cart.entries()].map(([product_id, qty]) => ({ product_id, qty }));
      const res = await rpc<any>('create_order', {
        p_customer_id: customer.id, p_pin: pin,
        p_fulfillment_type: loc ? 'delivery' : 'pickup',
        p_items: items,
        p_latitude: loc?.lat ?? null, p_longitude: loc?.lng ?? null, p_map_url: loc?.mapUrl ?? null,
        p_source: 'kiosk',
      });
      const lines = [...cart.entries()].map(([pid, qty]) => {
        const p = catalog!.products.find((x) => x.id === pid)!;
        return { name: p.name_ar, qty, unitPriceCents: p.price_cents };
      });
      const message = buildOrderMessage({
        orderNumber: res.order_number, customerName: res.customer_name, customerPhone: res.customer_phone,
        fulfillmentType: loc ? 'delivery' : 'pickup', items: lines,
        totalCents: res.total_cents, totalPoints: res.total_points,
        mapUrl: loc?.mapUrl, createdAt: res.created_at,
        currencySymbol: catalog?.settings?.currency_symbol,
      });
      const waSent = whatsapp.send(waNumber, message);
      setDone({ orderNumber: res.order_number, points: res.total_points, message, waSent });
      setStep('success');
    } catch (e: any) {
      setPinErr(e.message);
    } finally { setPinBusy(false); }
  };

  return (
    <div className="flex h-full flex-col" style={{ background: 'linear-gradient(180deg,#F6E3C2,#F3DEBA)' }}>
      {/* ===== الشريط العلوي ===== */}
      <header className="flex h-14 flex-row-reverse items-center justify-between px-5 shadow-lg"
        style={{ background: 'linear-gradient(180deg,#7A6F60,#675D50)' }}>
        <div className="flex flex-row-reverse items-center gap-3">
          <img src="/logo.jpg" alt="Dose" className="size-10 rounded-xl border-2 object-cover" style={{ borderColor: 'rgba(243,222,186,.85)' }} />
          <div className="text-right leading-tight">
            <p className="font-serif text-lg font-bold" style={{ color: '#FBF2DD' }}>Dose</p>
            <p className="text-[8.5px] font-bold uppercase tracking-[.26em]" style={{ color: '#D8C6A4' }}>Coffee & More</p>
          </div>
        </div>
        <button onClick={() => { setView('signup'); }}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold transition hover:brightness-110 active:scale-95"
          style={{ background: 'rgba(243,222,186,.1)', border: '1px solid rgba(243,222,186,.45)', color: '#F3DEBA' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>
          لا أملك حساب
        </button>
      </header>

      {/* ===== الجسم ===== */}
      <main className="grid min-h-0 flex-1 gap-3 p-3" style={{ gridTemplateColumns: 'minmax(0,1fr) clamp(300px,25vw,352px)' }}>
        {/* المنتجات — يمين */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-[18px] border bg-[#FFFDF6] shadow-lg" style={{ borderColor: '#E7D8B9' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5" style={{ borderColor: '#E7D8B9' }}>
            <div>
              <h1 className="text-[15.5px] font-extrabold" style={{ color: '#3E382E' }}>قائمة <span className="font-serif" style={{ color: '#675D50' }}>Dose</span></h1>
              <p className="mt-0.5 text-[11px]" style={{ color: '#A3967D' }}>اضغط على المنتج لإضافته إلى طلبك</p>
            </div>
            <div className="flex gap-1 rounded-full p-1" style={{ background: '#FAF1DC', border: '1px solid #E7D8B9' }}>
              {catalog?.categories?.filter((c) => c.slug !== 'extras').map((c) => (
                <button key={c.id} onClick={() => setCat(c.slug)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition ${cat === c.slug ? 'shadow' : ''}`}
                  style={cat === c.slug ? { background: '#675D50', color: '#F3DEBA' } : { color: '#6E6553' }}>
                  {c.emoji} {c.name_ar}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gridAutoRows: '141px' }}>
              {products.map((p, i) => {
                const qty = cart.get(p.id) ?? 0;
                return (
                  <button key={p.id} onClick={() => addProduct(p)}
                    className="anim-rise flex flex-col overflow-hidden rounded-2xl bg-white text-right transition active:scale-[.97]"
                    style={{
                      border: `2px solid ${qty ? '#ABC4AA' : '#EFE3C8'}`,
                      boxShadow: qty ? '0 0 0 3px rgba(171,196,170,.35)' : undefined,
                      animationDelay: `${i * 35}ms`,
                    }}>
                    <div className="relative min-h-0 flex-1 overflow-hidden" style={{ background: '#EFDDBB' }}>
                      <img src={p.image_url} alt={p.name_ar} className="size-full object-cover" loading="lazy" />
                      {qty > 0 && (
                        <span className="absolute top-1.5 right-1.5 grid min-w-6 place-items-center rounded-full border-2 border-white px-1.5 py-0.5 text-[11.5px] font-extrabold text-white"
                          style={{ background: '#675D50' }}>×{qty}</span>
                      )}
                    </div>
                    <div className="px-2.5 pb-2 pt-1.5">
                      <h3 className="truncate text-[13px] font-extrabold" style={{ color: '#3E382E' }}>{p.name_ar}</h3>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-extrabold" style={{ color: '#675D50' }}>
                        ⭐ {p.points} {p.points === 2 ? 'نقطة' : p.points > 2 && p.points < 11 ? 'نقاط' : 'نقطة'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ادخل اسمك + الطلب — يسار */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-[18px] border bg-[#FFFDF6] shadow-lg" style={{ borderColor: '#E7D8B9' }}>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
            {view === 'lookup' ? (
              <div className="flex flex-1 flex-col">
                <img src="/logo.jpg" alt="" className="mx-auto size-12 rounded-xl border-2 border-white object-cover shadow-md" />
                <h2 className="mt-2.5 text-center text-[17.5px] font-extrabold" style={{ color: '#3E382E' }}>ادخل اسمك</h2>
                <p className="mb-3 mt-1 text-center text-[11.5px]" style={{ color: '#6E6553' }}>اكتب اسمك واختره من القائمة، ثم أكّد طلبك برمز PIN</p>

                <div className="relative mb-2.5">
                  <svg className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A3967D" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.8-3.8"/></svg>
                  <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="اكتب اسمك هنا…"
                    className="h-11 w-full rounded-xl border-[1.5px] bg-white pr-10 pl-3 text-sm font-bold outline-none transition focus:shadow-sm"
                    style={{ borderColor: '#D9C49C', color: '#3E382E' }} />
                </div>

                {customer ? (
                  <div className="mb-2.5 flex items-center gap-2.5 rounded-xl p-2.5 anim-pop" style={{ background: '#E9F0E7', border: '1.5px solid #ABC4AA' }}>
                    <span className="grid size-7 place-items-center rounded-full text-white" style={{ background: '#ABC4AA' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 13l4.2 4.2L19 7.5"/></svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-sm font-extrabold" style={{ color: '#3E382E' }}>{customer.name}</b>
                      <small className="text-[10.5px]" style={{ color: '#6E6553' }}>تم اختيار اسمك</small>
                    </div>
                    <button onClick={() => { setCustomer(null); setQuery(''); setSuggestions('idle'); }}
                      className="rounded-lg border bg-white px-2.5 py-1.5 text-[11.5px] font-bold transition hover:brightness-95"
                      style={{ borderColor: '#D9C49C', color: '#6E6553' }}>تغيير</button>
                  </div>
                ) : (
                  <div className="mb-2.5 flex max-h-44 min-h-[70px] flex-col gap-1.5 overflow-y-auto rounded-xl p-1.5"
                    style={{ background: '#FAF1DC', border: '1px solid #E7D8B9' }}>
                    {suggestions === 'idle' && <p className="p-3 text-center text-[11px] leading-relaxed" style={{ color: '#A3967D' }}>ابدأ بكتابة أول حروف اسمك…</p>}
                    {suggestions === 'loading' && <p className="p-3 text-center text-[11px]" style={{ color: '#A3967D' }}>جارٍ البحث…</p>}
                    {suggestions === 'empty' && <p className="p-3 text-center text-[11px] leading-relaxed" style={{ color: '#A3967D' }}>لا يوجد اسم مطابق — إن لم تكن مسجلًا اضغط «لا أملك حساب» بالأعلى</p>}
                    {suggestions === 'error' && <p className="p-3 text-center text-[11px]" style={{ color: '#C4482E' }}>تعذر البحث، تحقق من الإنترنت</p>}
                    {Array.isArray(suggestions) && suggestions.map((s) => (
                      <button key={s.id} onClick={() => { setCustomer({ id: s.id, name: s.full_name }); showToast('مرحبًا ' + s.full_name + ' — اختر منتجاتك واضغط «اطلب الآن»', 'ok'); }}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-right text-[13.5px] font-bold transition hover:bg-[#E9F0E7] active:scale-[.98]"
                        style={{ color: '#3E382E' }}>
                        <span>{s.full_name}</span>
                        <small style={{ color: '#A3967D' }}>{s.mask}</small>
                      </button>
                    ))}
                  </div>
                )}

                {/* صندوق الطلب */}
                <div className="mt-auto flex flex-col gap-2 rounded-2xl p-2.5" style={{ background: '#FAF1DC', border: '1px solid #E7D8B9' }}>
                  <div className="no-scrollbar flex min-h-7 items-center gap-1.5 overflow-x-auto">
                    {cart.size === 0 ? (
                      <span className="text-[11.5px]" style={{ color: '#A3967D' }}>اضغط على أي منتج لإضافته إلى طلبك</span>
                    ) : [...cart.entries()].map(([pid, qty]) => {
                      const p = catalog?.products.find((x) => x.id === pid);
                      if (!p) return null;
                      return (
                        <span key={pid} className="flex flex-none items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[11.5px] font-bold"
                          style={{ border: '1px solid #E7D8B9', color: '#3E382E' }}>
                          {p.name_ar}
                          <b className="grid min-w-[17px] place-items-center rounded-full px-1 text-[10px] text-white" style={{ background: '#ABC4AA' }}>{qty}</b>
                          <button onClick={() => decProduct(p)} className="grid size-4 place-items-center rounded-full text-[11px]" style={{ background: '#EFE3C8', color: '#6E6553' }}>×</button>
                        </span>
                      );
                    })}
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: '#6E6553' }}>
                    {itemsCount === 0 ? '' : itemsCount === 1 ? 'صنف واحد في طلبك' : itemsCount === 2 ? 'صنفان في طلبك' : `${itemsCount} أصناف في طلبك`}
                  </div>
                  <button onClick={orderNow} disabled={!cart.size || !customer}
                    className="w-full rounded-xl py-3 text-[15px] font-extrabold text-white shadow transition active:scale-[.98] disabled:opacity-40"
                    style={{ background: 'linear-gradient(145deg,#7A6F60,#675D50)' }}>
                    اطلب الآن
                  </button>
                </div>

                <p className="mt-2.5 flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-relaxed"
                  style={{ background: '#F8ECD2', border: '1px solid #E7D8B9', color: '#8A7458' }}>
                  💡 لست مسجل؟ اضغط «لا أملك حساب» في الشريط العلوي وأنشئ حسابك في ثوانٍ
                </p>
              </div>
            ) : (
              <SignupForm onDone={(name) => { setView('lookup'); setQuery(name); showToast('تم إنشاء حسابك — اكتب اسمك واختره', 'ok'); }} onCancel={() => setView('lookup')} />
            )}
          </div>
        </aside>
      </main>

      {/* ===== الشريط السفلي ===== */}
      <footer className="flex h-11 items-center justify-between px-5" style={{ background: 'linear-gradient(180deg,#7A6F60,#675D50)' }}>
        <div className="flex items-center gap-2">
          <img src="/logo.jpg" alt="" className="size-6 rounded-lg object-cover" style={{ border: '1.5px solid rgba(243,222,186,.7)' }} />
          <span className="font-serif text-[13px] font-bold" style={{ color: '#FBF2DD' }}>Dose <i className="not-italic font-sans text-[8.5px] font-bold tracking-[.2em] uppercase" style={{ color: '#D8C6A4' }}>Coffee & More</i></span>
        </div>
        <div className="flex items-center gap-1">
          <a href={`tel:${catalog?.settings?.store_phone ?? '0952639157'}`} className="rounded-full px-3 py-1.5 text-[11px] font-bold transition hover:brightness-125" style={{ color: '#E5D9C6' }} dir="ltr">
            📞 {catalog?.settings?.store_phone ?? '0952639157'}
          </a>
          <a href="https://instagram.com/dose.coffee" target="_blank" rel="noopener" className="rounded-full px-3 py-1.5 text-[11px] font-bold transition hover:brightness-125" style={{ color: '#E5D9C6' }} dir="ltr">@dose.coffee</a>
        </div>
      </footer>

      {/* ===== النوافذ ===== */}
      {step === 'fulfillment' && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-6 backdrop-blur-sm anim-fade" onClick={() => setStep('idle')}>
          <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-center text-xl font-extrabold" style={{ color: '#3E382E' }}>كيف تستلم طلبك؟</h3>
            <p className="mt-1 text-center text-xs" style={{ color: '#A3967D' }}>اختر طريقة الاستلام قبل إرسال الطلب</p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <button onClick={() => { setLoc(null); setStep('pin'); }}
                className="rounded-3xl border-2 p-6 transition hover:brightness-95 active:scale-95" style={{ borderColor: '#ABC4AA', background: '#E9F0E7' }}>
                <span className="block text-5xl">🏪</span>
                <span className="mt-3 block text-lg font-extrabold" style={{ color: '#3E382E' }}>استلام من المحل</span>
                <span className="mt-1 block text-xs" style={{ color: '#8A9B87' }}>جهّز طلبك وتفضل بالاستلام</span>
              </button>
              <button onClick={() => setStep('location')}
                className="rounded-3xl border-2 p-6 transition hover:brightness-95 active:scale-95" style={{ borderColor: '#D9A76C', background: '#FAF1DC' }}>
                <span className="block text-5xl">🚚</span>
                <span className="mt-3 block text-lg font-extrabold" style={{ color: '#3E382E' }}>توصيل</span>
                <span className="mt-1 block text-xs" style={{ color: '#A3967D' }}>سنطلب موقعك للتوصيل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'location' && <KioskLocationStep
        onDone={(l) => { setLoc(l); setStep('pin'); }}
        onBack={() => setStep('fulfillment')}
        onCancel={() => setStep('idle')} />}

      {step === 'pin' && (
        <PinPad
          title="تأكيد هويتك"
          subtitle={`أدخل رمز PIN الخاص بك يا ${customer?.name ?? ''} لتأكيد الطلب${loc ? ' — توصيل 🚚' : ' — استلام 🏪'}`}
          loading={pinBusy} error={pinErr} onFill={submitPin}
          onClose={() => { setStep('idle'); setPinErr(''); }} />
      )}

      {step === 'success' && done && (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-black/50 p-6 backdrop-blur-sm anim-fade">
          <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl anim-pop">
            <span className="mx-auto grid size-16 place-items-center rounded-full text-white shadow-lg" style={{ background: '#ABC4AA' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 13l4.2 4.2L19 7.5"/></svg>
            </span>
            <h3 className="mt-3 text-lg font-extrabold" style={{ color: '#3E382E' }}>تم إرسال طلبك بنجاح</h3>
            <p className="mt-1 text-sm font-bold" style={{ color: '#6E6553' }}>طلب رقم #{done.orderNumber}</p>
            <p className="mt-2 inline-block rounded-full px-4 py-1.5 text-[15px] font-extrabold" style={{ background: '#E9F0E7', color: '#55684F', border: '1.5px solid #ABC4AA' }}>
              ⭐ +{done.points} نقطة عند إكمال الطلب
            </p>
            <button onClick={() => whatsapp.send(waNumber, done.message)}
              className="mt-4 w-full rounded-2xl bg-[#25D366] py-3.5 text-base font-extrabold text-white shadow-lg active:scale-[.98]">
              {done.waSent ? 'إعادة إرسال عبر WhatsApp' : 'إرسال عبر WhatsApp'}
            </button>
            <button onClick={reset} className="mt-3 w-full rounded-2xl py-2.5 text-sm font-bold" style={{ color: '#A3967D' }}>طلب جديد</button>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-16 left-1/2 z-[300] mx-auto w-fit max-w-[90vw] -translate-x-1/2 rounded-2xl px-5 py-3 text-center text-[13px] font-bold shadow-2xl anim-pop ${
          toast.kind === 'err' ? 'bg-red-600 text-white' : 'bg-white'}`}
          style={toast.kind !== 'err' ? { color: '#3E382E', border: '1px solid #D9C49C' } : {}}>{toast.msg}</div>
      )}
    </div>
  );
}

/* شاشة الموقع للتوصيل */
function KioskLocationStep({ onDone, onBack, onCancel }: {
  onDone: (l: { lat: number; lng: number; mapUrl: string }) => void; onBack: () => void; onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const share = async () => {
    setBusy(true); setErr('');
    try { onDone(await getCurrentLocation()); } catch (e: any) { setErr(e.message); setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-6 backdrop-blur-sm anim-fade" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto grid size-16 place-items-center rounded-full text-3xl" style={{ background: '#FAF1DC' }}>📍</span>
        <h3 className="mt-3 text-lg font-extrabold" style={{ color: '#3E382E' }}>مشاركة موقعك</h3>
        <p className="mt-2 text-xs leading-relaxed" style={{ color: '#A3967D' }}>نحتاج إلى موقعك لتوصيل الطلب إلى المكان الصحيح.</p>
        {err && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{err}</p>}
        <button disabled={busy} onClick={share}
          className="mt-5 w-full rounded-2xl py-3.5 text-base font-extrabold text-white shadow-lg transition active:scale-[.98] disabled:opacity-50"
          style={{ background: 'linear-gradient(145deg,#7A6F60,#675D50)' }}>
          {busy ? 'جارٍ تحديد موقعك…' : 'مشاركة موقعي'}
        </button>
        <button onClick={onBack} className="mt-2 w-full rounded-2xl py-2.5 text-sm font-bold" style={{ color: '#A3967D' }}>رجوع</button>
      </div>
    </div>
  );
}

/* إنشاء حساب من الكشك */
function SignupForm({ onDone, onCancel }: { onDone: (name: string) => void; onCancel: () => void }) {
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
      onDone(name.trim());
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };
  const inputCls = 'h-11 w-full rounded-xl border-[1.5px] bg-white px-3 text-sm font-bold outline-none focus:shadow-sm';
  const inputStyle = { borderColor: '#D9C49C', color: '#3E382E' };
  return (
    <div className="flex flex-1 flex-col">
      <h2 className="text-center text-[17.5px] font-extrabold" style={{ color: '#3E382E' }}>مرحبًا بك في <span className="font-serif" style={{ color: '#675D50' }}>Dose</span></h2>
      <p className="mb-4 mt-1 text-center text-[11.5px]" style={{ color: '#6E6553' }}>أنشئ حسابك الآن واستمتع بالنقاط والمكافآت</p>

      <label className="mb-1 block text-[11px] font-bold" style={{ color: '#6E6553' }}>الاسم الكامل</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: سارة أحمد" className={`mb-3 ${inputCls}`} style={inputStyle} />

      <label className="mb-1 block text-[11px] font-bold" style={{ color: '#6E6553' }}>رقم الهاتف</label>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" dir="ltr" placeholder="09XXXXXXXX"
        className={`mb-3 text-center ${inputCls}`} style={inputStyle} />

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="mb-1 block text-[11px] font-bold" style={{ color: '#6E6553' }}>رمز PIN</label>
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} type="password" inputMode="numeric" dir="ltr" placeholder="••••"
            className={`text-center text-base font-black tracking-widest ${inputCls}`} style={inputStyle} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold" style={{ color: '#6E6553' }}>تأكيد PIN</label>
          <input value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 4))} type="password" inputMode="numeric" dir="ltr" placeholder="••••"
            className={`text-center text-base font-black tracking-widest ${inputCls}`} style={inputStyle} />
        </div>
      </div>
      {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-center text-[11.5px] font-bold text-red-600">{err}</p>}

      <p className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-relaxed"
        style={{ background: '#F8ECD2', border: '1px solid #E7D8B9', color: '#8A7458' }}>
        🔒 سيتم ربط حسابك بجهازك لإرسال إشعارات الطلب والنقاط
      </p>

      <button onClick={submit} disabled={busy}
        className="mt-4 w-full rounded-xl py-3 text-[14.5px] font-extrabold text-white shadow transition active:scale-[.98] disabled:opacity-50"
        style={{ background: 'linear-gradient(145deg,#7A6F60,#675D50)' }}>
        {busy ? 'جارٍ الإنشاء…' : 'إنشاء الحساب والمتابعة'}
      </button>
      <button onClick={onCancel} className="mt-1 w-full py-2.5 text-[12.5px] font-bold" style={{ color: '#A3967D' }}>إلغاء والعودة</button>
    </div>
  );
}
