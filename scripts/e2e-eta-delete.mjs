// اختبار شامل: ETA + تغيير الحالة + الحذف النهائي + صلاحيات العامل
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
const rpc = (f, b) => fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/' + f, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(async r => ({ status: r.status, body: await r.text() }));
const j = async (f, b) => JSON.parse((await rpc(f, b)).body);

const PHONE = '0999888777';
let workerTok = null, testProductId = null, testOrderId = null;
try {
  // جلسات
  const ws = await dbq("insert into admin_sessions (admin_id, token) values ((select id from admin_users where username='worker'), gen_random_uuid()) returning token");
  workerTok = ws[0].token;
  const ownerTok = '032033ea-6f39-43d6-abfc-86d2dd189702';

  // عميل وطلب
  await rpc('create_customer', { p_full_name: 'اختبار ETA', p_phone: PHONE, p_device_id: 'eta-test' });
  const login = await j('customer_login', { p_phone: PHONE, p_pin: null });
  const orderId = (await j('create_order', {
    p_customer_id: login.customer.id, p_pin: null, p_confirm_phone: PHONE, p_fulfillment_type: 'pickup',
    p_items: [{ product_id: 279, qty: 1 }], p_source: 'customer',
  })).order_id;
  testOrderId = orderId;

  // 1) العامل يضبط «قيد التحضير» مع وقت 20 دقيقة
  const s1 = await rpc('admin_set_order_status', { p_token: workerTok, p_order_id: orderId, p_status: 'preparing', p_eta_minutes: 20 });
  console.log('worker preparing+ETA:', s1.status, s1.body.slice(0, 160));

  // 2) التحقق من حفظ الوقت
  const od = await dbq(`select status, estimated_delivery_at, extract(epoch from (estimated_delivery_at - now()))/60 as mins_left from orders where id='${orderId}'`);
  console.log('order eta:', JSON.stringify(od[0]));

  // 3) الطلب يظهر للعميل بالوقت المتوقع
  const md = await j('get_my_data', { p_token: login.token });
  const myOrd = md.orders.find((o) => o.id === orderId);
  console.log('customer sees eta:', JSON.stringify(myOrd?.estimated_delivery_at));

  // 4) admin_list_orders يُرجع الوقت
  const lo = await j('admin_list_orders', { p_token: ownerTok, p_limit: 5 });
  const admOrd = lo.find((o) => o.id === orderId);
  console.log('admin sees eta:', admOrd?.estimated_delivery_at, '| status:', admOrd?.status);

  // 5) الإصلاح: out_for_delivery على طلب استلام
  const s2 = await rpc('admin_set_order_status', { p_token: ownerTok, p_order_id: orderId, p_status: 'out_for_delivery' });
  console.log('out_for_delivery on pickup:', s2.status, s2.body.slice(0, 120));

  // 6) العامل يحاول حذف منتج (ممنوع)
  const s3 = await rpc('admin_delete_product', { p_token: workerTok, p_id: 6 });
  console.log('worker delete product (should fail):', s3.status, s3.body.slice(0, 100));

  // 7) المالك يضيف منتج اختباري ثم يحذفه نهائيًا
  const prod = await j('admin_save_product', { p_token: ownerTok, p_product: { id: 0, category_slug: 'fresh', name_ar: 'منتج اختبار', name_en: 'test product', description_ar: 'desc', price_cents: 15000, points: 5, image_url: '', options: '', is_active: true, is_available: true, sort_order: 0 } });
  console.log('save product (fresh cat):', JSON.stringify(prod));
  const prods = await dbq("select id, name_ar from products where name_ar='منتج اختبار'");
  testProductId = prods[0]?.id;
  const del = await rpc('admin_delete_product', { p_token: ownerTok, p_id: testProductId });
  console.log('permanent delete:', del.status);
  const chk = await dbq(`select count(*)::int as cnt from products where id=${testProductId}`);
  console.log('product rows after delete (should be 0):', chk[0].cnt);
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
               ${testProductId ? `delete from order_items where product_id=${testProductId}; delete from products where id=${testProductId};` : ''}
               delete from admin_sessions where token='${workerTok}';`);
    console.log('cleanup done');
  } catch (e) { console.error('cleanup error:', e.message); }
  readdirSync(here).filter((x) => x.startsWith('.sbt') && x !== '.sbtok').forEach((x) => unlinkSync(join(here, x)));
}