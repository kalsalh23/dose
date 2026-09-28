import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const i = s.indexOf('PromoBanner');
console.log(JSON.stringify(s.slice(i - 60, i + 120)));
