// تدفق الطلب المحدث في تطبيق العميل: مراجعة قبل الإنشاء + تأكيد واتساب / إلغاء الطلب
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* 1) إضافة مرحلة المراجعة للنموذج */
const oldFlow = "interface OrderFlow { step: 'fulfillment' | 'location' | 'pin' | null; lines: CartLine[]; fulfillment?: Fulfillment; loc?: { lat: number; lng: number; mapUrl: string } }";
if (!s.includes(oldFlow)) fail('OrderFlow');
s = s.replace(oldFlow, "interface OrderFlow { step: 'fulfillment' | 'location' | 'pin' | 'review' | null; lines: CartLine[]; fulfillment?: Fulfillment; loc?: { lat: number; lng: number; mapUrl: string }; pin?: string }");

/* 2) submitPin: تحقق فقط ثم المراجعة */
const i1 = s.indexOf('const submitPin = async (pin: string) => {');
const i1end = s.indexOf('/* ۱', i1); // غير مستخدم
const i2 = s.indexOf('\n\n  const redeem', i1);
if (i1 < 0 || i2 < 0) fail('submitPin bounds');
const newSubmitPin = `const submitPin = async (pin: string) => {
    if (!session) return;
    setPinBusy(true); setPinErr('');
    try {
      // تحقق من الرمز فقط — لا يُنشأ الطلب قبل التأكيد
      await rpc('verify_customer_pin', { p_customer_id: session.customer.id, p_pin: pin });
      setFlow((st) => ({ ...st, step: 'review', pin }));
    } catch (e: any) {
      setPinErr(e.message);
    } finally { setPinBusy(false); }
  };

  const confirmWhatsApp = async () => {
    if (!session || !flow.pin) return;
    setPinBusy(true);
    try {
      const res = await rpc<any>('create_order', {
        p_customer_id: session.customer.id, p_pin: flow.pin,
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
  };`;
s = s.slice(0, i1) + newSubmitPin + s.slice(i2);

/* 3) استبدال حالة success بـ doneOrder */
const oldState = "const [success, setSuccess] = useState<{ orderNumber: number; points: number; message: string } | null>(null);";
if (!s.includes(oldState)) fail('success state');
s = s.replace(oldState, "const [doneOrder, setDoneOrder] = useState<{ orderNumber: number; points: number; free: boolean } | null>(null);\n  const [pinBusyConfirm, setPinBusyConfirm] = useState(false);");

/* 4) استبدال نافذة النجاح بنافذة المراجعة/التأكيد */
const i3 = s.indexOf('function OrderSuccessModal');
const i3end = s.indexOf('/* ============================ عن المحل', i3);
if (i3 < 0 || i3end < 0) fail('modal bounds');
const newModal = `/* ============================ نافذة تأكيد الطلب (واتساب / إلغاء) ============================ */
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
            <h3 className="text-center text-lg font-black text-[#26301C]">مراجعة طلبك</h3>
            <p className="mt-1 text-center text-xs text-neutral-500">راجع طلبك ثم أكّد الإرسال عبر WhatsApp</p>
            <div className="mt-4 max-h-52 space-y-1.5 overflow-y-auto rounded-[1.4rem] bg-[#EEF2DC] p-4">
              {lines.map((l, i) => (
                <p key={i} className="text-xs text-[#4A3A28]">
                  • {l.product.name_ar} × {l.qty} — {eur(l.product.price_cents * l.qty, cur)}
                  {(l.options || []).length > 0 && <span className="text-[#7C8665]"> ({l.options.join('، ')})</span>}
                </p>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#E3E9C8] px-4 py-3">
              <span className="text-sm font-black text-[#26301C]">الإجمالي</span>
              <span className="text-lg font-black text-[#26301C]">{free ? 'مجاني 🎁' : eur(total, cur)}</span>
            </div>
            <p className="mt-2 text-center text-[11px] font-bold text-[#7C8665]">ستكسب ⭐ {points} نقطة عند إكمال الطلب</p>
            <button onClick={onConfirm} disabled={busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3.5 text-base font-black text-white shadow-lg shadow-green-500/30 transition active:scale-[.98] disabled:opacity-50">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.7-4-4.8-4.2-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4.2.5.7 1.8.8 1.9.1.1.1.3 0 .5-.1.2-.1.3-.3.5l-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.5.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1l1.8.9c.3.1.5.2.5.3.1.1.1.7-.1 1.3Z"/></svg>
              {busy ? 'جارٍ التأكيد…' : 'تأكيد واتساب'}
            </button>
            <button onClick={onCancel} disabled={busy}
              className="mt-3 w-full rounded-full bg-red-50 py-3 text-sm font-black text-[#C4482E] transition active:scale-[.98] disabled:opacity-50">
              إلغاء الطلب
            </button>
            <p className="mt-2 text-center text-[10px] font-bold text-neutral-400">الإلغاء لا يُرسل الطلب إلى المحل إطلاقًا</p>
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

`;
s = s.slice(0, i3) + newModal + s.slice(i3end);

/* 5) تحديث الربط في الهيكل */
const oldRender = `{success && <OrderSuccessModal {...success} waNumber={waNumber} onClose={() => setSuccess(null)} />}`;
if (!s.includes(oldRender)) fail('render success');
const newRender = `{flow.step === 'review' && (
        <ConfirmOrderModal
          phase={doneOrder ? 'done' : 'review'}
          lines={flow.lines}
          total={flow.lines.reduce((a, l) => a + l.product.price_cents * l.qty, 0)}
          points={flow.lines.reduce((a, l) => a + l.product.points * l.qty, 0)}
          free={false}
          busy={pinBusyConfirm || pinBusy}
          done={doneOrder}
          onConfirm={confirmWhatsApp}
          onCancel={cancelOrder}
          onClose={() => { setDoneOrder(null); setFlow({ step: null, lines: [] }); }}
        />
      )}`;
s = s.replace(oldRender, newRender);

/* 6) أثناء الانتظار في المراجعة استخدم pinBusyConfirm */
s = s.replace('const [pinBusyConfirm, setPinBusyConfirm] = useState(false);', 'const [pinBusyConfirm, setPinBusyConfirm] = useState(false);');

writeFileSync(f, s);
console.log('customer flow updated: review + confirm whatsapp / cancel');
