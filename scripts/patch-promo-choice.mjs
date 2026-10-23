// بطاقة اختيار كود الخصم في تطبيق العميل + الخصم على المبلغ
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* 1) الحالة: خطوة promo + الاستخدام */
const oldFlow = "interface OrderFlow { step: 'fulfillment' | 'location' | 'pin' | 'review' | null; lines: CartLine[]; fulfillment?: Fulfillment; loc?: { lat: number; lng: number; mapUrl: string }; pin?: string }";
if (!s.includes(oldFlow)) fail('OrderFlow');
s = s.replace(oldFlow, "interface OrderFlow { step: 'fulfillment' | 'location' | 'pin' | 'promo' | 'review' | null; lines: CartLine[]; fulfillment?: Fulfillment; loc?: { lat: number; lng: number; mapUrl: string }; pin?: string; usePromo?: boolean }");

/* 2) بعد التحقق من PIN: بطاقة الكود إن وُجد، وإلا مباشرة للمراجعة */
const oldVerify = "      await rpc('verify_customer_pin', { p_customer_id: session.customer.id, p_pin: pin });\n      setFlow((st) => ({ ...st, step: 'review', pin }));";
if (!s.includes(oldVerify)) fail('verify block');
s = s.replace(oldVerify, `      await rpc('verify_customer_pin', { p_customer_id: session.customer.id, p_pin: pin });
      if (promoCode && promoDisc) setFlow((st) => ({ ...st, step: 'promo', pin }));
      else setFlow((st) => ({ ...st, step: 'review', pin }));`);

/* 3) تأكيد واتساب يمرر الكود عند الاستخدام */
const oldParams = "        p_latitude: flow.loc?.lat ?? null, p_longitude: flow.loc?.lng ?? null, p_map_url: flow.loc?.mapUrl ?? null,\n        p_source: 'customer',\n      });";
if (!s.includes(oldParams)) fail('confirm params');
s = s.replace(oldParams, "        p_latitude: flow.loc?.lat ?? null, p_longitude: flow.loc?.lng ?? null, p_map_url: flow.loc?.mapUrl ?? null,\n        p_source: 'customer',\n        p_reward_code: flow.usePromo && promoCode ? promoCode : null,\n      });");

/* 4) مكون بطاقة اختيار كود الخصم */
const anchorReview = '/* ============================ نافذة تأكيد الطلب (واتساب / إلغاء) ============================ */';
if (!s.includes(anchorReview)) fail('confirm modal anchor');
const promoModal = `/* ============================ بطاقة كود الخصم (استخدام / عدم الاستخدام) ============================ */
function PromoChoiceModal({ code, disc, busy, onUse, onSkip }: {
  code: string; disc: string; busy: boolean; onUse: () => void; onSkip: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[125] grid place-items-center bg-black/50 p-4 backdrop-blur-sm anim-fade">
      <div className="w-full max-w-sm rounded-[2rem] bg-white p-6 text-center shadow-2xl anim-pop">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#E3E9C8] text-[#5C6B3C]"><Icon name="gift" size={28} /></span>
        <h3 className="mt-3 text-lg font-black text-[#26301C]">لديك كود خصم 🎉</h3>
        <p className="mt-3 rounded-2xl bg-[#F1DCB0] px-4 py-2.5 font-mono text-2xl font-black tracking-[.3em] text-[#26301C]" dir="ltr">{code}</p>
        <p className="mt-2 text-sm font-extrabold text-[#7C8F52]">استخدمه الآن واحصل على خصم {disc}% على طلبك</p>
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

`;
s = s.replace(anchorReview, promoModal + anchorReview);

/* 5) المبلغ في بطاقة المراجعة مع الخصم */
const oldModalCall = `          total={flow.lines.reduce((a, l) => a + l.product.price_cents * l.qty, 0)}`;
if (!s.includes(oldModalCall)) fail('modal total');
s = s.replace(oldModalCall, `          total={flow.usePromo && promoCode && promoDisc
            ? Math.round(flow.lines.reduce((a, l) => a + l.product.price_cents * l.qty, 0) * (100 - Number(promoDisc)) / 100)
            : flow.lines.reduce((a, l) => a + l.product.price_cents * l.qty, 0)}`);

/* 6) عرض بطاقة الكود بعد الـPIN */
const oldPinRender = `      {flow.step === 'pin' && (`;
if (!s.includes(oldPinRender)) fail('pin render');
const newRender = `      {flow.step === 'promo' && (
        <PromoChoiceModal code={promoCode} disc={promoDisc} busy={pinBusyConfirm}
          onUse={() => { setFlow((st) => ({ ...st, step: 'review', usePromo: true })); }}
          onSkip={() => { setFlow((st) => ({ ...st, step: 'review', usePromo: false })); }} />
      )}
      {flow.step === 'pin' && (`;
s = s.replace(oldPinRender, newRender);

writeFileSync(f, s);
console.log('promo choice card added to customer flow');
