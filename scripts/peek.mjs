import { readFileSync, writeFileSync } from 'node:fs';

const s = readFileSync('scripts/patch-six.mjs', 'utf8');
const i = s.indexOf('oldNavItems');
console.log('=== CURRENT BLOCK ===');
console.log(s.slice(i, i + 800));
