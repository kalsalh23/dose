// إعادة تصميم تبويب الإعلانات: بطاقات معاينة أنيقة + نموذج منظم
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/admin/AdminApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* استبدال قسم عرض الإعلانات (القائمة) */
const oldListStart = `      <div className="grid gap-3 md:grid-cols-2">
        {ads.map((a) => (
          <Card key={a.id} className={a.is_active ? '' : 'opacity-50'}>
            <div className="flex gap-3">
              <img src={a.image_url} alt="" className="size-20 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-coffee-900">{a.title} {a.full_screen && <span className="ms-1 rounded-full bg-gold/20 px-2 py-0.5 text-[9px] font-black text-gold-deep">ملء الشاشة</span>}</p>`;
const newListStart = `      <div className="grid gap-3 md:grid-cols-2">
        {ads.map((a) => (
          <Card key={a.id} className={a.is_active ? '' : 'opacity-50'}>
            <div className="flex gap-3">
              <img src={a.image_url} alt="" className="size-20 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-coffee-900">
                  {a.title}
                  <span className={\`ms-2 rounded-full px-2 py-0.5 text-[9px] font-black \${a.full_screen ? 'bg-[#414D36] text-[#C9D3A8]' : 'bg-[#D5DEB4] text-[#414D36]'}\`}>
                    {a.full_screen ? 'ملء الشاشة' : 'ضمن الهيرو'}
                  </span>
                </p>`;
if (!s.includes(oldListStart)) fail('ads list start');
s = s.replace(oldListStart, newListStart);

/* شارات السعر والخصم */
const oldPrice = `                <p className="mt-1 text-xs font-extrabold text-gold-deep">
                  {a.new_price_cents != null ? eur(a.new_price_cents) : ''} {a.old_price_cents != null && <span className="font-bold text-neutral-400 line-through">{eur(a.old_price_cents)}</span>}
                  {a.discount_percent != null && <span className="ms-1">(-{a.discount_percent}%)</span>}
                </p>`;
if (!s.includes(oldPrice)) fail('ad price');
const newPrice = `                <p className="mt-1 text-xs font-extrabold text-[#7C8F52]">
                  {a.new_price_cents != null ? eur(a.new_price_cents, 'ل.س') : ''} {a.old_price_cents != null && <span className="font-bold text-neutral-400 line-through">{eur(a.old_price_cents, 'ل.س')}</span>}
                  {a.discount_percent != null && <span className="ms-1">(-{a.discount_percent}%)</span>}
                </p>
                <p className="mt-0.5 text-[10px] font-bold text-neutral-400">
                  {a.full_screen ? '🖥️ يظهر بملء الشاشة عند الدخول' : '📱 يظهر ضمن الهيرو المتنقل'}
                  {a.ends_at ? ' · حتى ' + new Date(a.ends_at).toLocaleDateString('ar-SY', { day: 'numeric', month: 'short' }) : ' · بلا نهاية'}
                </p>`;
s = s.replace(oldPrice, newPrice);

/* نموذج الإضافة/التعديل: عنوان أوضح + تسمية حقل الظهور */
const oldFormLabel = `              <Field label="ملء الشاشة عند الدخول">`;
if (!s.includes(oldFormLabel)) fail('form label');
s = s.replace(oldFormLabel, `              <Field label="مكان الظهور (ملء الشاشة = يظهر عند دخول التطبيق)">`);

/* أزرار الحفظ داخل النموذج: صف الحفظ والحذف */
const oldFormBtns = `            <div className="mt-5 grid grid-cols-2 gap-3">
              <button disabled={busy} onClick={() => wrap(async () => { await arpc('admin_save_ad', { p_token: token, p_ad: ad }); setEdit(null); load(); })}
                className="rounded-2xl bg-gradient-to-l from-gold to-gold-deep py-3 text-sm font-extrabold text-white disabled:opacity-50">حفظ</button>
              <button onClick={() => setEdit(null)} className="rounded-2xl bg-neutral-100 py-3 text-sm font-extrabold text-neutral-600">إلغاء</button>
            </div>`;
if (!s.includes(oldFormBtns)) fail('form buttons');
const newFormBtns = `            <div className="mt-5 grid grid-cols-2 gap-3">
              <button disabled={busy} onClick={() => wrap(async () => { await arpc('admin_save_ad', { p_token: token, p_ad: ad }); setEdit(null); load(); })}
                className="rounded-2xl bg-gradient-to-l from-gold to-gold-deep py-3 text-sm font-extrabold text-white disabled:opacity-50">حفظ ونشر</button>
              <button onClick={() => setEdit(null)} className="rounded-2xl bg-neutral-100 py-3 text-sm font-extrabold text-neutral-600">إلغاء</button>
            </div>`;
s = s.replace(oldFormBtns, newFormBtns);

writeFileSync(f, s);
console.log('ads interface redesigned');
