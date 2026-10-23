import { readFileSync } from 'node:fs';
const t = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const i = t.indexOf('function LoginPage');
console.log(i < 0 ? 'NO LoginPage fn' : t.slice(i, i + 1900));
