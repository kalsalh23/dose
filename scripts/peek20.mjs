import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const lines = s.split('\n');
let d = 0;
let out = [];
for (let i = 0; i < 242; i++) {
  const l = lines[i];
  for (const ch of l) { if (ch === '(') d++; if (ch === ')') d--; }
  if (i >= 186) out.push((i + 1) + ': d=' + d);
}
console.log(out.join('\n'));
