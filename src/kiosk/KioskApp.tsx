import { useEffect, useRef, useState } from 'react';
import { rpc } from '../lib/supabase';
import type { Catalog, Product } from '../lib/types';
import { deviceId } from '../lib/utils';
import PinPad from '../components/PinPad';
import { Icon } from '../components/Icons';

/* ============================================================
   منصة المحل الداخلية — Tablet Kiosk
   نفس هوية التطبيق: كريمي · كراميل · بني داكن
   التدفق: اسم ← منتجات ← PIN ← Supabase (النقاط تُحتسب في حسابه)
   ============================================================ */

interface Suggestion { id: string; full_name: string; mask: string }
type Step = 'idle' | 'pin' | 'success';

export default function KioskApp() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [cat, setCat] = useState('hot');
  const [cart, setCart] = useState<Map<number, number>>(new Map());
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[] | 'idle' | 'loading' | 'empty' | 'error'>('idle');
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [view, setView] = useState<'lookup' | 'signup'>('lookup');
  const [step, setStep] = useState<Step>('idle');
  const [pinErr, setPinErr] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [done, setDone] = useState<{ orderNumber: number; points: number } | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind?: 'ok' | 'err' } | null>(null);
  const searchTimer = useRef<number | undefined>(undefined);

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
    if (!customer) return showToast('اختر اسمك أولًا من البطاقة');
    setStep('pin');
  };

  const reset = () => {
    setCart(new Map()); setCustomer(null); setQuery(''); setSuggestions('idle');
    setStep('idle'); setDone(null); setView('lookup');
  };

  const submitPin = async (pin: string) => {
    if (!customer) return;
    setPinBusy(true); setPinErr('');
    try {
      const items = [...cart.entries()].map(([product_id, qty]) => ({ product_id, qty }));
      const res = await rpc<any>('create_order', {
        p_customer_id: customer.id, p_pin: pin,
        p_fulfillment_type: 'pickup',
        p_items: items,
        p_source: 'kiosk',
      });
      setDone({ orderNumber: res.order_number, points: res.total_points });
      setStep('success');
    } catch (e: any) {
      setPinErr(e.message);
    } finally { setPinBusy(false); }
  };

  const catIcon = (slug: string) => slug === 'hot' ? 'coffee' : slug === 'cold' ? 'snow' : 'cake';

  return (
    <div className="flex h-full flex-col" style={{ background: 'linear-gradient(180deg,#F9EDD2,#F3DFB6)' }}>
      {/* ===== الشريط العلوي ===== */}
      <header className="flex h-16 flex-row-reverse items-center justify-between border-b border-[#EAD3A0]/80 bg-[#F6E7C9]/85 px-5 backdrop-blur-xl">
        <div className="flex flex-row-reverse items-center gap-3">
          <img src="/logo.jpg" alt="Dose" className="size-11 rounded-2xl object-cover shadow-md shadow-[#8a6a48]/25 ring-2 ring-white" />
          <div className="text-right leading-none">
            <p className="text-[19px] font-black tracking-tight" style={{ color: '#221B12' }}>Dose</p>
            <span className="mt-1 inline-block rounded-full bg-white px-2 py-0.5 text-[8px] font-black tracking-[.16em] shadow-sm" style={{ color: '#8A6A48' }}>CAFE</span>
          </div>
        </div>
        <button onClick={() => setView('signup')}
          className="flex items-center gap-2 rounded-full bg-[#EAC98F] px-5 py-2.5 text-[13px] font-black shadow-md shadow-[#8a6a48]/30 transition hover:brightness-105 active:scale-95"
          style={{ color: '#221B12' }}>
          <Icon name="user" size={16} />
          لا أملك حساب
        </button>
      </header>

      {/* ===== الجسم ===== */}
      <main className="grid min-h-0 flex-1 gap-3 p-3" style={{ gridTemplateColumns: 'minmax(0,1fr) clamp(300px,25vw,352px)' }}>
        {/* المنتجات — يمين */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-[22px] bg-[#FBF3E2] shadow-lg shadow-[#8a6a48]/15" style={{ border: '1px solid #EAD3A0' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5" style={{ borderColor: '#EAD3A0' }}>
            <div>
              <h1 className="text-[15.5px] font-extrabold" style={{ color: '#221B12' }}>قائمة <span className="font-serif" style={{ color: '#8A6A48' }}>Dose</span></h1>
              <p className="mt-0.5 text-[11px]" style={{ color: '#94826A' }}>اضغط على المنتج لإضافته إلى طلبك</p>
            </div>
            <div className="flex gap-1 rounded-full p-1" style={{ background: '#F8EED6', border: '1px solid #EAD3A0' }}>
              {catalog?.categories?.filter((c) => c.slug !== 'extras').map((c) => (
                <button key={c.id} onClick={() => setCat(c.slug)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition ${cat === c.slug ? 'shadow-md' : ''}`}
                  style={cat === c.slug ? { background: '#221B12', color: '#F3DEBA' } : { color: '#6E6553' }}>
                  <Icon name={catIcon(c.slug) as any} size={14} />
                  {c.name_ar}
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
                    className="anim-rise flex flex-col overflow-hidden rounded-[1.4rem] text-right transition active:scale-[.97]"
                    style={{
                      background: '#F1DCB0',
                      border: `2px solid ${qty ? '#8A6A48' : 'transparent'}`,
                      boxShadow: qty ? '0 10px 22px -12px rgba(138,106,72,.55)' : undefined,
                      animationDelay: `${i * 35}ms`,
                    }}>
                    <div className="relative min-h-0 flex-1 overflow-hidden" style={{ background: '#EFDDBB' }}>
                      <img src={p.image_url} alt={p.name_ar} className="size-full object-cover" loading="lazy" />
                      {qty > 0 && (
                        <span className="absolute top-1.5 right-1.5 grid min-w-6 place-items-center rounded-full border-2 border-white px-1.5 py-0.5 text-[11.5px] font-extrabold text-white"
                          style={{ background: '#221B12' }}>×{qty}</span>
                      )}
                    </div>
                    <div className="px-2.5 pb-2 pt-1.5">
                      <h3 className="truncate text-[13px] font-extrabold" style={{ color: '#221B12' }}>{p.name_ar}</h3>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-extrabold" style={{ color: '#8A6A48' }}>
                        <Icon name="star" size={11} filled /> {p.points} نقاط
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ادخل اسمك + الطلب — يسار */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-[22px] bg-[#FBF3E2] shadow-lg shadow-[#8a6a48]/15" style={{ border: '1px solid #EAD3A0' }}>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
            {view === 'lookup' ? (
              <div className="flex flex-1 flex-col">
                <img src="/logo.jpg" alt="" className="mx-auto size-12 rounded-2xl object-cover shadow-md shadow-[#8a6a48]/25 ring-2 ring-white" />
                <h2 className="mt-2.5 text-center text-[17.5px] font-extrabold" style={{ color: '#221B12' }}>ادخل اسمك</h2>
                <p className="mb-3 mt-1 text-center text-[11.5px]" style={{ color: '#6E6553' }}>اكتب اسمك واختره من القائمة، ثم أكّد طلبك برمز PIN</p>

                <div className="relative mb-2.5">
                  <Icon name="search" size={15} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: '#94826A' }} />
                  <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="اكتب اسمك هنا…"
                    className="h-11 w-full rounded-xl border-[1.5px] bg-white pr-10 pl-3 text-sm font-bold outline-none transition focus:shadow-sm"
                    style={{ borderColor: '#E0C288', color: '#221B12' }} />
                </div>

                {customer ? (
                  <div className="mb-2.5 flex items-center gap-2.5 rounded-xl p-2.5 anim-pop" style={{ background: '#F1DCB0', border: '1.5px solid #D9B171' }}>
                    <span className="grid size-7 place-items-center rounded-full text-white" style={{ background: '#221B12' }}>
                      <Icon name="check" size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-sm font-extrabold" style={{ color: '#221B12' }}>{customer.name}</b>
                      <small className="text-[10.5px]" style={{ color: '#6E6553' }}>تم اختيار اسمك</small>
                    </div>
                    <button onClick={() => { setCustomer(null); setQuery(''); setSuggestions('idle'); }}
                      className="rounded-lg border bg-white px-2.5 py-1.5 text-[11.5px] font-bold transition hover:brightness-95"
                      style={{ borderColor: '#E0C288', color: '#6E6553' }}>تغيير</button>
                  </div>
                ) : (
                  <div className="mb-2.5 flex max-h-44 min-h-[70px] flex-col gap-1.5 overflow-y-auto rounded-xl p-1.5"
                    style={{ background: '#F8EED6', border: '1px solid #EAD3A0' }}>
                    {suggestions === 'idle' && <p className="p-3 text-center text-[11px] leading-relaxed" style={{ color: '#94826A' }}>ابدأ بكتابة أول حروف اسمك…</p>}
                    {suggestions === 'loading' && <p className="p-3 text-center text-[11px]" style={{ color: '#94826A' }}>جارٍ البحث…</p>}
                    {suggestions === 'empty' && <p className="p-3 text-center text-[11px] leading-relaxed" style={{ color: '#94826A' }}>لا يوجد اسم مطابق — إن لم تكن مسجلًا اضغط «لا أملك حساب» بالأعلى</p>}
                    {suggestions === 'error' && <p className="p-3 text-center text-[11px]" style={{ color: '#C4482E' }}>تعذر البحث، تحقق من الإنترنت</p>}
                    {Array.isArray(suggestions) && suggestions.map((s) => (
                      <button key={s.id} onClick={() => { setCustomer({ id: s.id, name: s.full_name }); showToast('مرحبًا ' + s.full_name + ' — اختر منتجاتك واضغط «اطلب الآن»', 'ok'); }}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-right text-[13.5px] font-bold transition hover:bg-[#F1DCB0] active:scale-[.98]"
                        style={{ color: '#221B12' }}>
                        <span>{s.full_name}</span>
                        <small style={{ color: '#94826A' }}>{s.mask}</small>
                      </button>
                    ))}
                  </div>
                )}

                {/* صندوق الطلب */}
                <div className="mt-auto flex flex-col gap-2 rounded-2xl p-2.5" style={{ background: '#F1DCB0' }}>
                  <div className="no-scrollbar flex min-h-7 items-center gap-1.5 overflow-x-auto">
                    {cart.size === 0 ? (
                      <span className="text-[11.5px]" style={{ color: '#94826A' }}>اضغط على أي منتج لإضافته إلى طلبك</span>
                    ) : [...cart.entries()].map(([pid, qty]) => {
                      const p = catalog?.products.find((x) => x.id === pid);
                      if (!p) return null;
                      return (
                        <span key={pid} className="flex flex-none items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[11.5px] font-bold"
                          style={{ color: '#221B12' }}>
                          {p.name_ar}
                          <b className="grid min-w-[17px] place-items-center rounded-full px-1 text-[10px] text-white" style={{ background: '#221B12' }}>{qty}</b>
                          <button onClick={() => decProduct(p)} className="grid size-4 place-items-center rounded-full text-[11px]" style={{ background: '#E0C288', color: '#6E6553' }}>×</button>
                        </span>
                      );
                    })}
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: '#6E6553' }}>
                    {itemsCount === 0 ? '' : itemsCount === 1 ? 'صنف واحد في طلبك' : itemsCount === 2 ? 'صنفان في طلبك' : `${itemsCount} أصناف في طلبك`}
                  </div>
                  <button onClick={orderNow} disabled={!cart.size || !customer}
                    className="w-full rounded-xl py-3 text-[15px] font-black shadow-md shadow-[#8a6a48]/30 transition active:scale-[.98] disabled:opacity-40"
                    style={{ background: '#EAC98F', color: '#221B12' }}>
                    اطلب الآن
                  </button>
                </div>

                <p className="mt-2.5 flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-relaxed"
                  style={{ background: '#F8EED6', color: '#8A7458' }}>
                  <Icon name="info" size={13} className="mt-0.5 flex-none" style={{ color: '#A9907E' }} />
                  لست مسجل؟ اضغط «لا أملك حساب» في الشريط العلوي وأنشئ حسابك في ثوانٍ
                </p>
              </div>
            ) : (
              <SignupForm onDone={(name) => { setView('lookup'); setQuery(name); showToast('تم إنشاء حسابك — اكتب اسمك واختره', 'ok'); }} onCancel={() => setView('lookup')} />
            )}
          </div>
        </aside>
      </main>

      {/* ===== الشريط السفلي ===== */}
      <footer className="flex h-11 items-center justify-between border-t px-5" style={{ background: '#F6E7C9', borderColor: '#EAD3A0' }}>
        <div className="flex items-center gap-2">
          <img src="/logo.jpg" alt="" className="size-6 rounded-lg object-cover shadow-sm" style={{ border: '1.5px solid white' }} />
          <span className="font-serif text-[13px] font-black" style={{ color: '#221B12' }}>Dose <i className="not-italic font-sans text-[8.5px] font-bold tracking-[.2em] uppercase" style={{ color: '#94826A' }}>Cafe</i></span>
        </div>
        <div className="flex items-center gap-1">
          <a href={`tel:${catalog?.settings?.store_phone ?? '0936107119'}`} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition hover:brightness-90" style={{ color: '#6E6553' }} dir="ltr">
            <Icon name="phone" size={12} /> {catalog?.settings?.store_phone ?? '0936107119'}
          </a>
          <a href="https://www.instagram.com/dose__cafe" target="_blank" rel="noopener" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition hover:brightness-90" style={{ color: '#6E6553' }} dir="ltr">
            <Icon name="instagram" size={12} /> @dose__cafe
          </a>
        </div>
      </footer>

      {/* ===== نافذة PIN ===== */}
      {step === 'pin' && (
        <PinPad
          title="تأكيد هويتك"
          subtitle={`أدخل رمز PIN الخاص بك يا ${customer?.name ?? ''} لتأكيد الطلب`}
          loading={pinBusy} error={pinErr} onFill={submitPin}
          onClose={() => { setStep('idle'); setPinErr(''); }} />
      )}

      {/* ===== نجاح الطلب ===== */}
      {step === 'success' && done && (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-black/50 p-6 backdrop-blur-sm anim-fade">
          <div className="w-full max-w-sm rounded-[2rem] bg-white p-7 text-center shadow-2xl anim-pop">
            <span className="mx-auto grid size-16 place-items-center rounded-full text-white shadow-lg" style={{ background: '#EAC98F', color: '#221B12' }}>
              <Icon name="check" size={30} strokeWidth={2.4} />
            </span>
            <h3 className="mt-3 text-lg font-black" style={{ color: '#221B12' }}>تم تسجيل طلبك بنجاح</h3>
            <p className="mt-1 text-sm font-bold" style={{ color: '#6E6553' }}>طلب رقم #{done.orderNumber}</p>
            <p className="mt-2 inline-block rounded-full px-4 py-1.5 text-[15px] font-black" style={{ background: '#F1DCB0', color: '#8A6A48' }}>
              ⭐ +{done.points} نقطة عند إكمال الطلب
            </p>
            <p className="mt-2 text-[11px] font-bold" style={{ color: '#94826A' }}>
              ستظهر النقاط في حساب {customer?.name} داخل تطبيق Dose
            </p>
            <button onClick={reset} className="mt-5 w-full rounded-full py-3.5 text-base font-black text-white shadow-lg active:scale-[.98]" style={{ background: '#EAC98F', color: '#221B12' }}>
              طلب جديد
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-16 left-1/2 z-[300] mx-auto w-fit max-w-[90vw] -translate-x-1/2 rounded-full px-5 py-3 text-center text-[13px] font-bold shadow-2xl anim-pop ${
          toast.kind === 'err' ? 'bg-[#C4482E] text-white' : 'bg-white'}`}
          style={toast.kind !== 'err' ? { color: '#221B12', border: '1px solid #E0C288' } : {}}>{toast.msg}</div>
      )}
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
  const inputStyle = { borderColor: '#E0C288', color: '#221B12' };
  return (
    <div className="flex flex-1 flex-col">
      <h2 className="text-center text-[17.5px] font-extrabold" style={{ color: '#221B12' }}>مرحبًا بك في <span className="font-serif" style={{ color: '#8A6A48' }}>Dose</span></h2>
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
        style={{ background: '#F8EED6', color: '#8A7458' }}>
        <Icon name="lock" size={13} className="mt-0.5 flex-none" style={{ color: '#A9907E' }} />
        سيتم ربط حسابك بجهازك لإرسال إشعارات الطلب والنقاط
      </p>

      <button onClick={submit} disabled={busy}
        className="mt-4 w-full rounded-xl py-3 text-[14.5px] font-black shadow-md shadow-[#8a6a48]/30 transition active:scale-[.98] disabled:opacity-50"
        style={{ background: '#EAC98F', color: '#221B12' }}>
        {busy ? 'جارٍ الإنشاء…' : 'إنشاء الحساب والمتابعة'}
      </button>
      <button onClick={onCancel} className="mt-1 w-full py-2.5 text-[12.5px] font-bold" style={{ color: '#94826A' }}>إلغاء والعودة</button>
    </div>
  );
}
