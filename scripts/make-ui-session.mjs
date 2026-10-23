import { writeFileSync } from 'node:fs';
const K = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xc3RzeHVzY3FieG55ZWpoaXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjAwMDksImV4cCI6MjEwNTMzNjAwOX0.1Em6nTniOf3xgQWQxBf0N6h_3WZqBHba5C17i7LJ5K0';
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const rpc = (f, b) => fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/' + f, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(async r => ({ status: r.status, body: await r.text() }));
await rpc('create_customer', { p_full_name: 'اختبار واجهة', p_phone: '0990123461', p_pin: '1111', p_device_id: 'ui-test-1' });
const login = JSON.parse((await rpc('customer_login', { p_phone: '0990123461', p_pin: '1111' })).body);
// طلب تجريبي مكتمل لتظهر بيانات حقيقية في واجهة الطلبات
const cat = JSON.parse((await rpc('get_catalog', {})).body);
const prod = cat.products.find((p) => p.is_available !== false);
const ord = JSON.parse((await rpc('create_order', { p_customer_id: login.customer.id, p_pin: '1111', p_fulfillment_type: 'delivery', p_latitude: 35.133, p_longitude: 36.708, p_map_url: 'https://maps.google.com/?q=35.133,36.708', p_items: [{ product_id: prod.id, qty: 1 }], p_source: 'customer' })).body);
const adm = JSON.parse((await rpc('admin_login', { p_username: 'admin', p_password: 'dose-admin-2026' })).body);
await rpc('admin_set_order_status', { p_token: adm.token, p_order_id: ord.order_id, p_status: 'completed' });
writeFileSync('.uitest-session.json', JSON.stringify(login));
console.log('session saved; order', ord.order_number);
