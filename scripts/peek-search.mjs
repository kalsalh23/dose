import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const i = s.indexOf('function Home');
console.log(s.slice(i, i + 2400));
