import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/admin/AdminApp.tsx';
let t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING: ' + m); process.exit(1); };

// 1) التبويب — بعد الرئيسية مباشرة
const tabOld = `  { id: 'dashboard', label: 'الرئيسية', icon: 'chart' },`;
if (!t.includes(tabOld)) fail('tab anchor');
t = t.replace(tabOld, tabOld + `\n  { id: 'sales', label: 'المبيعات', icon: 'coins' },`);

// أيقونة coins غير موجودة — تحقق من الأيقونات المتاحة: نستخدم 'chart' للرئيسية… 'coins' غير معرّفة. سنستخدم 'star'? الأفضل تعريفها لاحقًا؛ هنا نستخدم 'chart' مع تسمية مختلفة.
t = t.replace(`  { id: 'sales', label: 'المبيعات', icon: 'coins' },`, `  { id: 'sales', label: 'المبيعات', icon: 'store' },`);

// 2) TabId
const tidOld = `type TabId = 'dashboard' | 'sales' | 'orders' | 'products' | 'customers' | 'rewards' | 'ads' | 'notify' | 'hours' | 'location' | 'settings' | 'promo';`;
if (t.includes(tidOld)) { /* مضاف مسبقًا */ } else {
  const tid2 = `type TabId = 'dashboard' | 'orders' | 'products' | 'customers' | 'rewards' | 'ads' | 'notify' | 'hours' | 'location' | 'settings' | 'promo';`;
  if (!t.includes(tid2)) fail('tabid anchor');
  t = t.replace(tid2, `type TabId = 'dashboard' | 'sales' | 'orders' | 'products' | 'customers' | 'rewards' | 'ads' | 'notify' | 'hours' | 'location' | 'settings' | 'promo';`);
}

// 3) الرندر
const rendOld = `        {tab === 'orders' && <OrdersTab token={token} />}`;
if (!t.includes(rendOld)) fail('render anchor');
t = t.replace(rendOld, `        {tab === 'sales' && <SalesTab token={token} />}\n` + rendOld);

// 4) المكوّن — قبل تبويب المنتجات
const before = `/* ============================ المنتجات ============================ */`;
if (!t.includes(before)) {
  // ربما التعليق مختلف — ابحث عن function ProductsTab
  const i = t.indexOf('function ProductsTab');
  if (i < 0) fail('products fn');
  const comp = salesTabComponent();
  t = t.slice(0, i) + comp + t.slice(i);
} else {
  t = t.replace(before, salesTabComponent() + before);
}

function salesTabComponent() {
  return `/* ============================ المبيعات ============================ */
function SalesTab({ token }: { token: string }) {
  const [data, setData] = useState<any>(null);
  const load = useCallback(() => { arpc<any>('admin_sales_summary', { p_token: token }).then(setData).catch(() => {}); }, [token]);
  useEffect(() => { load(); }, [load]);
  const fmt = (v: any) => Number(v?.total ?? 0).toLocaleString('en-US') + ' ل.س';
  const cards = [
    { label: 'مبيعات اليوم', emoji: '📅', d: data?.today, grad: 'from-[#414D36] to-[#26301C]' },
    { label: 'آخر 7 أيام', emoji: '🗓️', d: data?.week, grad: 'from-[#5C6B3C] to-[#414D36]' },
    { label: 'هذا الشهر', emoji: '📆', d: data?.month, grad: 'from-[#7A5A22] to-[#5C4318]' },
  ];
  const daily = (data?.daily ?? []) as { day: string; total_cents: number; orders_count: number }[];
  const max = Math.max(1, ...daily.map((d) => d.total_cents));
  return (
    <div className="space-y-4">
      <h2 className="text-base font-extrabold text-coffee-900">المبيعات</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className={\`rounded-3xl bg-gradient-to-bl \${c.grad} p-5 text-white shadow-lg shadow-[#26301C]/25\`}>
            <p className="flex items-center gap-2 text-[11px] font-black text-[#C9D3A8]"><span>{c.emoji}</span> {c.label}</p>
            <p className="mt-2 text-3xl font-black tracking-tight">{fmt(c.d)}</p>
            <p className="mt-1 text-[11px] font-bold text-white/70">{Number(c.d?.count ?? 0).toLocaleString('en-US')} طلب مكتمل</p>
          </div>
        ))}
      </div>
      <Card className="p-5">
        <p className="mb-4 text-xs font-extrabold text-coffee-900">مبيعات آخر 14 يومًا</p>
        {daily.length === 0 ? (
          <p className="py-8 text-center text-xs font-bold text-neutral-400">لا توجد مبيعات مسجلة بعد</p>
        ) : (
          <div className="flex items-end gap-1.5 overflow-x-auto pb-1" dir="ltr">
            {daily.map((d) => (
              <div key={d.day} className="flex min-w-[34px] flex-1 flex-col items-center gap-1.5">
                <span className="text-[8.5px] font-black text-neutral-500">{d.total_cents > 0 ? (d.total_cents / 1000).toLocaleString('en-US') + 'k' : ''}</span>
                <div className="w-full rounded-t-lg bg-gradient-to-t from-[#5C6B3C] to-[#A9B87F] transition-all"
                  style={{ height: \`\${d.total_cents > 0 ? 10 + Math.round((d.total_cents / max) * 90) : 3}px\` }} />
                <span className="text-[8px] font-bold text-neutral-400">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <p className="rounded-xl bg-[#EEF2DC] px-3 py-2 text-[10.5px] font-bold leading-relaxed text-[#77825E]">
        الطلبات المكتملة تُحذف تلقائيًا بعد يوم من تسليمها للزبون — لكن مبالغها تبقى محسوبة هنا بشكل دائم. إذا أُلغي طلب مكتمل لاحقًا يُخصم من مبيعات يومه.
      </p>
    </div>
  );
}

`;
}

writeFileSync(f, t);
console.log('SalesTab added');
