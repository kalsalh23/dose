// اختبار منح النقاط عند «مكتمل»
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

const PHONE = '0999555444';
let workerTok = null;
try {
  const s = await dbq("insert into admin_sessions (admin_id, token) values ((select id from admin_users where username='one@gmail.com'), gen_random_uuid()) returning token");
  workerTok = s[0].token;

  await j('create_customer', { p_full_name: 'اختبار نقاط', p_phone: PHONE, p_device_id: 'pts-test' });
  const lg = await j('customer_login', { p_phone: PHONE, p_pin: null });
  const cid = lg.body.customer.id;
  const ptsBefore = lg.body.customer.points;

  const mkOrder = async () => (await j('create_order', {
    p_customer_id: cid, p_pin: null, p_confirm_phone: PHONE, p_fulfillment_type: 'pickup',
    p_items: [{ product_id: 279, qty: 1 }], p_source: 'customer',
  })).body.order_id;

  // 1) قيد التحضير ← مكتمل: النقاط تُمنح
  const o1 = await mkOrder();
  const tp = await dbq(`select total_points from orders where id='${o1}'`);
  const expectedPts = tp[0].total_points;
  await j('admin_set_order_status', { p_token: workerTok, p_order_id: o1, p_status: 'preparing' });
  const s1 = await j('admin_set_order_status', { p_token: workerTok, p_order_id: o1, p_status: 'ready' });
  const after1 = await dbq(`select points from customers where id='${cid}'`);
  const ord1 = await dbq(`select status, points_awarded, sales_recorded, completed_at is not null as has_completed from orders where id='${o1}'`);
  console.log('1) ready →', s1.status, JSON.stringify(s1.body));
  console.log('   points:', ptsBefore, '→', after1[0].points, '(+' + (after1[0].points - ptsBefore) + ', expected +' + expectedPts + ') |', JSON.stringify(ord1[0]));

  // 2) نفس الطلب → تم التسليم: لا تُمنح مرتين
  await j('admin_set_order_status', { p_token: workerTok, p_order_id: o1, p_status: 'completed' });
  const after2 = await dbq(`select points from customers where id='${cid}'`);
  console.log('2) completed → points still', after2[0].points, '(no double award:', after2[0].points === after1[0].points ? 'PASS' : 'FAIL', ')');

  // 3) إلغاء طلب مكتمل: خصم النقاط
  const o3 = await mkOrder();
  const tp3 = await dbq(`select total_points from orders where id='${o3}'`);
  await j('admin_set_order_status', { p_token: workerTok, p_order_id: o3, p_status: 'ready' });
  const after3a = await dbq(`select points from customers where id='${cid}'`);
  const s3 = await j('admin_set_order_status', { p_token: workerTok, p_order_id: o3, p_status: 'cancelled' });
  const after3b = await dbq(`select points from customers where id='${cid}'`);
  const ord3 = await dbq(`select status, points_awarded, sales_recorded from orders where id='${o3}'`);
  console.log('3) cancel → points', after3a[0].points, '→', after3b[0].points, '(expected ' + (after3a[0].points - tp3[0].total_points) + ') |', JSON.stringify(ord3[0]));

  // 4) العميل يرى النقاط في بياناته
  const md = await j('get_my_data', { p_token: lg.body.token });
  console.log('4) customer points in app data:', md.body.customer.points);

  // 5) طلب يُلغى قبل الإكمال: لا تُخصم نقاط
  const o5 = await mkOrder();
  await j('admin_set_order_status', { p_token: workerTok, p_order_id: o5, p_status: 'cancelled' });
  const after5 = await dbq(`select points from customers where id='${cid}'`);
  console.log('5) cancel before complete → points unchanged:', after5[0].points, '(', after5[0].points === after3b[0].points ? 'PASS' : 'FAIL', ')');
} catch (e) {
  console.error('TEST ERROR:', e.message);
} finally {
  await dbq("delete from order_items where order_id in (select id from orders where customer_id = (select id from customers where phone='" + PHONE + "')); delete from orders where customer_id = (select id from customers where phone='" + PHONE + "'); delete from points_transactions where customer_id = (select id from customers where phone='" + PHONE + "'); delete from notifications where customer_id = (select id from customers where phone='" + PHONE + "'); delete from customer_sessions where customer_id = (select id from customers where phone='" + PHONE + "'); delete from customers where phone='" + PHONE + "'; delete from admin_sessions where token='" + workerTok + "';");
  console.log('cleanup done');
  readdirSync(here).filter((x) => x.startsWith('.sbt') && x !== '.sbtok').forEach((x) => unlinkSync(join(here, x)));
}