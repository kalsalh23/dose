import { readFileSync } from 'node:fs';
const s = readFileSync('src/admin/AdminApp.tsx', 'utf8');
const i = s.indexOf('async function arpc');
console.log(s.slice(i, i + 500));
