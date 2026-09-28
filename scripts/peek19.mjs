import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const lines = s.split('\n').slice(0, 242);
let d2 = 0;
let events = [];
lines.forEach((l, i) => {
  for (const ch of l) {
    if (ch === '(') d2++;
    if (ch === ')') { d2--; if (d2 < 0) { events.push('line ' + (i + 1) + ' negative, depth=' + d2); d2 = 0; } }
  }
});
console.log('final depth:', d2);
console.log('negative events:', events.slice(0, 8));
