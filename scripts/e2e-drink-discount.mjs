// التحقق من خصم كود الخصم على مشروب محدد (نطاق منتج)
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

const DRINK = 284;   // ملتشا 12000
const OTHER = 279;   // شاي عادي 3000
const PHONE = '0999000111';

try {
  await j('create_customer', { p_full_name: 'اختبار خصم', p_phone: PHONE, p_device_id: 'promo-test2' });
  const login = await j('customer_login', { p_phone: PHONE, p_pin: null });

  // نشر كود خصم 20% على مشروب محدد (مثل اللوحة)
  await dbq("insert into settings (key,value) values ('promo_code','TESTDRINK') on conflict (key) do update set value=excluded.value; insert into settings (key,value) values ('promo_discount','20') on conflict (key) do update set value=excluded.value; insert into settings (key,value) values ('promo_scope','product') on conflict (key) do update set value=excluded.value; insert into settings (key,value) values ('promo_target','" + DRINK + "') on conflict (key) do update set value=excluded.value;");

  const check = await j('check_reward_code', { p_code: 'TESTDRINK' });
  console.log('check_reward_code:', JSON.stringify(check));

  const items = [{ product_id: DRINK, qty: 2 }, { product_id: OTHER, qty: 1 }];
  const o1 = await j('create_order', { p_customer_id: login.customer.id, p_pin: null, p_confirm_phone: PHONE, p_fulfillment_type: 'pickup', p_items: items, p_source: 'customer', p_reward_code: 'TESTDRINK' });
  const expected = Math.round(12000 * 2 * 0.8) + 3000;
  console.log('with-code total:', o1.total_cents, '| expected:', expected, '| pct:', o1.promo_pct, '| eligible:', o1.promo_subtotal);
  console.log('RESULT:', o1.total_cents === expected ? 'PASS ✓' : 'FAIL');

  const o2 = await j('create_order', { p_customer_id: login.customer.id, p_pin: null, p_confirm_phone: PHONE, p_fulfillment_type: 'pickup', p_items: items, p_source: 'customer' });
  console.log('no-code total:', o2.total_cents, '(expected 27000)');
} catch (e) {
  console.error('TEST ERROR:', e.message);
} finally {
  await dbq("delete from order_items where order_id in (select id from orders where customer_id = (select id from customers where phone='" + PHONE + "')); delete from orders where customer_id = (select id from customers where phone='" + PHONE + "'); delete from points_transactions where customer_id = (select id from customers where phone='" + PHONE + "'); delete from notifications where customer_id = (select id from customers where phone='" + PHONE + "'); delete from customer_sessions where customer_id = (select id from customers where phone='" + PHONE + "'); delete from customers where phone='" + PHONE + "'; delete from settings where key in ('promo_code','promo_discount','promo_scope','promo_target');");
  console.log('cleanup done');
  readdirSync(here).filter((x) => x.startsWith('.sbt') && x !== '.sbtok').forEach((x) => unlinkSync(join(here, x)));
}