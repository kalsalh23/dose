// واجهات الكشك والتطبيق: تعطيل الطلب عند الإغلاق + رسالة «المحل مغلق ليلة سعدة»
import { readFileSync, writeFileSync } from 'node:fs';

/* ===== الكشك ===== */
const kf = 'src/kiosk/KioskApp.tsx';
let k = readFileSync(kf, 'utf8').replace(/\r\n/g, '\n');
const kfail = (m) => { console.error('MISSING:', m); process.exit(1); };

// حالة المحل
const oldWa = `  const waNumber = catalog?.settings?.whatsapp_number ?? '963936107119';`;
if (!k.includes(oldWa)) kfail('kiosk wa');
k = k.replace(oldWa, oldWa + `

  // هل المحل مفتوح الآن؟ (بتوقيت دمشق)
  const shopClosed = (() => {
    const open = catalog?.settings?.work_open, close = catalog?.settings?.work_close;
    if (!open || !close) return false;
    const now = new Date();
    const local = new Date(now.getTime() + (3 * 60 + now.getTimezoneOffset()) * 60000);
    const t = local.getHours() * 60 + local.getMinutes();
    const [oh, om] = open.split(':').map(Number);
    const [ch, cm] = close.split(':').map(Number);
    const om2 = oh * 60 + om, cm2 = ch * 60 + cm;
    return om2 <= cm2 ? (t < om2 || t >= cm2) : (t < om2 && t >= cm2);
  })();`);

// تعطيل زر الطلب + رسالة الإغلاق فوقه
const oldBtn = `                  <button onClick={orderNow} disabled={!cart.size || !customer}
                    className="w-full rounded-xl py-3 text-[15px] font-black shadow-md shadow-[#8a6a48]/30 transition active:scale-[.98] disabled:opacity-40"
                    style={{ background: '#C9D3A8', color: '#26301C' }}>
                    {appliedCode ? 'اطلب الآن — مجاني 🎁' : 'اطلب الآن'}
                  </button>`;
if (!k.includes(oldBtn)) kfail('kiosk order button');
k = k.replace(oldBtn, `                  {shopClosed && (
                    <div className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[12.5px] font-black"
                      style={{ background: '#FBEDE9', color: '#C4482E' }}>
                      🌙 المحل مغلق ليلة سعيدة — نستقبلكم غدًا
                    </div>
                  )}
                  <button onClick={orderNow} disabled={!cart.size || !customer || shopClosed}
                    className="w-full rounded-xl py-3 text-[15px] font-black shadow-md shadow-[#8a6a48]/30 transition active:scale-[.98] disabled:opacity-40"
                    style={{ background: shopClosed ? '#D5DEB4' : '#C9D3A8', color: '#26301C' }}>
                    {shopClosed ? 'الطلب متاح أثناء الدوام' : appliedCode ? 'اطلب الآن — مجاني 🎁' : 'اطلب الآن'}
                  </button>`);

writeFileSync(kf, k);
console.log('kiosk closed state added');

/* ===== تطبيق العميل ===== */
const cf = 'src/customer/CustomerApp.tsx';
let s = readFileSync(cf, 'utf8').replace(/\r\n/g, '\n');
const sfail = (m) => { console.error('MISSING:', m); process.exit(1); };

const oldWa2 = `  const waNumber = catalog?.settings?.whatsapp_number ?? '963936107119';`;
if (!s.includes(oldWa2)) sfail('customer wa');
s = s.replace(oldWa2, oldWa2 + `

  // هل المحل مفتوح الآن؟
  const shopClosed = (() => {
    const open = catalog?.settings?.work_open, close = catalog?.settings?.work_close;
    if (!open || !close) return false;
    const now = new Date();
    const local = new Date(now.getTime() + (3 * 60 + now.getTimezoneOffset()) * 60000);
    const t = local.getHours() * 60 + local.getMinutes();
    const [oh, om] = open.split(':').map(Number);
    const [ch, cm] = close.split(':').map(Number);
    const om2 = oh * 60 + om, cm2 = ch * 60 + cm;
    return om2 <= cm2 ? (t < om2 || t >= cm2) : (t < om2 && t >= cm2);
  })();`);

// بطاقة المراجعة: زر التأكيد يتعطل + رسالة الإغلاق
const oldConfirm = `            <button onClick={onConfirm} disabled={busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3.5 text-base font-black text-white shadow-lg shadow-green-500/30 transition active:scale-[.98] disabled:opacity-50">`;
if (!s.includes(oldConfirm)) sfail('confirm button');
s = s.replace(oldConfirm, `            {shopClosedNow && (
              <div className="mb-3 rounded-2xl bg-[#FBEDE9] px-4 py-3 text-sm font-black text-[#C4482E]">🌙 المحل مغلق ليلة سعيدة — لا يمكن إرسال الطلب الآن</div>
            )}
            <button onClick={onConfirm} disabled={busy || shopClosedNow}
              className={\`mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3.5 text-base font-black text-white shadow-lg shadow-green-500/30 transition active:scale-[.98] disabled:opacity-50\`}>`);

// خاصية shopClosedNow للنافذة
const oldModalSig = `function OrderSuccessModal({ orderNumber, points, waNumber, message, onClose }: {
  orderNumber: number; points: number; waNumber: string; message: string; onClose: () => void;
}) {`;
if (!s.includes(oldModalSig)) sfail('success modal sig');
s = s.replace(oldModalSig, `function ConfirmOrderModalInner({ phase, lines, total, points, free, busy, done, onConfirm, onCancel, onClose, shopClosedNow }: {
  phase: 'review' | 'done'; lines: CartLine[]; total: number; points: number; free: boolean; busy: boolean;
  done: { orderNumber: number; points: number; free: boolean } | null; onConfirm: () => void; onCancel: () => void; onClose: () => void; shopClosedNow: boolean;
}) {`);

// إعادة تسمية الاستدعاء
const oldModalUse = `      {flow.step === 'review' && (
        <ConfirmOrderModal`;
if (!s.includes(oldModalUse)) sfail('modal use');
s = s.replace(oldModalUse, `      {flow.step === 'review' && (
        <ConfirmOrderModalInner`);

// تمرير shopClosedNow
const oldModalClose = `          onClose={() => { setDoneOrder(null); setFlow({ step: null, lines: [] }); }}
        />
      )}`;
if (!s.includes(oldModalClose)) sfail('modal close');
s = s.replace(oldModalClose, `          onClose={() => { setDoneOrder(null); setFlow({ step: null, lines: [] }); }}
          shopClosedNow={shopClosed}
        />
      )}`);

writeFileSync(cf, s);
console.log('customer closed state added');
