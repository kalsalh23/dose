import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const i = s.indexOf('onClick={scrollToMenu}');
console.log(JSON.stringify(s.slice(i - 220, i + 260)));
