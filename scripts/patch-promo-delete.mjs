// زر حذف كود الخصم في تبويب كود الخصم
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/admin/AdminApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

const oldPublish = `        <button disabled={busy || !(settings.promo_code ?? '').trim()} onClick={() => wrap(async () => {
          const r = await arpc<{ notified: number }>('admin_publish_promo', { p_token: token, p_code: settings.promo_code, p_discount: Number(settings.promo_discount) });
          setMsg('تم نشر الكود — أُرسل إشعار داخلي وفوري إلى ' + (r.notified ?? 'كل') + ' الزبائن ✓');
          load(); setTimeout(() => setMsg(''), 6000);
        })} className={\`\${btnCls} w-full\`} style={{ borderRadius: 16, height: 46 }}>
          {busy ? 'جارٍ النشر…' : 'نشر الكود وإرسال الإشعارات'}
        </button>`;
if (!s.includes(oldPublish)) fail('publish button');
const newPublish = oldPublish + `
        {settings.promo_code && (
          <button disabled={busy} onClick={() => wrap(async () => {
            await arpc('admin_delete_promo', { p_token: token });
            setMsg('حُذف كود الخصم — اختفى من التطبيق'); load();
            setTimeout(() => setMsg(''), 5000);
          })} className="w-full rounded-2xl bg-red-50 py-3 text-sm font-black text-[#C4482E] transition active:scale-[.98] disabled:opacity-40">
            🗑️ حذف كود الخصم
          </button>
        )}`;
s = s.replace(oldPublish, newPublish);
writeFileSync(f, s);
console.log('delete promo button added');
