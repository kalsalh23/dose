import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* 1) صفحة استبدل نقاطك: تحت الرقم */
const oldBalance = `        <p className="mt-1 text-5xl font-black">{myData?.customer?.points ?? session.customer.points}</p>`;
if (!s.includes(oldBalance)) fail('rewards balance');
const expDate = `        {(() => {
          const exp = myData?.customer?.points_expires_at;
          if (!exp) return null;
          return <p className="mt-2 text-[11px] font-extrabold text-[#EAC98F]">⏳ النقاط صالحة إلى التاريخ: {new Date(exp).toLocaleDateString('ar-SY', { day: 'numeric', month: 'long', year: 'numeric' })}</p>;
        })()}`;
s = s.replace(oldBalance, oldBalance + '\n' + expDate);

/* 2) حسابي: تحت عداد النقاط */
const oldAcc = `<p className="text-xl font-black text-[#C9D3A8]">{c.points}</p><p className="text-[10px] font-bold text-white/70">نقطة</p>`;
if (!s.includes(oldAcc)) fail('account points box');
const nwAcc = `<p className="text-xl font-black text-[#C9D3A8]">{c.points}</p><p className="text-[9px] font-bold text-white/60">{c.points_expires_at ? 'صالحة إلى ' + new Date(c.points_expires_at).toLocaleDateString('ar-SY', { day: 'numeric', month: 'short' }) : 'نقطة'}</p>`;
s = s.replace(oldAcc, nwAcc);

writeFileSync(f, s);
console.log('validity lines added');
