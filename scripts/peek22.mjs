import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const lines = s.split('\n');
const i = lines.findIndex((l) => l.startsWith('function Home'));
console.log('Home at line', i + 1);
console.log(JSON.stringify(lines.slice(i, i + 30).join('\n')));
