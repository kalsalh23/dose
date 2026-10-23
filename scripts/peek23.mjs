import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
// فقط للعرض: عدد أسطر الملف الحالي
console.log('lines:', s.split('\n').length);
