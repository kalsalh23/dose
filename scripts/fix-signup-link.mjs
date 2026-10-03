import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/customer/CustomerApp.tsx';
let t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const old = `<button onClick={() => nav('/signup')} className="mt-3 w-full py-2 text-center text-sm font-bold text-[#5C6B3C]">ليس لديك حساب؟ أنشئ حسابك الآن</button>`;
if (!t.includes(old)) { console.error('ANCHOR NOT FOUND'); process.exit(1); }
// نص واضح: داكن وعريض مع زر صغير بارز بدل لون باهت
const nw = `<div className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/70 py-3 ring-1 ring-[#D5DEB4]">
          <span className="text-sm font-bold text-[#414D36]">ليس لديك حساب؟</span>
          <button onClick={() => nav('/signup')} className="rounded-full bg-[#26301C] px-4 py-1.5 text-sm font-black text-[#E9EDD6] shadow transition active:scale-95">أنشئ حسابك الآن</button>
        </div>`;
t = t.split(old).join(nw);
writeFileSync(f, t);
console.log('signup CTA made prominent (' + (t.match(/ليس لديك حساب؟/g) || []).length, 'occurrences)');
