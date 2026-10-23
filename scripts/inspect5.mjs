import { readFileSync } from 'node:fs';
const t = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const i = t.indexOf('function OrdersPage');
const s = t.slice(i, t.indexOf('function ', i + 10));
console.log(s.slice(s.indexOf('{orders.map')));
const j = t.indexOf('session.customer.avatar_url');
console.log('--- avatar fallback ---');
console.log(t.slice(j - 120, j + 320));
