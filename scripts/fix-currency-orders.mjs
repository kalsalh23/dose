import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/customer/CustomerApp.tsx';
let t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING: ' + m); process.exit(1); };

// تمرير العملة إلى واجهة الطلبات
const routeOld = `          <Route path="/orders" element={<OrdersPage myData={myData} session={session} />} />`;
if (!t.includes(routeOld)) fail('orders route');
t = t.replace(routeOld, `          <Route path="/orders" element={<OrdersPage myData={myData} session={session} catalog={catalog} />} />`);
const sigOld = `function OrdersPage({ myData, session }: { myData: MyData | null; session: Session | null }) {
  if (!session) return <NeedLogin />;
  const orders = myData?.orders ?? [];`;
if (!t.includes(sigOld)) fail('orders sig');
t = t.replace(sigOld, `function OrdersPage({ myData, session, catalog }: { myData: MyData | null; session: Session | null; catalog?: Catalog | null }) {
  if (!session) return <NeedLogin />;
  const orders = myData?.orders ?? [];
  const cur = catalog?.settings?.currency_symbol ?? 'ل.س';`);
t = t.replace(`} — {eur(it.unit_price_cents)}</p>`, `} — {eur(it.unit_price_cents, cur)}</p>`);
t = t.replace(`className="font-black text-[#26301C]">{eur(o.total_cents)}</span>`, `className="font-black text-[#26301C]">{eur(o.total_cents, cur)}</span>`);
writeFileSync(f, t);
console.log('orders currency fixed');
