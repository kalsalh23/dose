import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const lines = s.split('\n');
const i = lines.findIndex((l) => l.includes('{!searching && <PromoBanner'));
console.log('render at line', i + 1);
// ابحث عن آخر 'function ' قبل هذا السطر
for (let j = i; j >= 0; j--) {
  if (lines[j].startsWith('function ')) { console.log('enclosing function:', lines[j].slice(0, 60)); break; }
}
console.log('context:', JSON.stringify(lines.slice(i - 4, i + 3).join('\n')));
