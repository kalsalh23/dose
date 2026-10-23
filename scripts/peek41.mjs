import { readFileSync } from 'node:fs';
const s = readFileSync('src/admin/AdminApp.tsx', 'utf8');
const i = s.indexOf('عرض الصباح ملء الشاشة');
if (i < 0) { console.log('not found'); } else {
  console.log(JSON.stringify(s.slice(i, i + 500)));
}
