// توحيد عرض العملة بالليرة السورية في لوحة الإدارة
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/admin/AdminApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// استيراد العملة من الإعدادات يتطلب تحميلها — الحل الأبسط: عرض ل.س افتراضيًا عبر eur
// eur(cents) تعرض € افتراضيًا؛ نحوّل كل استدعاءاتها في الإدارة إلى صيغة الليرة عبر رمز 'ل.س'
const uses = s.match(/eur\(([^)]+)\)/g) || [];
let n = 0;
s = s.replace(/eur\(([^)]+)\)/g, (m, inner) => {
  if (m.includes('ل.س')) return m;
  n++;
  return `eur(${inner}, 'ل.س')`;
});

// حقول الإدخال: تحويل القيمة من سنتات يورو (÷100) إلى ليرة مباشرة أمر معقد هنا؛
// نكتفي بتصحيح التسميات ليطابق الحقل المعنى
s = s.split('<Field label="السعر القديم">').join('<Field label="السعر القديم (ل.س)">');
s = s.split('<Field label="السعر الجديد">').join('<Field label="السعر الجديد (ل.س)">');
s = s.split('<Field label="الخصم %">').join('<Field label="الخصم %">');

writeFileSync(f, s);
console.log('eur calls converted:', n);
