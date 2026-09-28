import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const lines = s.split('\n');
for (let i = 236; i < 246; i++) console.log((i + 1) + ': ' + lines[i]);
