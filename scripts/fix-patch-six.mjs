// تصحيح مرساة navItems في patch-six.mjs (4 عناصر حاليًا وليس 5)
import { readFileSync, writeFileSync } from 'node:fs';

let s = readFileSync('scripts/patch-six.mjs', 'utf8');
const bad = "{ to: '/account', icon: 'user', label: 'حسابي' },\n    ";
let n = s.split(bad).length - 1;
// في القالب القديم فقط (أول ظهور) نحذف حسابي ليطابق الملف الفعلي
if (n > 0) {
  s = s.replace(bad, '');
  writeFileSync('scripts/patch-six.mjs', s);
  console.log('removed /account line from oldNavItems template, count was', n);
} else {
  console.log('nothing to fix');
}
