// إزالة «حسابي» من الشريط السفلي (يبقى الوصول للحساب من الهيدر)
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

const line = "    { to: '/account', icon: 'user', label: 'حسابي' },\n";
if (!s.includes(line)) { console.error('account nav line not found'); process.exit(1); }
s = s.split(line).join('');

writeFileSync(f, s);
console.log('removed | still present:', s.includes("to: '/account', icon: 'user'"));
