// الكشك: حفظ حالة free في setDone
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/kiosk/KioskApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const old = '      setDone({ orderNumber: res.order_number, points: res.total_points });';
if (!s.includes(old)) { console.error('setDone not found'); process.exit(1); }
s = s.replace(old, '      setDone({ orderNumber: res.order_number, points: res.total_points, free: !!res.free });');
writeFileSync(f, s);
console.log('setDone stores free');
