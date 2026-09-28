// إرجاع كود الخصم داخل الهيرو (الجهة المقابلة للزر) + حذف القسم المستقل
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* 1) حذف القسم المستقل */
const standalone = `      {/* كود الخصم المنشور */}
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
if (!s.includes(standalone)) fail('standalone section');
s = s.replace(standalone, '      {/* البحث */}');

/* 2) إعادة الرقاقة داخل الهيرو قبل زر اطلب الآن */
const oldRow = `        <div className="mt-4 flex items-end justify-between gap-2">
          <button onClick={scrollToMenu}`;
if (!s.includes(oldRow)) fail('hero row');
const newRow = `        <div className="mt-4 flex items-end justify-between gap-2">
          {promoCode && promoDisc ? (
            <div className="rounded-xl border-2 border-dashed border-[#C9D3A8]/70 px-2.5 py-1.5 text-center">
              <p className="text-[8.5px] font-bold text-[#C9D3A8]">كود خصم {promoDisc}%</p>
              <p className='font-mono text-[13px] font-black tracking-widest' dir='ltr'>{promoCode}</p>
            </div>
          ) : <span />}
          <button onClick={scrollToMenu}`;
s = s.replace(oldRow, newRow);

writeFileSync(f, s);
console.log('promo code is part of the hero again');
