// تحديث أسعار الـseed لليرة سورية + إضافة قائمة الحلويات للمخطط
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'supabase/schema.sql';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

const priceFix = [
  ["('hot','إسبريسو','Espresso','إسبريسو مركّز من حبوب مختارة',200,2", 15000],
  ["('hot','ماكياتو','Macchiato','إسبريسو مع لمسة حليب',300,3", 20000],
  ["('hot','أمريكانو','Americano','إسبريسو مع ماء ساخن',250,4", 20000],
  ["('hot','كابتشينو','Cappuccino','إسبريسو مع حليب مبخر ورغوة ناعمة',400,4", 25000],
  ["('hot','لاتيه','Latte','إسبريسو مع حليب حريري',400,5", 25000],
  ["('hot','موكا','Mocha','إسبريسو مع شوكولاتة وحليب',450,6", 30000],
  ["('hot','كراميل ماكياتو','Caramel Macchiato','لاتيه مع كراميل ذهبي',450,5", 30000],
  ["('cold','آيس لاتيه','Iced Latte','لاتيه بارد منعش',450,7", 30000],
  ["('cold','آيس موكا','Iced Mocha','موكا بارد مع كريمة',450,7", 30000],
  ["('dessert','كيك الشوكولاتة','Chocolate Cake','كيكة شوكولاتة غنية',350,4", 35000],
  ["('dessert','كيك الفانيليا','Vanilla Cake','كيكة فانيليا طرية',350,4", 30000],
  ["('dessert','كوكيز','Cookies','كوكيز بالشوكولاتة طازج',250,3", 20000],
  ["('extras','شوت إسبريسو إضافي','Extra Espresso Shot','شوت إسبريسو إضافي لطلبك',100,1", 10000],
  ["('extras','كراميل إضافي','Extra Caramel','صوص كراميل إضافي',50,1", 5000],
  ["('extras','حليب إضافي','Extra Milk','حليب إضافي لطلبك',50,1", 5000],
];
let missing = 0;
for (const [row, price] of priceFix) {
  if (!s.includes(row)) { console.error('MISSING:', row.slice(0, 40)); missing++; continue; }
  const m = row.match(/,(\d+),(\d+)$/);
  const points = m ? m[2] : '1';
  const newRow = row.replace(/,(\d+),(\d+)$/, ',' + price + ',' + points);
  s = s.replace(row, newRow);
}
console.log('price rows missing:', missing);

const desserts = readFileSync('scripts/add-desserts.sql', 'utf8');
const dessertsInsert = desserts.slice(
  desserts.indexOf('insert into public.products'),
  desserts.indexOf('select p.name_ar, p.price_cents')
);

const anchor = 'insert into public.rewards';
if (!s.includes(anchor)) { console.error('rewards anchor missing'); process.exit(1); }
s = s.replace(anchor, `-- قائمة الحلويات (من ملف المنيو)\n${dessertsInsert}\n${anchor}`);

writeFileSync(f, s);
console.log('schema seed updated | dessert rows in seed:', (s.match(/تشيز كيك فراوله/g) || []).length);
