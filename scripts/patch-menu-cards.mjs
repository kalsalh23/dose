// توحيد لون بطاقات المنيو مع بطاقات الأكثر طلبًا (أبيض + حلقة فاتحة)
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

const old = '              className="rounded-[1.75rem] bg-[#F1DCB0] p-2.5 text-right shadow-sm shadow-[#8a6a48]/15 transition hover:-translate-y-1 hover:shadow-lg anim-rise">';
const nw = '              className="rounded-[1.75rem] bg-white p-2.5 text-right shadow-sm shadow-[#8a6a48]/15 ring-1 ring-[#D5DEB4] transition hover:-translate-y-1 hover:shadow-lg anim-rise">';
if (!s.includes(old)) { console.error('menu card not found'); process.exit(1); }
s = s.replace(old, nw);
writeFileSync(f, s);
console.log('menu cards now white like most-ordered cards');
