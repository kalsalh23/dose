// اختبار سريع لدوال RPC عبر anon key — node scripts/smoke-test.mjs
const URL = 'https://mqstsxuscqbxnyejhixk.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xc3RzeHVzY3FieG55ZWpoaXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjAwMDksImV4cCI6MjEwNTMzNjAwOX0.1Em6nTniOf3xgQWQxBf0N6h_3WZqBHba5C17i7LJ5K0';
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const rpc = (fn, body) => fetch(URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: H, body: JSON.stringify(body) });
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');

const [,, phone, pin] = process.argv;
const hash = await sha(phone + ':' + pin);

let r = await rpc('create_customer', { p_full_name: 'عميل تجريبي', p_phone: phone, p_pin_hash: hash, p_device_id: 'test-device' });
const created = await r.json();
console.log('create_customer:', r.status, JSON.stringify(created).slice(0, 200));

r = await rpc('create_customer', { p_full_name: 'عميل تجريبي', p_phone: phone, p_pin_hash: hash });
console.log('duplicate:', r.status, (await r.text()).slice(0, 140));

r = await rpc('verify_customer', { p_phone: phone, p_pin_hash: hash });
const v = await r.json();
console.log('verify ok:', r.status, JSON.stringify(v).slice(0, 140));

r = await rpc('verify_customer', { p_phone: phone, p_pin_hash: '0'.repeat(64) });
console.log('verify wrong:', r.status, await r.text());

const cid = Array.isArray(created) ? created[0]?.id : created?.id;
if (cid) {
  r = await rpc('create_order', { p_customer_id: cid, p_items: [{ product_ar: 'لاتيه', product_en: 'Latte', qty: 2, points: 5 }], p_total_points: 10 });
  console.log('create_order:', r.status, await r.text());
}

r = await fetch(URL + '/rest/v1/customers?select=*', { headers: H });
console.log('direct customers (must be 401/403):', r.status);
