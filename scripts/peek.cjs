import { readFileSync } from 'node:fs';
const s = readFileSync('scripts/patch-six.mjs', 'utf8');
const i = s.indexOf('oldNavItems');
console.log(JSON.stringify(s.slice(i, i + 700)));
