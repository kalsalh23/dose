// ترقيع الهوية الفريش على ملف منصة العميل
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'src/customer/CustomerApp.tsx';
let s = readFileSync(file, 'utf8');
const R = [
  ['bg-[#F6F0E5]', 'bg-[#F3F9F4]'],
  ['bg-coffee-950/95', 'bg-white/95'],
  ['rounded-xl border-2 border-gold/50', 'rounded-xl border-2 border-fresh-200'],
  ['text-[8px] font-bold uppercase tracking-[.2em] text-gold/80', 'text-[8px] font-bold uppercase tracking-[.2em] text-fresh-600'],
  ['bg-gold/15 px-3 py-1.5 text-xs font-extrabold text-gold ring-1 ring-gold/30', 'bg-fresh-100 px-3 py-1.5 text-xs font-extrabold text-fresh-700 ring-1 ring-fresh-200'],
  ['bg-gold/10 text-gold-deep', 'bg-fresh-100 text-fresh-700'],
  ['border-gold/40 bg-gold/10 px-4 py-2 text-xs font-extrabold text-gold', 'border-fresh-200 bg-fresh-50 px-4 py-2 text-xs font-extrabold text-fresh-700'],
  ['text-gold-deep', 'text-fresh-700'],
  ['from-gold to-gold-deep', 'from-fresh-500 to-fresh-700'],
  ['bg-coffee-900 text-cream', 'bg-fresh-700 text-white'],
  ['bg-gradient-to-l from-coffee-800 to-coffee-950', 'bg-gradient-to-l from-fresh-600 to-fresh-900'],
  ['bg-coffee-950 px-3 py-1.5 font-mono', 'bg-fresh-900 px-3 py-1.5 font-mono'],
  ['text-gold"', 'text-white"'],
  ['ring-1 ring-beige', 'ring-1 ring-fresh-100'],
  ['border-t border-beige', 'border-t border-fresh-100'],
  ['border-2 border-beige', 'border-2 border-fresh-100'],
  ['border-dashed border-beige', 'border-dashed border-fresh-100'],
  ['bg-[#FAF5EA]', 'bg-fresh-50'],
  ['focus:border-gold', 'focus:border-fresh-500'],
  ['hover:border-gold/60', 'hover:border-fresh-300'],
  ['shadow-gold/40', 'shadow-fresh-900/25'],
  ['bg-gold/15 text-gold-deep', 'bg-fresh-100 text-fresh-700'],
  ['ring-gold/40', 'ring-fresh-300'],
  ['bg-gold px-2 py-0.5', 'bg-fresh-600 px-2 py-0.5'],
  ["'bg-coffee-900 text-cream shadow'", "'bg-fresh-700 text-white shadow'"],
  ['bg-fresh-700 text-cream', 'bg-fresh-700 text-white'],
  ['text-fresh-700 bg-white/95', 'text-fresh-ink bg-white/95'],
  ["'🧾'", null], ["'🎁'", null], ["'💬'", null], ["'🚪'", null], ["'🔐'", null], ["'🏠'", null], ["'⭐'", null], ["'🔔'", null], ["'👤'", null],
  ['🧾', ''], ['🎁', ''], ['💬', ''], ['🚪', ''], ['🔐', ''], ['🏠', ''], ['⭐', ''], ['🔔', ''], ['👤', ''],
];
for (const [a, b] of R) {
  if (b === null) continue;
  s = s.split(a).join(b);
}
// نصوص الحالة النشطة في الأسفل (NavLink) — تلوين الأيقونات
writeFileSync(file, s);
console.log('fresh patch applied. remaining gold:', (s.match(/gold/g) || []).length, '| remaining emoji:', (s.match(/[⭐🧾🎁💬🚪🔐🏠🔔👤]/gu) || []).length);
