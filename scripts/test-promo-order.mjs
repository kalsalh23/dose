// اختبار كود الخصم DOSE30 عبر create_order (المسار نفسه الذي يستخدمه التطبيق)
const K = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xc3RzeHVzY3FieG55ZWpoaXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjAwMDksImV4cCI6MjEwNTMzNjAwOX0.1Em6nTniOf3xgQWQxBf0N6h_3WZqBHba5C17i7LJ5K0';
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const rpc = (f, b) => fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/' + f, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(async r => ({ status: r.status, body: await r.text() }));

const token = process.env.SB_TOKEN;
const sql = async (q) => {
  const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }),
  });
  return r.text();
};

(async () => {
  await rpc('create_customer', { p_full_name: 'اختبار كود الخصم', p_phone: '0544444402', p_pin: '7777', p_device_id: 'test' });
  const lg = JSON.parse((await rpc('customer_login', { p_phone: '0544444402', p_pin: '7777' })).body);
  const cat = JSON.parse((await rpc('get_catalog', {})).body);
  const p = cat.products.find((x) => x.name_ar === 'لاتيه');
  // طلب بكود DOSE30 (خصم 30%): 25000 → 17500
  const ord = JSON.parse((await rpc('create_order', { p_customer_id: lg.customer.id, p_pin: '7777', p_fulfillment_type: 'pickup', p_items: [{ product_id: p.id, qty: 1 }], p_reward_code: 'DOSE30' })).body);
  console.log('order with DOSE30:', JSON.stringify(ord));
  console.log(ord.total_cents === 17500 ? '✓ خصم 30% مطبق صحيح' : '✗ المبلغ غير متوقع: ' + ord.total_cents);
  // تنظيف كامل
  console.log('cleanup:', await sql(`delete from public.order_items where order_id in (select id from public.orders where customer_id='${lg.customer.id}');
  delete from public.orders where customer_id='${lg.customer.id}';
  delete from public.points_transactions where customer_id='${lg.customer.id}';
  delete from public.notifications where customer_id='${lg.customer.id}';
  delete from public.customer_sessions where customer_id='${lg.customer.id}';
  delete from public.customers where id='${lg.customer.id}';
  select count(*) as customers from public.customers;`));
})();
