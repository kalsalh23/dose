import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const i = s.indexOf('تسجيل الخروج', s.indexOf('function AccountPage'));
console.log(JSON.stringify(s.slice(i - 420, i - 200)));
