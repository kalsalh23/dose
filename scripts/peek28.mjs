import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const i = s.indexOf('      {items.map', s.indexOf('function NotificationsPage'));
console.log(JSON.stringify(s.slice(i, i + 800)));
