// فحص سريع لدوال المنصة — node scripts/smoke-test.mjs
const URL_ = 'https://mqstsxuscqbxnyejhixk.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xc3RzeHVzY3FieG55ZWpoaXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjAwMDksImV4cCI6MjEwNTMzNjAwOX0.1Em6nTniOf3xgQWQxBf0N6h_3WZqBHba5C17i7LJ5K0';
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const rpc = (fn, body) => fetch(URL_ + '/rest/v1/rpc/' + fn, { method: 'POST', headers: H, body: JSON.stringify(body) }).then(async r => [r.status, await r.text()]);

const run = async (name, fn, body) => { const [s, t] = await rpc(fn, body); console.log(name + ':', s, t.slice(0, 160)); return t; };

const cat = await run('get_catalog', 'get_catalog', {});
const catalog = JSON.parse(cat);
console.log('products:', catalog.products?.length, '| rewards:', catalog.rewards?.length, '| ads:', catalog.ads?.length, '| cats:', catalog.categories?.length);

// حساب اختبار كامل الرحلة
await run('create_customer', 'create_customer', { p_full_name: 'اختبار منصة', p_phone: '0599999001', p_pin: '9876' });
const login = JSON.parse(await run('customer_login', 'customer_login', { p_phone: '0599999001', p_pin: '9876' }));
const tok = login.token;
const prod = catalog.products[3]; // كابتشينو 400
const order = JSON.parse(await run('create_order', 'create_order', {
  p_customer_id: login.customer.id, p_pin: '9876', p_fulfillment_type: 'delivery',
  p_items: [{ product_id: prod.id, qty: 2 }], p_latitude: 33.5, p_longitude: 36.3, p_map_url: 'https://maps.google.com/?q=33.5,36.3', p_source: 'kiosk',
}));
console.log('order:', order.order_number, 'total:', order.total_cents, 'pts:', order.total_points);

// PIN خاطئ مرتين (rate limit)
await run('wrong pin', 'customer_login', { p_phone: '0599999001', p_pin: '0000' });
// استبدال مكافأة يحتاج نقاطًا — اختبر الرفض
await run('redeem (insufficient)', 'redeem_reward', { p_token: tok, p_reward_id: catalog.rewards[0].id });

const admin = JSON.parse(await run('admin_login', 'admin_login', { p_username: 'admin', p_password: 'dose-admin-2026' }));
await run('admin_stats', 'admin_stats', { p_token: admin.token });
await run('admin_list_orders', 'admin_list_orders', { p_token: admin.token, p_limit: 5 });
await run('admin_set_status completed', 'admin_set_order_status', { p_token: admin.token, p_order_id: order.order_id, p_status: 'completed' });
const my = JSON.parse(await run('get_my_data', 'get_my_data', { p_token: tok }));
console.log('customer points after complete:', my.customer?.points, '| notifications:', my.notifications?.length, '| orders:', my.orders?.length);
