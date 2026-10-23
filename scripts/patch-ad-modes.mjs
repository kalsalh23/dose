// نموذج الإعلان: قائمة مكان الظهور (هيرو فقط / ملء الشاشة + الهيرو) + فلترة الهيرو
import { readFileSync, writeFileSync } from 'node:fs';

/* ===== لوحة الإدارة ===== */
const af = 'src/admin/AdminApp.tsx';
let a = readFileSync(af, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* 1) EMPTY_AD: show_in_hero */
const oldEmpty = "const EMPTY_AD = { id: 0, image_url: '/img/latte.jpg', title: '', description_ar: '', old_price_cents: '', new_price_cents: '', discount_percent: '', ends_at: '', is_active: true, full_screen: false };";
if (!a.includes(oldEmpty)) fail('EMPTY_AD');
a = a.replace(oldEmpty, "const EMPTY_AD = { id: 0, image_url: '/img/latte.jpg', title: '', description_ar: '', old_price_cents: '', new_price_cents: '', discount_percent: '', ends_at: '', is_active: true, full_screen: false, show_in_hero: true };");

/* 2) استبدال حقل ملء الشاشة بقائمة مكان الظهور */
const oldFS = `              <Field label="ملء الشاشة عند الدخول">
                  <select className={inputCls} value={String(edit.full_screen)} onChange={(e) => setEdit({ ...edit, full_screen: e.target.value === 'true' })}>
                    <option value="false">لا</option><option value="true">نعم</option>
                  </select>
                </Field>`;
if (!a.includes(oldFS)) fail('fullscreen field');
const newFS = `              <Field label="مكان الظهور">
                  <select className={inputCls} value={edit.full_screen ? 'both' : 'hero'} onChange={(e) => setEdit({ ...edit, full_screen: e.target.value === 'both', show_in_hero: true })}>
                    <option value="hero">ضمن الهيرو فقط</option>
                    <option value="both">ملء الشاشة + الهيرو</option>
                  </select>
                </Field>`;
a = a.replace(oldFS, newFS);

/* 3) تعبئة التعديل: mode */
const oldPrefill = `onClick={() => setEdit({ ...EMPTY_AD, ...a, starts_at: a.starts_at?.slice(0, 16), ends_at: a.ends_at ? a.ends_at.slice(0, 16) : '' })}`;
if (a.includes(oldPrefill)) {
  a = a.replace(oldPrefill, `onClick={() => setEdit({ ...EMPTY_AD, ...a, full_screen: !!a.full_screen, show_in_hero: a.show_in_hero !== false, ends_at: a.ends_at ? a.ends_at.slice(0, 16) : '' })}`);
}

writeFileSync(af, a);
console.log('admin ad form updated');

/* ===== تطبيق العميل: فلترة الهيرو ===== */
const cf = 'src/customer/CustomerApp.tsx';
let s = readFileSync(cf, 'utf8').replace(/\r\n/g, '\n');

/* النوع */
const tf = 'src/lib/types.ts';
let t = readFileSync(tf, 'utf8').replace(/\r\n/g, '\n');
if (!t.includes('show_in_hero')) {
  t = t.replace(
    "  old_price_cents: number | null; new_price_cents: number | null; discount_percent: number | null; full_screen: boolean;\n}",
    "  old_price_cents: number | null; new_price_cents: number | null; discount_percent: number | null; full_screen: boolean; show_in_hero?: boolean;\n}"
  );
  writeFileSync(tf, t);
  console.log('Ad type updated');
}

/* الرئيسية تستقبل إعلانات الهيرو فقط */
const oldHomeCall = '          <Route path="/" element={<Home catalog={catalog} openProduct={setProduct} ads={ads} onOpenAd={(a) => setAdOpen(a)} />} />';
if (!s.includes(oldHomeCall)) fail('home route');
s = s.replace(oldHomeCall, '          <Route path="/" element={<Home catalog={catalog} openProduct={setProduct} ads={heroAds} onOpenAd={(a) => setAdOpen(a)} />} />');

const oldAdsDef = "  const ads = catalog?.ads ?? [];";
if (!s.includes(oldAdsDef)) fail('ads def');
s = s.replace(oldAdsDef, "  const ads = catalog?.ads ?? [];\n  const heroAds = useMemo(() => ads.filter((ad) => ad.show_in_hero !== false), [catalog]);");

writeFileSync(cf, s);
console.log('customer hero filter added');
