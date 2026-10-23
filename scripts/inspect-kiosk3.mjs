import { readFileSync } from 'node:fs';
const t = readFileSync('src/kiosk/KioskApp.tsx', 'utf8');
let i = -1;
console.log('--- view usages ---');
while ((i = t.indexOf('view', i + 1)) > 0) {
  const ctx = t.slice(i - 40, i + 60).replace(/\n/g, '|');
  if (!ctx.includes('review') && !ctx.includes('preview')) console.log(JSON.stringify(ctx));
}
const r = t.indexOf('reset = () =>');
console.log('--- reset ---');
console.log(t.slice(r, r + 260));
