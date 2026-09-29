import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const old = `
      {!searching && <PromoBanner settings={catalog?.settings ?? {}} />}`;
if (!s.includes(old)) { console.error('render not found'); process.exit(1); }
s = s.replace(old, '');
writeFileSync(f, s);
console.log('standalone promo banner render removed:', !s.includes('<PromoBanner'));
