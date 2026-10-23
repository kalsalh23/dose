// الكشك: حالة الإغلاق — مرساة صحيحة
import { readFileSync, writeFileSync } from 'node:fs';

const kf = 'src/kiosk/KioskApp.tsx';
let k = readFileSync(kf, 'utf8').replace(/\r\n/g, '\n');
const kfail = (m) => { console.error('MISSING:', m); process.exit(1); };

const anchor = `  const searchTimer = useRef<number | undefined>(undefined);`;
if (!k.includes(anchor)) kfail('kiosk anchor');
k = k.replace(anchor, anchor + `

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

// تعطيل زر الطلب + رسالة الإغلاق
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
