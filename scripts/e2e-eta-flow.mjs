// اختبار تدفق ETA الكامل: عامل يضبط الحالة ثم يحفظ الوقت
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
  if (r.status !== 200 && r.status !== 201) throw new Error(`${r.status} ${t.slice(0, 300)}`);
  return JSON.parse(t);
};

const K = readFileSync(join(here, '..', 'src', 'lib', 'supabase.ts'), 'utf8').match(/'eyJ[A-Za-z0-9_.\-]+'/)[0].slice(1, -1);
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const j = async (f, b) => JSON.parse((await fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/' + f, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(r => r.text())));

const PHONE = '0999666555';
let workerTok = null;
try {
  const ws = await dbq("insert into admin_sessions (admin_id, token) values ((select id from admin_users where username='worker'), gen_random_uuid()) returning token");
  workerTok = ws[0].token;

  await j('create_customer', { p_full_name: 'اختبار ETA2', p_phone: PHONE, p_device_id: 'eta3' });
  const login = await j('customer_login', { p_phone: PHONE, p_pin: null });
  const orderId = (await j('create_order', {
    p_customer_id: login.customer.id, p_pin: null, p_confirm_phone: PHONE, p_fulfillment_type: 'delivery',
    p_items: [{ product_id: 279, qty: 1 }], p_source: 'customer', p_latitude: 33.51, p_longitude: 36.29,
  })).order_id;

  // العامل يحول إلى قيد التحضير (بدون وقت)
  const s1 = await j('admin_set_order_status', { p_token: workerTok, p_order_id: orderId, p_status: 'preparing' });
  console.log('1) preparing (no eta):', JSON.stringify(s1));

  // العامل يحفظ 25 دقيقة
  const s2 = await j('admin_set_order_eta', { p_token: workerTok, p_order_id: orderId, p_eta_minutes: 25 });
  console.log('2) eta saved:', JSON.stringify(s2));

  // العميل يرى الوقت في الطلب
  const md = await j('get_my_data', { p_token: login.token });
  const mine = md.orders.find((o) => o.id === orderId);
  console.log('3) customer order eta:', mine?.estimated_delivery_at, '| status:', mine?.status);

  // ثم جاري التوصيل
  const s3 = await j('admin_set_order_status', { p_token: workerTok, p_order_id: orderId, p_status: 'out_for_delivery' });
  console.log('4) out_for_delivery:', JSON.stringify(s3));

  // ثم مكتمل
  const s4 = await j('admin_set_order_status', { p_token: workerTok, p_order_id: orderId, p_status: 'ready' });
  console.log('5) ready(مكتمل):', JSON.stringify(s4));
} catch (e) {
  console.error('TEST ERROR:', e.message);
} finally {
  await dbq("delete from order_items where order_id in (select id from orders where customer_id = (select id from customers where phone='" + PHONE + "')); delete from orders where customer_id = (select id from customers where phone='" + PHONE + "'); delete from points_transactions where customer_id = (select id from customers where phone='" + PHONE + "'); delete from notifications where customer_id = (select id from customers where phone='" + PHONE + "'); delete from customer_sessions where customer_id = (select id from customers where phone='" + PHONE + "'); delete from customers where phone='" + PHONE + "'; delete from admin_sessions where token='" + workerTok + "';");
  console.log('cleanup done');
  readdirSync(here).filter((x) => x.startsWith('.sbt') && x !== '.sbtok').forEach((x) => unlinkSync(join(here, x)));
}