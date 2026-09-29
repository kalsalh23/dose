// سطر "النقاط صالحة إلى التاريخ" تحت مجموع النقاط (المكافآت + حسابي)
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* 1) النوع */
const tf = 'src/lib/types.ts';
let t = readFileSync(tf, 'utf8').replace(/\r\n/g, '\n');
if (!t.includes('points_expires_at')) {
  t = t.replace(
    'export interface AppCustomer {\n  id: string; full_name: string; phone: string; points: number; orders_count: number; avatar_url?: string;\n}',
    'export interface AppCustomer {\n  id: string; full_name: string; phone: string; points: number; orders_count: number; avatar_url?: string; points_expires_at?: string;\n}'
  );
  writeFileSync(tf, t);
  console.log('type updated');
}

/* 2) صفحة استبدل نقاطك: تحت الرقم */
const oldBalance = `        <p className="mt-1 text-5xl font-black">{myData?.customer?.points ?? session.customer.points}</p>
        <p className="mt-1 text-[11px] text-white/70">استبدل نقاطك بمشروبات وحلويات مجانية</p>`;
if (!s.includes(oldBalance)) fail('rewards balance');
const expDate = `      {(() => {
        const exp = myData?.customer?.points_expires_at;
        if (!exp) return null;
        return <p className="mt-2 text-[11px] font-extrabold text-[#EAC98F]">⏳ النقاط صالحة إلى التاريخ: {new Date(exp).toLocaleDateString('ar-SY', { day: 'numeric', month: 'long', year: 'numeric' })}</p>;
      })()}`;
s = s.replace(oldBalance, oldBalance + '\n' + expDate);

/* 3) حسابي: تحت عداد النقاط */
const oldAcc = `          <div className="rounded-3xl bg-white/10 py-3"><p className="text-xl font-black text-[#EAC98F]">{c.points}</p><p className="text-[10px] font-bold text-white/70">نقطة</p></div>`;
if (!s.includes(oldAcc)) fail('account points box');
s = s.replace(oldAcc, `          <div className="rounded-3xl bg-white/10 py-3">
            <p className="text-xl font-black text-[#EAC98F]">{c.points}</p>
            <p className="text-[9px] font-bold text-white/60">{c.points_expires_at ? 'صالحة إلى ' + new Date(c.points_expires_at).toLocaleDateString('ar-SY', { day: 'numeric', month: 'short' }) : 'نقطة'}</p>
          </div>`);

writeFileSync(f, s);
console.log('validity lines added');
