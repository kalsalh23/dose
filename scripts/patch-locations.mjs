// ربط إحداثيات الموقع + تحديث شارات الاسم
import { readFileSync, writeFileSync } from 'node:fs';

function patch(file, pairs) {
  let s = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) { console.log('SKIP (not found in ' + file + '):', a.slice(0, 60)); continue; }
    s = s.split(a).join(b);
  }
  writeFileSync(file, s);
  console.log(file, 'patched');
}

patch('src/customer/CustomerApp.tsx', [
  ['>COFFEE &amp; MORE</span>', '>CAFE</span>'],
  ["contactRow('pin', 'موقع المحل', 'افتح موقعنا على الخريطة', 'https://www.google.com/maps/search/?api=1&query=Dose+Coffee+%26+More')",
   "contactRow('pin', 'موقع المحل', '35.1327334 , 36.7526210', 'https://www.google.com/maps?q=35.1327334,36.7526210')"],
]);

patch('src/kiosk/KioskApp.tsx', [
  ['>COFFEE &amp; MORE</span>', '>CAFE</span>'],
  ['Coffee & More</i>', 'Cafe</i>'],
]);

patch('supabase/schema.sql', [
  ["('Dose Cafe','0936107119','963936107119','Dose Cafe')",
   "('Dose Cafe','0936107119','963936107119','35.1327334, 36.7526210')"],
]);
