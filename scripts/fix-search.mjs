// إصلاح البحث: أثناء الكتابة تُعرض كل النتائج وتُخفى الأقسام غير ذات الصلة
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* 1) عند البحث: كل النتائج بلا حد الـ4 */
const oldMenu = "  const menuItems = showAll ? shown : shown.slice(0, 4);";
if (!s.includes(oldMenu)) fail('menuItems');
s = s.replace(oldMenu, "  const searching = q.trim() !== '';\n  const menuItems = searching || showAll ? shown : shown.slice(0, 4);");

/* 2) إخفاء الأكثر طلبًا أثناء البحث */
const oldMO = "      {mostOrdered.length > 0 && (";
if (!s.includes(oldMO)) fail('most ordered');
s = s.replace(oldMO, "      {!searching && mostOrdered.length > 0 && (");

/* 3) زر عرض الكل يختفي أثناء البحث (كل النتائج ظاهرة أصلًا) */
const oldShowAllBtn = "          {shown.length > 4 && (";
if (!s.includes(oldShowAllBtn)) fail('show all button');
s = s.replace(oldShowAllBtn, "          {!searching && shown.length > 4 && (");

/* 4) إخفاء بطاقة كود الخصم أثناء البحث أيضًا */
const oldPromo = "      {promoCode && promoDisc && (";
if (!s.includes(oldPromo)) fail('promo card');
s = s.replace(oldPromo, "      {!searching && promoCode && promoDisc && (");

writeFileSync(f, s);
console.log('search fixed: all results shown, distractions hidden');
