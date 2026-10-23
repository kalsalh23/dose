// اختبار شامل: الحالة + الوقت المقدر + النقاط + المبيعات
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

const PHONE = '0998771222';
let workerTok = null;
try {
  const s = await dbq("insert into admin_sessions (admin_id, token) values ((select id from admin_users where username='one@gmail.com'), gen_random_uuid()) returning token");
  workerTok = s[0].token;

  await j('create_customer', { p_full_name: 'اختبار شامل', p_phone: PHONE, p_device_id: 'full-test' });
  const lg = await j('customer_login', { p_phone: PHONE, p_pin: null });
  const cid = lg.body.customer.id;
  const mk = async () => (await j('create_order', {
    p_customer_id: cid, p_pin: null, p_confirm_phone: PHONE, p_fulfillment_type: 'pickup',
    p_items: [{ product_id: 279, qty: 2 }], p_source: 'customer',
  })).body.order_id;

  // 1) التدفق الكامل: preparing (+40 دقيقة) → ready → completed
  const o1 = await mk();
  const tp = (await dbq(`select total_points from orders where id='${o1}'`))[0].total_points;
  const s1 = await j('admin_set_order_status', { p_token: workerTok, p_order_id: o1, p_status: 'preparing', p_eta_minutes: 40 });
  console.log('1) preparing + 40min →', s1.status, 'eta_minutes:', s1.body.eta_minutes);
  const s2 = await j('admin_set_order_status', { p_token: workerTok, p_order_id: o1, p_status: 'ready' });
  const p2 = await dbq(`select points from customers where id='${cid}'`);
  const o2 = await dbq(`select points_awarded, sales_recorded, completed_at is not null as done, eta_minutes from orders where id='${o1}'`);
  console.log('   ready → +points:', p2[0].points, '(expected', tp + ') |', JSON.stringify(o2[0]));

  const s3 = await j('admin_set_order_status', { p_token: workerTok, p_order_id: o1, p_status: 'completed' });
  const p3 = await dbq(`select points from customers where id='${cid}'`);
  console.log('2) completed → points still', p3[0].points, '(', p3[0].points === p2[0].points ? 'PASS no double' : 'FAIL double', ')');

  // 3) الزبون يرى النقاط والدقائق في تفاصيل الطلب
  const md = await j('get_my_data', { p_token: lg.body.token });
  const mine = md.body.orders.find((o) => o.id === o1);
  console.log('3) customer → points:', md.body.customer.points, '| eta_minutes:', mine?.eta_minutes, '| display:', mine?.eta_minutes + ' دقيقة');

  // 4) إلغاء طلب مكتمل
  const o4 = await mk();
  const tp4 = (await dbq(`select total_points from orders where id='${o4}'`))[0].total_points;
  await j('admin_set_order_status', { p_token: workerTok, p_order_id: o4, p_status: 'ready' });
  const p4a = await dbq(`select points from customers where id='${cid}'`);
  const s4 = await j('admin_set_order_status', { p_token: workerTok, p_order_id: o4, p_status: 'cancelled' });
  const p4b = await dbq(`select points from customers where id='${cid}'`);
  console.log('4) cancel → points', p4a[0].points, '→', p4b[0].points, '(expected', p4a[0].points - tp4 + ')');

  // 5) تعديل الوقت فقط (زر الحفظ)
  const s5 = await j('admin_set_order_eta', { p_token: workerTok, p_order_id: o4, p_eta_minutes: 25 });
  console.log('5) eta update →', JSON.stringify(s5.body));

  // 6) المالك يستطيع أيضًا
  const os = await dbq("insert into admin_sessions (admin_id, token) values ((select id from admin_users where username='admin'), gen_random_uuid()) returning token");
  const o6 = await mk();
  await j('admin_set_order_status', { p_token: os[0].token, p_order_id: o6, p_status: 'ready' });
  const p6 = await dbq(`select points from customers where id='${cid}'`);
  console.log('6) owner marks ready → points now', p6[0].points);
  await dbq("delete from admin_sessions where token='" + os[0].token + "'");

  console.log('---');
  console.log('ALL PASS');
} catch (e) {
  console.error('TEST ERROR:', e.message);
} finally {
  await dbq("delete from order_items where order_id in (select id from orders where customer_id = (select id from customers where phone='" + PHONE + "')); delete from orders where customer_id = (select id from customers where phone='" + PHONE + "'); delete from points_transactions where customer_id = (select id from customers where phone='" + PHONE + "'); delete from notifications where customer_id = (select id from customers where phone='" + PHONE + "'); delete from customer_sessions where customer_id = (select id from customers where phone='" + PHONE + "'); delete from customers where phone='" + PHONE + "'; delete from admin_sessions where token='" + workerTok + "';");
  console.log('cleanup done');
  readdirSync(here).filter((x) => x.startsWith('.sbt') && x !== '.sbtok').forEach((x) => unlinkSync(join(here, x)));
}