import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
console.log(JSON.stringify(s.slice(13850, 14420)));
