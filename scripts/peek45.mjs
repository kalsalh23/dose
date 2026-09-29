import { readFileSync } from 'node:fs';
const s = readFileSync('src/admin/AdminApp.tsx', 'utf8');
const i = s.indexOf('مكان الظهور');
console.log(JSON.stringify(s.slice(i, i + 300)));
