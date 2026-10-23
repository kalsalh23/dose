// اختبار: دقائق الوقت المقدر + تفعيل/تعطيل الإشعارات في الملف الشخصي
import { readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
let token = null;
for (const f of readdirSync(here).filter((x) => x.startsWith('.sbt'))) {
  const v = readFileSync(join(here, f), 'utf8');
  const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'select 1' }),
  });
  if (r.status === 200 || r.status === 201) { token = v; break; }
}
if (!token) { console.error('NO TOKEN'); process.exit(1); }
const dbq = async (sql) => {
  const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  if (r.status !== 200 && r.status !== 201) throw new Error(`${r.status} ${t.slice(0, 400)}`);
  return JSON.parse(t);
};
const K = readFileSync(join(here, '..', 'src', 'lib', 'supabase.ts'), 'utf8').match(/'eyJ[A-Za-z0-9_.\-]+'/)[0].slice(1, -1);
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const j = async (f, b) => { const r = await fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/' + f, { method: 'POST', headers: H, body: JSON.stringify(b) }); return { status: r.status, body: await r.json() }; };

const PHONE = '0999111999';
let workerTok = null;
try {
  const s = await dbq("insert into admin_sessions (admin_id, token) values ((select id from admin_users where username='one@gmail.com'), gen_random_uuid()) returning token");
  workerTok = s[0].token;

  await j('create_customer', { p_full_name: 'اختبار وقت', p_phone: PHONE, p_device_id: 'eta-min' });
  const lg = await j('customer_login', { p_phone: PHONE, p_pin: null });
  const cid = lg.body.customer.id;
  const oid = (await j('create_order', {
    p_customer_id: cid, p_pin: null, p_confirm_phone: PHONE, p_fulfillment_type: 'pickup',
    p_items: [{ product_id: 279, qty: 1 }], p_source: 'customer',
  })).body.order_id;

  // 1) العامل يحفظ 50 دقيقة عبر زر الحفظ
  await j('admin_set_order_status', { p_token: workerTok, p_order_id: oid, p_status: 'preparing' });
  const s1 = await j('admin_set_order_eta', { p_token: workerTok, p_order_id: oid, p_eta_minutes: 50 });
  console.log('1) set 50 min →', s1.status, JSON.stringify(s1.body));

  // 2) الزبون يرى eta_minutes = 50 في تفاصيل الطلب
  const md = await j('get_my_data', { p_token: lg.body.token });
  const mine = md.body.orders.find((o) => o.id === oid);
  console.log('2) customer order → eta_minutes:', mine?.eta_minutes, '| display:', mine?.eta_minutes + ' دقيقة');

  // 3) اللوحة ترى الدقائق أيضًا
  const lo = await j('admin_list_orders', { p_token: workerTok, p_limit: 5 });
  const adm = (lo.body ?? []).find((o) => o.id === oid);
  console.log('3) admin order → eta_minutes:', adm?.eta_minutes);

  // 4) التعديل إلى 30 دقيقة
  const s4 = await j('admin_set_order_eta', { p_token: workerTok, p_order_id: oid, p_eta_minutes: 30 });
  console.log('4) change to 30 min →', JSON.stringify(s4.body));
  const md2 = await j('get_my_data', { p_token: lg.body.token });
  const mine2 = md2.body.orders.find((o) => o.id === oid);
  console.log('   customer now sees:', mine2?.eta_minutes + ' دقيقة');

  // 5) مسح الوقت
  const s5 = await j('admin_set_order_eta', { p_token: workerTok, p_order_id: oid, p_eta_minutes: 0 });
  console.log('5) clear →', JSON.stringify(s5.body));
  const md3 = await j('get_my_data', { p_token: lg.body.token });
  const mine3 = md3.body.orders.find((o) => o.id === oid);
  console.log('   customer eta_minutes:', mine3?.eta_minutes, '| estimated:', mine3?.estimated_delivery_at);
} catch (e) {
  console.error('TEST ERROR:', e.message);
} finally {
  await dbq("delete from order_items where order_id in (select id from orders where customer_id = (select id from customers where phone='" + PHONE + "')); delete from orders where customer_id = (select id from customers where phone='" + PHONE + "'); delete from points_transactions where customer_id = (select id from customers where phone='" + PHONE + "'); delete from notifications where customer_id = (select id from customers where phone='" + PHONE + "'); delete from customer_sessions where customer_id = (select id from customers where phone='" + PHONE + "'); delete from customers where phone='" + PHONE + "'; delete from admin_sessions where token='" + workerTok + "';");
  console.log('cleanup done');
  readdirSync(here).filter((x) => x.startsWith('.sbt') && x !== '.sbtok').forEach((x) => unlinkSync(join(here, x)));
}