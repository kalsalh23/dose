// إعادة تصميم AdsTab: إعلان موجّه لفئة (بدون عنوان وأسعار) + قائمة الفئات
import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/admin/AdminApp.tsx';
let t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// EMPTY_AD الجديد
const emptyOld = `const EMPTY_AD = { id: 0, image_url: '/img/latte.jpg', title: '', description_ar: '', old_price_cents: '', new_price_cents: '', discount_percent: '', ends_at: '', is_active: true, full_screen: false, show_in_hero: true };`;
if (!t.includes(emptyOld)) { console.error('EMPTY_AD ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(emptyOld, `const EMPTY_AD = { id: 0, image_url: '/img/latte.jpg', category_slug: '', description_ar: '', ends_at: '', is_active: true, full_screen: false, show_in_hero: true };`);

// استبدال كامل للـ AdsTab
const start = t.indexOf('function AdsTab({ token }: { token: string }) {');
const end = t.indexOf('/* ============================ إشعار ============================ */');
if (start < 0 || end < 0 || end < start) { console.error('ADSTAB MARKS NOT FOUND'); process.exit(1); }

const NEW = `function AdsTab({ token }: { token: string }) {
  const [ads, setAds] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const load = useCallback(() => { arpc<any[]>('admin_list_ads', { p_token: token }).then(setAds).catch(() => {}); }, [token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { sb.rpc('get_catalog').then(({ data }: any) => setCats(data?.categories ?? [])).catch(() => {}); }, []);
  const { busy, wrap } = useAdminAction();
  const catName = (slug: string) => cats.find((c) => c.slug === slug)?.name_ar ?? slug;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-coffee-900">الإعلانات ({ads.length})</h2>
        <button onClick={() => setEdit({ ...EMPTY_AD })} className={btnCls}>+ إعلان جديد</button>
      </div>
      <p className="text-[11px] font-bold text-neutral-500">الإعلان موجّه لفئة كاملة من المنتجات — يظهر في الهيرو/وسط الشاشة، وعروض الأصناف الفردية تُحدَّد من زر «عرض» في تبويب المنتجات</p>
      <div className="grid gap-3 md:grid-cols-2">
        {ads.map((a) => (
          <Card key={a.id} className={a.is_active ? '' : 'opacity-50'}>
            <div className="flex gap-3">
              <img src={a.image_url} alt="" className="size-20 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-coffee-900">{a.title}
                  <span className={\`ms-2 rounded-full px-2 py-0.5 text-[9px] font-black \${a.full_screen ? 'bg-[#414D36] text-[#C9D3A8]' : 'bg-[#D5DEB4] text-[#414D36]'}\`}>
                    {a.full_screen ? 'إعلان وسط الشاشة' : 'ضمن الهيرو'}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">{a.description_ar}</p>
                <p className="mt-0.5 text-[10px] font-bold text-neutral-400">
                  {a.full_screen ? '🖥️ إعلان وسط الشاشة — يظهر بعد دقيقتين من التصفح' : '📱 يظهر ضمن الهيرو المتنقل'}
                  {a.ends_at ? ' · حتى ' + new Date(a.ends_at).toLocaleDateString('ar-SY', { day: 'numeric', month: 'short' }) : ' · بلا نهاية'}
                </p>
                {a.category_slug && (
                  <span className="mt-1 inline-block rounded-full bg-[#EEF2DC] px-2.5 py-1 text-[10px] font-black text-[#414D36]">🏷️ فئة: {catName(a.category_slug)}</span>
                )}
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => setEdit({ ...EMPTY_AD, ...a, ends_at: a.ends_at ? a.ends_at.slice(0, 16) : '' })} className="rounded-lg bg-[#E3E9C8] px-3 py-1.5 text-[11px] font-extrabold text-neutral-700">تعديل</button>
              <button disabled={busy} onClick={() => wrap(async () => { await arpc('admin_delete_ad', { p_token: token, p_id: a.id }); load(); })}
                className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-extrabold text-red-600">حذف</button>
            </div>
          </Card>
        ))}
      </div>

      {edit && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4 backdrop-blur-sm anim-fade">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl anim-pop">
            <h3 className="text-base font-extrabold text-coffee-900">{edit.id ? 'تعديل إعلان' : 'إعلان جديد'}</h3>
            <div className="mt-4 space-y-3">
              <Field label="فئة المنتجات المستهدفة — العنوان يُشتق منها تلقائيًا (مثال: عروض الموهيتو)">
                <select className={inputCls} value={edit.category_slug ?? ''} onChange={(e) => setEdit({ ...edit, category_slug: e.target.value })}>
                  <option value="">— اختر الفئة —</option>
                  {cats.map((c) => <option key={c.slug} value={c.slug}>{c.name_ar}</option>)}
                </select>
              </Field>
              <Field label="الوصف"><textarea className={\`\${inputCls} h-20 py-2\`} value={edit.description_ar} onChange={(e) => setEdit({ ...edit, description_ar: e.target.value })} placeholder="مثال: عرض حصري على أغلب أصناف الموهيتو" /></Field>
              <Field label="نهاية العرض (اختياري — يبدأ فور الحفظ)"><input type="datetime-local" className={inputCls} dir="ltr" value={edit.ends_at} onChange={(e) => setEdit({ ...edit, ends_at: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="نشط">
                  <select className={inputCls} value={String(edit.is_active)} onChange={(e) => setEdit({ ...edit, is_active: e.target.value === 'true' })}>
                    <option value="true">نعم</option><option value="false">لا</option>
                  </select>
                </Field>
                <Field label="مكان الظهور">
                  <select className={inputCls} value={edit.full_screen ? 'both' : 'hero'} onChange={(e) => setEdit({ ...edit, full_screen: e.target.value === 'both', show_in_hero: true })}>
                    <option value="hero">ضمن الهيرو فقط</option>
                    <option value="both">إعلان وسط الشاشة + الهيرو</option>
                  </select>
                </Field>
              </div>
              <Field label="صورة الإعلان"><ImageUploadField value={edit.image_url} onChange={(url) => setEdit({ ...edit, image_url: url })} folder="ads" /></Field>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button disabled={busy || !(edit.category_slug ?? '').trim()} onClick={() => wrap(async () => {
                const ad = { ...edit, ends_at: edit.ends_at ? new Date(edit.ends_at).toISOString() : '' };
                await arpc('admin_save_ad', { p_token: token, p_ad: ad });
                setEdit(null); load();
              })}
                className="rounded-2xl bg-gradient-to-l from-gold to-gold-deep py-3 text-sm font-extrabold text-white disabled:opacity-50">حفظ</button>
              <button onClick={() => setEdit(null)} className="rounded-2xl bg-neutral-100 py-3 text-sm font-extrabold text-neutral-600">إلغاء</button>
            </div>
            <p className="mt-3 rounded-xl bg-[#EEF2DC] px-3 py-2 text-[10.5px] font-bold leading-relaxed text-[#77825E]">
              لحسم أسعار أصناف محددة داخل الفئة (سعر مشطوب + شارة «عرض» للزبون) استخدم زر «عرض» في تبويب المنتجات.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

`;
t = t.slice(0, start) + NEW + t.slice(end);
writeFileSync(f, t);
console.log('AdsTab reworked for category ads');
