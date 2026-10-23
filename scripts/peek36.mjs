import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const i = s.indexOf('      {/* الهيرو */}');
console.log(JSON.stringify(s.slice(i, i + 1500)));
