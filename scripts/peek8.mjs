import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
// هل القسمان ما زالا في الأعلى؟
console.log('strips at top:', s.includes('PopularStrip title="الأكثر مبيعًا"'));
const i = s.indexOf('<PopularStrip');
console.log('first strip pos:', i);
const j = s.indexOf('FeaturedCategories catalog={catalog}');
console.log('cats pos:', j);
// اعرض ما بين الفئات وبعد 300 حرف
console.log(JSON.stringify(s.slice(j + 80, j + 400)));
