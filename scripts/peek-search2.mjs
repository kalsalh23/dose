import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const i = s.indexOf("const menuItems = showAll");
console.log(JSON.stringify(s.slice(i, i + 260)));
const j = s.indexOf('{shown.length > 4 && (', i);
console.log('---');
console.log(JSON.stringify(s.slice(j - 200, j + 200)));
