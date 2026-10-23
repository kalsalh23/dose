// تحويل الهوية البصرية إلى ألوان المنيو: أخضر ميرمية فاتح + زيتوني داكن
import { readFileSync, writeFileSync } from 'node:fs';

const MAP = [
  // خلفيات وتدرجات
  ['#F9EDD2', '#E9EDD6'],
  ['#F3DFB6', '#DCE3C3'],
  ['#F6E7C9', '#E9EDD6'],
  ['#F3F9F4', '#F0F4E4'],
  ['#EAF6EE', '#DFE7CE'],
  ['#F2FAF5', '#F0F4E4'],
  // بطاقات وحقول
  ['#F1DCB0', '#E3E9C8'],
  ['#F8EED6', '#EEF2DC'],
  ['#F3EDE0', '#E3E9C8'],
  ['#F3F0EA', '#F0F4E4'],
  ['#FAF1DC', '#EEF2DC'],
  ['#EFDDBB', '#D5DEB4'],
  // حدود وشارات
  ['#EAD3A0', '#D5DEB4'],
  ['#E0C288', '#C4CF9E'],
  ['#D9B171', '#A9B87F'],
  ['#E7D8B9', '#D5DEB4'],
  ['#EFE3C8', '#D5DEB4'],
  // ذهبي كراميل → أخضر ميرمية
  ['#EAC98F', '#C9D3A8'],
  ['#D9A76C', '#A9B87F'],
  ['#BC8050', '#7C8F52'],
  ['#B07C3A', '#7C8F52'],
  // بنية داكنة → زيتوني داكن
  ['#221B12', '#26301C'],
  ['#4A3A28', '#333D25'],
  ['#5C4430', '#37422C'],
  ['#3E3222', '#23291B'],
  ['#7A5C3E', '#414D36'],
  ['#5C5142', '#5B6247'],
  ['#6E6553', '#6B7357'],
  ['#8A7458', '#77825E'],
  ['#8A6A48', '#5C6B3C'],
  ['#94826A', '#7C8665'],
  ['#A3967D', '#8A9471'],
  ['#6E8B5A', '#6B7A45'],
  ['#7FE7B0', '#C9D3A8'],
  // ظلال
  ['rgba(138,106,72', 'rgba(65,77,54'],
  ['rgba(74,58,40', 'rgba(42,50,35'],
  ['rgba(34,27,18', 'rgba(38,48,28'],
  ['rgba(92,68,48', 'rgba(55,66,44'],
  ['rgba(156,102,54', 'rgba(65,77,54'],
];

const files = [
  'src/customer/CustomerApp.tsx',
  'src/kiosk/KioskApp.tsx',
  'src/admin/AdminApp.tsx',
  'src/components/PinPad.tsx',
  'src/components/Icons.tsx',
  'index.html',
];

for (const f of files) {
  let s = readFileSync(f, 'utf8');
  let n = 0;
  for (const [a, b] of MAP) {
    const c = s.split(a).length - 1;
    if (c) { s = s.split(a).join(b); n += c; }
  }
  writeFileSync(f, s);
  console.log(f, '→', n, 'replacements');
}
console.log('color identity swapped to sage/olive');
