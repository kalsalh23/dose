import { readFileSync } from 'node:fs';
const t = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const i = t.indexOf('function AccountPage');
const s = t.slice(i, t.indexOf('function ', i + 10));
const k = s.indexOf('avatar');
console.log(s.slice(0, 1200));
console.log('--- changeAvatar btn ---');
const c = s.indexOf('changeAvatar');
console.log(s.slice(c - 400, c + 600));
