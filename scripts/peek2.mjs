import { readFileSync } from 'node:fs';
const s = readFileSync('src/admin/AdminApp.tsx', 'utf8');
const i = s.indexOf('admin_save_ad');
console.log(JSON.stringify(s.slice(i - 180, i + 120)));
