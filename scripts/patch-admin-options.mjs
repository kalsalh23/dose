// إضافة حقل خيارات الذوق لنموذج المنتج في الإدارة
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/admin/AdminApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// 1) إضافة options للنموذج الفارغ
s = s.replace(
  "price_cents: 0, points: 0, image_url: '', is_active: true, sort_order: 0 };",
  "price_cents: 0, points: 0, image_url: '', options: '', is_active: true, sort_order: 0 };"
);

// 2) حقل إدخال الخيارات بعد الوصف
const anchor = `<Field label="الوصف"><textarea className={\`\${inputCls} h-20 py-2\`} value={edit.description_ar} onChange={(e) => setEdit({ ...edit, description_ar: e.target.value })} /></Field>`;
if (!s.includes(anchor)) { console.error('description anchor missing'); process.exit(1); }
s = s.replace(anchor, anchor + `
              <Field label="خيارات الذوق (افصل بفاصلة)"><input className={inputCls} value={edit.options || ''} onChange={(e) => setEdit({ ...edit, options: e.target.value })} placeholder="سكر إضافي، بدون سكر، نعناع" /></Field>`);

writeFileSync(f, s);
console.log('admin options field added:', s.includes('خيارات الذوق'));
