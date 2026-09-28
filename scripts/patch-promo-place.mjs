// كود الخصم: قسم مستقل في الرئيسية (خارج الهيرو)
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* 1) إزالة رقاقة الكود من الهيرو */
const oldChip = `          {promoCode && promoDisc ? (
            <div className="rounded-xl border-2 border-dashed border-[#C9D3A8]/70 px-2.5 py-1.5 text-center">
              <p className="text-[8.5px] font-bold text-[#C9D3A8]">كود خصم {promoDisc}%</p>
              <p className='font-mono text-[13px] font-black tracking-widest' dir='ltr'>{promoCode}</p>
            </div>
          ) : <span />} `;
if (!s.includes(oldChip)) {
  // محاولة بصيغة بديلة (بدون مسافة نهائية)
  const alt = `          {promoCode && promoDisc ? (
            <div className="rounded-xl border-2 border-dashed border-[#C9D3A8]/70 px-2.5 py-1.5 text-center">
              <p className="text-[8.5px] font-bold text-[#C9D3A8]">كود خصم {promoDisc}%</p>
              <p className='font-mono text-[13px] font-black tracking-widest' dir='ltr'>{promoCode}</p>
            </div>
          ) : <span />}`;
  if (!s.includes(alt)) { console.error('hero chip not found'); process.exit(1); }
  s = s.replace(alt, '');
} else {
  s = s.replace(oldChip, '');
}

/* 2) قسم مستقل للكود بعد الهيرو مباشرة */
const anchor = `      {/* البحث */}`;
if (!s.includes(anchor)) fail('search anchor');
const promoSection = `      {/* كود الخصم المنشور */}
      {promoCode && promoDisc && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-[1.4rem] border-2 border-dashed border-[#8A6A48] bg-[#F1DCB0] px-4 py-3.5 anim-rise">
          <div className="min-w-0">
            <p className="text-[10px] font-black text-[#7C8665]">🎁 كود خصم حصري من Dose Cafe</p>
            <p className='font-mono text-[22px] font-black tracking-[.25em] text-[#26301C]' dir='ltr'>{promoCode}</p>
            <p className="text-[10.5px] font-bold text-[#7C8665]">استخدمه في الكشك واحصل على خصم {promoDisc}% على طلبك</p>
          </div>
          <span className="flex-none rounded-full bg-[#26301C] px-3.5 py-1.5 text-[11px] font-black text-[#C9D3A8]">خصم {promoDisc}%</span>
        </div>
      )}

      {/* البحث */}`;
s = s.replace(anchor, promoSection);

writeFileSync(f, s);
console.log('promo code has its own section on home');
