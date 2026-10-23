// نموذج الإعلان: حقل نهاية واحد فقط + تحويل التوقيت عند الحفظ
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/admin/AdminApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// 1) النموذج: استبدال خانتي البداية/النهاية بحقل نهاية واحد
const oldFields = `<div className="grid grid-cols-2 gap-2">
                <Field label="بداية العرض"><input type="datetime-local" className={inputCls} dir="ltr" value={edit.starts_at} onChange={(e) => setEdit({ ...edit, starts_at: e.target.value })} /></Field>
                <Field label="نهاية العرض"><input type="datetime-local" className={inputCls} dir="ltr" value={edit.ends_at} onChange={(e) => setEdit({ ...edit, ends_at: e.target.value })} /></Field>
              </div>`;
if (!s.includes(oldFields)) { console.error('timing fields not found'); process.exit(1); }
const newFields = `<Field label="نهاية العرض (اختياري — يبدأ فور الحفظ)"><input type="datetime-local" className={inputCls} dir="ltr" value={edit.ends_at} onChange={(e) => setEdit({ ...edit, ends_at: e.target.value })} /></Field>`;
s = s.replace(oldFields, newFields);

// 2) الحفظ: تحويل نهاية العرض إلى ISO (منطقة زمنية صحيحة)
const oldSave = `onClick={() => wrap(async () => { await arpc('admin_save_ad', { p_token: token, p_ad: edit }); setEdit(null); load(); })}`;
if (!s.includes(oldSave)) { console.error('save ad handler not found'); process.exit(1); }
const newSave = `onClick={() => wrap(async () => {
                const ad = { ...edit, ends_at: edit.ends_at ? new Date(edit.ends_at).toISOString() : '' };
                await arpc('admin_save_ad', { p_token: token, p_ad: ad });
                setEdit(null); load();
              })}`;
s = s.replace(oldSave, newSave);

// 3) EMPTY_AD: إزالة starts_at
s = s.replace(
  "const EMPTY_AD = { id: 0, image_url: '/img/latte.jpg', title: '', description_ar: '', old_price_cents: '', new_price_cents: '', discount_percent: '', starts_at: '', ends_at: '', is_active: true, full_screen: false };",
  "const EMPTY_AD = { id: 0, image_url: '/img/latte.jpg', title: '', description_ar: '', old_price_cents: '', new_price_cents: '', discount_percent: '', ends_at: '', is_active: true, full_screen: false };"
);

// 4) تعبئة التعديل: إزالة starts_at
s = s.replace(
  "onClick={() => setEdit({ ...EMPTY_AD, ...a, starts_at: a.starts_at?.slice(0, 16), ends_at: a.ends_at ? a.ends_at.slice(0, 16) : '' })}",
  "onClick={() => setEdit({ ...EMPTY_AD, ...a, ends_at: a.ends_at ? a.ends_at.slice(0, 16) : '' })}"
);

writeFileSync(f, s);
console.log('ad form: single end field + ISO conversion');
