import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const i = s.indexOf("phase === 'review'");
console.log(s.slice(i, i + 900));
