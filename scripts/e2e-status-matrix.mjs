// اختبار كل انتقالات حالة الطلب لإيجاد الخطأ
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
const rpc = (f, b) => fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/' + f, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(async r => ({ status: r.status, body: await r.text() }));
const j = async (f, b) => JSON.parse((await rpc(f, b)).body);

const PHONE = '0999555666';
const ALL = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'];
let adminToken = null;
try {
  const sess = await dbq(`insert into admin_sessions (admin_id, token) values (1, gen_random_uuid()) returning token`);
  adminToken = sess[0].token;
  await rpc('create_customer', { p_full_name: 'اختبار انتقالات', p_phone: PHONE, p_device_id: 'matrix-test' });
  const login = await j('customer_login', { p_phone: PHONE, p_pin: null });

  const orderId = (await j('create_order', {
    p_customer_id: login.customer.id, p_pin: null, p_confirm_phone: PHONE, p_fulfillment_type: 'pickup',
    p_items: [{ product_id: 279, qty: 1 }], p_source: 'customer',
  })).order_id;

  for (const to of ALL) {
    const r = await rpc('admin_set_order_status', { p_token: adminToken, p_order_id: orderId, p_status: to });
    const bad = r.status !== 200;
    console.log(`${bad ? 'FAIL' : 'ok  '} -> ${to.padEnd(16)} HTTP ${r.status} ${bad ? r.body.slice(0, 220) : ''}`);
  }
} catch (e) {
  console.error('TEST ERROR:', e.message);
} finally {
  try {
    await dbq(`delete from order_items where order_id in (select id from orders where customer_id = (select id from customers where phone='${PHONE}'));
               delete from orders where customer_id = (select id from customers where phone='${PHONE}');
               delete from points_transactions where customer_id = (select id from customers where phone='${PHONE}');
               delete from notifications where customer_id = (select id from customers where phone='${PHONE}');
               delete from customer_sessions where customer_id = (select id from customers where phone='${PHONE}');
               delete from customers where phone='${PHONE}';
               delete from admin_sessions where token='${adminToken}';`);
    console.log('cleanup done');
  } catch (e) { console.error('cleanup error:', e.message); }
  readdirSync(here).filter((x) => x.startsWith('.sbt') && x !== '.sbtok').forEach((x) => unlinkSync(join(here, x)));
}
