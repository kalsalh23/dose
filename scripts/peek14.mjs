import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const lines = s.split('\n');
console.log(JSON.stringify(lines.slice(248, 275).join('\n')));
