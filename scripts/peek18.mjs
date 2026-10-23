import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
// فحص توازن الأقواس من بداية الملف حتى 242
const lines = s.split('\n').slice(0, 242);
let depth = 0;
lines.forEach((l, i) => {
  for (const ch of l) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
  }
  if (i > 180 && i < 242 && depth < 0) console.log('NEGATIVE at line', i + 1, 'depth', depth);
});
console.log('depth at end of 242:', depth);
// أين بدأ الخلل؟ تتبع السطر الذي جعل العمق سالبًا أو غير متوقع
let d2 = 0;
const events: string[] = [];
s.split('\n').slice(0, 242).forEach((l, i) => {
  for (const ch of l) {
    if (ch === '(') d2++;
    if (ch === ')') { d2--; if (d2 < 0) events.push('line ' + (i + 1) + ' went negative'); }
  }
});
console.log('events:', events.slice(0, 5));
