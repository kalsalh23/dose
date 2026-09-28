// البحث: كل النتائج أثناء الكتابة + إخفاء الأقسام المشوشة + إرجاع بطاقة الكود بشرط البحث
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* 1) searching + menuItems بلا حد أثناء البحث */
const oldMenu = "  const menuItems = showAll ? shown : shown.slice(0, 4);";
if (!s.includes(oldMenu)) fail('menuItems');
s = s.replace(oldMenu, "  const searching = q.trim() !== '';\n  const menuItems = searching || showAll ? shown : shown.slice(0, 4);");

/* 2) إخفاء الأكثر طلبًا أثناء البحث */
const oldMO = "      {mostOrdered.length > 0 && (";
if (!s.includes(oldMO)) fail('most ordered');
s = s.replace(oldMO, "      {!searching && mostOrdered.length > 0 && (");

/* 3) زر عرض الكل يختفي أثناء البحث */
const oldShowAllBtn = "          {shown.length > 4 && (";
if (!s.includes(oldShowAllBtn)) fail('show all button');
s = s.replace(oldShowAllBtn, "          {!searching && shown.length > 4 && (");

/* 4) بطاقة كود الخصم بعد الفئات — تختفي أثناء البحث */
const anchorRender = `      <FeaturedCategories catalog={catalog} cat={cat} setCat={(c) => { setCat(c); setQ(''); }} />`;
if (!s.includes(anchorRender)) fail('cats render');
s = s.replace(anchorRender, anchorRender + `\n\n      {!searching && <PromoBanner settings={catalog?.settings ?? {}} />}`);

writeFileSync(f, s);
console.log('done. searching guards:', (s.match(/!searching && /g) || []).length, '| PromoBanner render:', s.includes('{!searching && <PromoBanner'));
