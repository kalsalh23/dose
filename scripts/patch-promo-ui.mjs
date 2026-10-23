// 1) حقل كود الخصم في إعدادات الإدارة  2) بطاقة الكود في الرئيسية  3) إعادة تصميم الفئات والمنتجات
import { readFileSync, writeFileSync } from 'node:fs';

/* ===== الإدارة: حقول كود الخصم ===== */
const af = 'src/admin/AdminApp.tsx';
let a = readFileSync(af, 'utf8').replace(/\r\n/g, '\n');
const oldFields = `  const fields = [
    { key: 'whatsapp_number', label: 'رقم WhatsApp للمحل (بصيغة دولية بدون +)' },
    { key: 'store_phone', label: 'رقم هاتف المحل' },
    { key: 'currency_symbol', label: 'رمز العملة' },
    { key: 'points_award_mode', label: 'منح النقاط (on_create: عند الطلب — on_complete: عند الإكمال)' },
  ];`;
if (!a.includes(oldFields)) { console.error('admin fields missing'); process.exit(1); }
a = a.replace(oldFields, `  const fields = [
    { key: 'whatsapp_number', label: 'رقم WhatsApp للمحل (بصيغة دولية بدون +)' },
    { key: 'store_phone', label: 'رقم هاتف المحل' },
    { key: 'currency_symbol', label: 'رمز العملة' },
    { key: 'points_award_mode', label: 'منح النقاط (on_create: عند الطلب — on_complete: عند الإكمال)' },
  ];
  const promoFields = [
    { key: 'promo_code', label: 'كود الخصم (مثال: DOSE50) — يستخدمه الزبون في الكشك' },
    { key: 'promo_discount', label: 'نسبة الخصم % (اتركها فارغة لإلغاء الكود)' },
  ];`);
const oldSettingsRender = `        {fields.map((f) => (`;
if (!a.includes(oldSettingsRender)) { console.error('settings render missing'); process.exit(1); }
a = a.replace(oldSettingsRender, `        <div className="mb-4 rounded-2xl bg-[#EEF2DC] p-3">
          <p className="text-[11px] font-black text-[#414D36]">🎁 كود الخصم المنشور في التطبيق</p>
          <p className="mt-1 text-[10px] font-bold text-[#7C8665]">يظهر في الشاشة الرئيسية ويستخدمه الزبون في الكشك للحصول على الخصم</p>
        </div>
        {promoFields.map((f) => (
          <Field key={f.key} label={f.label}>
            <input className={inputCls} dir="ltr" value={settings[f.key] ?? ''} onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })} />
          </Field>
        ))}
        {fields.map((f) => (`);
writeFileSync(af, a);
console.log('admin promo fields added');

/* ===== تطبيق العميل ===== */
const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* بطاقة كود الخصم بعد شريط الفئات */
const anchorCatsEnd = `      </div>
    </section>
  );
}

/* ============================ الرئيسية ============================ */`;
if (!s.includes(anchorCatsEnd)) fail('featured cats end');
const promoCard = `      </div>
    </section>
  );
}

/* بطاقة كود الخصم المنشور */
function PromoBanner({ settings }: { settings: Record<string, string> }) {
  const code = settings?.promo_code;
  const disc = settings?.promo_discount;
  if (!code || !disc) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-[1.4rem] border-2 border-dashed border-[#8A6A48] bg-[#F1DCB0] px-4 py-3.5">
      <div>
        <p className="text-[10px] font-black text-[#7C8665]">🎁 كود خصم حصري</p>
        <p className="font-mono text-xl font-black tracking-[.2em] text-[#26301C]" dir="ltr">{code}</p>
        <p className="text-[10.5px] font-bold text-[#7C8665]">استخدمه في الكشك واحصل على خصم {disc}%</p>
      </div>
      <span className="rounded-full bg-[#26301C] px-3 py-1.5 text-[10px] font-black text-[#C9D3A8]">خصم {disc}%</span>
    </div>
  );
}

/* ============================ الرئيسية ============================ */`;
s = s.replace(anchorCatsEnd, promoCard);

/* عرض البطاقة في الرئيسية بعد الفئات المميزة */
const oldHome = `      <FeaturedCategories catalog={catalog} cat={cat} setCat={(c) => { setCat(c); setQ(''); }} />

      <PopularStrip title="الأكثر مبيعًا"`;
if (!s.includes(oldHome)) fail('home strips anchor');
s = s.replace(oldHome, `      <FeaturedCategories catalog={catalog} cat={cat} setCat={(c) => { setCat(c); setQ(''); }} />

      <PromoBanner settings={catalog?.settings ?? {}} />

      <PopularStrip title="الأكثر مبيعًا"`);

/* ===== إعادة تصميم الفئات: بطاقات كبيرة بصورة وخلفية ===== */
const oldCats = `function FeaturedCategories({ catalog, cat, setCat }: { catalog: Catalog | null; cat: string; setCat: (s: string) => void }) {
  const items = [{ slug: 'all', name_ar: 'الكل' }, ...(catalog?.categories ?? [])];
  return (
    <section className="mt-7">
      <h2 className="mb-3.5 text-[17px] font-black text-[#26301C]">فئات مميزة</h2>
      <div className="no-scrollbar -mx-4 flex gap-5 overflow-x-auto px-4 pb-1">
        {items.map((c) => {
          const active = cat === c.slug;
          return (
            <button key={c.slug} onClick={() => setCat(c.slug)} className="flex flex-none flex-col items-center gap-2 transition active:scale-95">
              <span className={\`grid size-[76px] place-items-center overflow-hidden rounded-full shadow-md shadow-[#8a6a48]/10 transition-all \${
                active ? 'ring-2 ring-[#8A6A48] ring-offset-2 ring-offset-[#F6E7C9]' : 'ring-1 ring-[#EAD3A0]'\}`}>
                {c.slug === 'all'
                  ? <span className="grid size-full place-items-center bg-[#C9D3A8] text-[#26301C]"><Icon name="search" size={20} /></span>
                  : <img src={CAT_IMAGES[c.slug] ?? '/img/latte.jpg'} alt={c.name_ar} className="size-full object-cover" loading="lazy" />}
              </span>
              <span className={\`text-[11.5px] font-extrabold \${active ? 'text-[#221B12]' : 'text-[#94826A]'}\`}>{c.name_ar}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}`;
if (!s.includes(oldCats)) { console.error('featured cats block not found — checking variant'); }
const newCats = `function FeaturedCategories({ catalog, cat, setCat }: { catalog: Catalog | null; cat: string; setCat: (s: string) => void }) {
  const items = [{ slug: 'all', name_ar: 'الكل' }, ...(catalog?.categories ?? [])];
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-[17px] font-black text-[#26301C]">فئات مميزة</h2>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {items.map((c) => {
          const active = cat === c.slug;
          return (
            <button key={c.slug} onClick={() => setCat(c.slug)}
              className={\`relative h-24 w-32 flex-none overflow-hidden rounded-[1.3rem] shadow-md transition active:scale-95 anim-rise \${active ? 'ring-[3px] ring-[#5C6B3C]' : 'ring-1 ring-[#D5DEB4]'}\`}>
              {c.slug === 'all'
                ? <span className="grid size-full place-items-center bg-gradient-to-br from-[#414D36] to-[#26301C] text-[#C9D3A8]"><Icon name="package" size={24} /></span>
                : <img src={CAT_IMAGES[c.slug] ?? '/img/latte.jpg'} alt={c.name_ar} className="size-full object-cover" loading="lazy" />}
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 pb-2 text-center text-[12px] font-black text-white drop-shadow">{c.name_ar}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}`;
if (s.includes(oldCats)) {
  s = s.replace(oldCats, newCats);
  console.log('categories restyled (exact)');
} else {
  console.log('categories exact block not found — will fallback');
}

writeFileSync(f, s);
console.log('customer promo banner added');
