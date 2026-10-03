import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/admin/AdminApp.tsx';
let t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING: ' + m); process.exit(1); };

/* ===== 1) إزالة واجهة موقعي ===== */
const locTab = `  { id: 'location', label: 'موقعي', icon: 'pin' },\n`;
if (!t.includes(locTab)) fail('location tab entry');
t = t.replace(locTab, '');
t = t.replace(` | 'location'`, '');
t = t.replace(`        {tab === 'location' && <LocationTab token={token} />}\n`, '');
const locStart = t.indexOf('/* ============================ موقعي — موقع المحل وإشعار الاقتراب ============================ */');
const locEnd = t.indexOf('/* ============================ الإعدادات ============================ */');
if (locStart < 0 || locEnd < 0 || locEnd < locStart) fail('location component bounds');
t = t.slice(0, locStart) + t.slice(locEnd);
t = t.replace(`import { eur, fmtDateTime, shopStatus, getCurrentLocation } from '../lib/utils';`,
  `import { eur, fmtDateTimeNum, shopStatus } from '../lib/utils';`);

/* ===== 2) تبويب الإضافات ===== */
const prodTab = `  { id: 'products', label: 'المنتجات', icon: 'package' },`;
if (!t.includes(prodTab)) fail('products tab');
t = t.replace(prodTab, prodTab + `\n  { id: 'extras', label: 'إضافات', icon: 'plus' },`);
t = t.replace(`type TabId = 'dashboard' | 'sales' | 'orders'`, `type TabId = 'dashboard' | 'sales' | 'extras' | 'orders'`);
const rendProd = `        {tab === 'products' && <ProductsTab token={token} />}`;
if (!t.includes(rendProd)) fail('products render');
t = t.replace(rendProd, rendProd + `\n        {tab === 'extras' && <ExtrasTab token={token} />}`);

/* ===== 3) الطلبات: قائمة الرد الجديدة + التاريخ الرقمي + الوقت التقديري ===== */
t = t.replace(`const STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];`,
  `const STATUSES = ['pending', 'preparing', 'ready', 'out_for_delivery', 'completed'];`);
t = t.replace(`const statusLabel = (s: string) => ({ pending: 'قيد المراجعة', confirmed: 'مؤكد', preparing: 'قيد التحضير', ready: 'جاهز', completed: 'مكتمل', cancelled: 'ملغي' } as any)[s] ?? s;`,
  `const statusLabel = (s: string) => ({ pending: 'قيد المراجعة', confirmed: 'مؤكد', preparing: 'قيد التحضير', ready: 'جاهز', out_for_delivery: 'جاري التوصيل', completed: 'تم التسليم', cancelled: 'ملغي' } as any)[s] ?? s;`);
t = t.replace(`const statusChip = (s: string) => ({ pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-blue-100 text-blue-800', preparing: 'bg-orange-100 text-orange-800', ready: 'bg-emerald-100 text-emerald-800', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' } as any)[s] ?? 'bg-neutral-100';`,
  `const statusChip = (s: string) => ({ pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-blue-100 text-blue-800', preparing: 'bg-orange-100 text-orange-800', ready: 'bg-emerald-100 text-emerald-800', out_for_delivery: 'bg-indigo-100 text-indigo-800', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' } as any)[s] ?? 'bg-neutral-100';`);
const etaAnchor = `{o.points_awarded && <span className="ms-1 rounded-full bg-green-50 px-2 py-1 text-[10px] font-extrabold text-green-700">⭐ منحت</span>}`;
if (!t.includes(etaAnchor)) fail('eta anchor');
t = t.replace(etaAnchor, etaAnchor + `
              {['pending', 'preparing', 'ready', 'out_for_delivery'].includes(o.status) && (
                <span className="ms-1 rounded-full bg-[#EEF2DC] px-2 py-1 text-[10px] font-extrabold text-[#5C6B3C]">⏱️ {o.fulfillment_type === 'delivery' ? 'يوصل خلال 15-20 دقيقة' : 'جاهز خلال 5-10 دقائق'}</span>
              )}`);
t = t.replace(`<span className="text-[11px] font-bold text-neutral-400">{fmtDateTime(o.created_at)} · {o.source === 'kiosk' ? 'كشك المحل' : o.source === 'customer' ? 'تطبيق العميل' : 'إداري'}</span>`,
  `<span className="text-[11px] font-bold text-neutral-400">{fmtDateTimeNum(o.created_at)} · {o.source === 'kiosk' ? 'كشك المحل' : o.source === 'customer' ? 'تطبيق العميل' : 'إداري'}</span>`);

/* ===== 4) المكافآت: زر حذف نهائي فقط ===== */
const rwOld = `            <div className="mt-2 flex gap-2">
              <button onClick={() => setEdit({ ...EMPTY_REWARD, ...r })} className="rounded-lg bg-[#E3E9C8] px-3 py-1.5 text-[11px] font-extrabold text-neutral-700">تعديل</button>
              {r.is_active && <button disabled={busy} onClick={() => wrap(async () => { await arpc('admin_delete_reward', { p_token: token, p_id: r.id }); load(); })}
                className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-extrabold text-red-600">تعطيل</button>}
            </div>`;
if (!t.includes(rwOld)) fail('reward buttons');
t = t.replace(rwOld, `            <div className="mt-2 flex gap-2">
              <button disabled={busy} onClick={() => wrap(async () => {
                if (!window.confirm('حذف نهائي للمكافأة «' + r.name_ar + '»؟ أكواد الزبائن القديمة تبقى صالحة.')) return;
                await arpc('admin_delete_reward', { p_token: token, p_id: r.id });
                load();
              })} className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-extrabold text-red-600">🗑️ حذف نهائي</button>
            </div>`);

/* ===== 5) الإعلانات: منبثق فقط + تسميات ===== */
t = t.replace(`<option value="both">إعلان وسط الشاشة + الهيرو</option>`, `<option value="both">إعلان منبثق بعد دقيقتين (بدون الهيرو)</option>`);
t = t.replace(`{a.full_screen ? 'إعلان وسط الشاشة' : 'ضمن الهيرو'}`, `{a.full_screen ? 'إعلان منبثق' : 'ضمن الهيرو'}`);
t = t.replace(`🖥️ إعلان وسط الشاشة — يظهر بعد دقيقتين من التصفح`, `🖥️ إعلان منبثق — يظهر بعد دقيقتين من التصفح`);
t = t.replace(`<option value="hero">ضمن الهيرو فقط</option>`, `<option value="hero">ضمن الهيرو فقط (بدون منبثق)</option>`);

/* ===== 6) مكوّن الإضافات ===== */
const beforeFn = `function RewardsTab({ token }: { token: string }) {`;
if (!t.includes(beforeFn)) fail('rewards fn anchor');
const comp = `/* ============================ الإضافات المدفوعة ============================ */
function ExtrasTab({ token }: { token: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const load = useCallback(() => {
    arpc<any[]>('admin_list_additions', { p_token: token }).then(setItems).catch(() => {});
    sb.rpc('get_catalog').then(({ data }: any) => setProducts(data?.products ?? [])).catch(() => {});
  }, [token]);
  useEffect(() => { load(); }, [load]);
  const { busy, wrap } = useAdminAction();
  const pName = (id: number) => products.find((p) => p.id === id)?.name_ar ?? ('#' + id);
  const toggle = (pid: number) => setEdit((e: any) => {
    const ids: number[] = e.product_ids ?? [];
    return { ...e, product_ids: ids.includes(pid) ? ids.filter((x) => x !== pid) : [...ids, pid] };
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-coffee-900">الإضافات ({items.length})</h2>
        <button onClick={() => setEdit({ id: 0, name_ar: '', price_cents: '', is_active: true, product_ids: [] })} className={btnCls}>+ إضافة جديدة</button>
      </div>
      <p className="text-[11px] font-bold text-neutral-500">الإضافة اختيارية يختارها الزبون مع المنتج وتُضاف قيمتها على سعر المنتج تلقائيًا</p>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((a) => (
          <Card key={a.id} className={a.is_active ? '' : 'opacity-50'}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-extrabold text-coffee-900">{a.name_ar}</p>
              <p className="text-xs font-extrabold text-gold-deep">+ {eur(a.price_cents, 'ل.س')}</p>
            </div>
            <p className="mt-1 text-[10.5px] font-bold text-neutral-400">
              {(a.product_ids ?? []).length === 0 ? 'غير مرتبطة بمنتجات بعد' : 'ترتبط بـ ' + a.product_ids.length + ' منتج: ' + (a.product_ids ?? []).map(pName).slice(0, 4).join('، ') + ((a.product_ids ?? []).length > 4 ? '…' : '')}
            </p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => setEdit({ ...a })} className="rounded-lg bg-[#E3E9C8] px-3 py-1.5 text-[11px] font-extrabold text-neutral-700">تعديل</button>
              <button disabled={busy} onClick={() => wrap(async () => {
                if (!window.confirm('حذف الإضافة «' + a.name_ar + '» نهائيًا؟')) return;
                await arpc('admin_delete_addition', { p_token: token, p_addition_id: a.id });
                load();
              })} className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-extrabold text-red-600">حذف</button>
            </div>
          </Card>
        ))}
        {items.length === 0 && <p className="rounded-2xl bg-[#F6F0E2] p-6 text-center text-xs font-bold text-neutral-400">لا توجد إضافات بعد</p>}
      </div>

      {edit && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4 backdrop-blur-sm anim-fade">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl anim-pop">
            <h3 className="text-base font-extrabold text-coffee-900">{edit.id ? 'تعديل إضافة' : 'إضافة جديدة'}</h3>
            <div className="mt-4 space-y-3">
              <Field label="اسم الإضافة"><input className={inputCls} value={edit.name_ar} onChange={(e) => setEdit({ ...edit, name_ar: e.target.value })} placeholder="مثال: شوت إسبريسو زيادة" /></Field>
              <Field label="سعر الإضافة (ل.س)"><input type="number" className={inputCls} value={edit.price_cents} onChange={(e) => setEdit({ ...edit, price_cents: e.target.value })} placeholder="3000" /></Field>
              <Field label="المنتجات التي تُعرض معها (اختيار متعدد)">
                <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-xl border-2 border-beige p-2">
                  {products.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-neutral-700 hover:bg-[#F6F0E2]">
                      <input type="checkbox" checked={(edit.product_ids ?? []).includes(p.id)} onChange={() => toggle(p.id)} />
                      {p.name_ar}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="نشط">
                <select className={inputCls} value={String(edit.is_active)} onChange={(e) => setEdit({ ...edit, is_active: e.target.value === 'true' })}>
                  <option value="true">نعم</option><option value="false">لا</option>
                </select>
              </Field>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button disabled={busy || !edit.name_ar?.trim()} onClick={() => wrap(async () => {
                await arpc('admin_save_addition', { p_token: token, p_addition: { ...edit, price_cents: Number(edit.price_cents) || 0 } });
                setEdit(null); load();
              })} className="rounded-2xl bg-gradient-to-l from-gold to-gold-deep py-3 text-sm font-extrabold text-white disabled:opacity-50">حفظ</button>
              <button onClick={() => setEdit(null)} className="rounded-2xl bg-neutral-100 py-3 text-sm font-extrabold text-neutral-600">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

`;
t = t.replace(beforeFn, comp + beforeFn);

writeFileSync(f, t);
console.log('admin batch8 patched');
