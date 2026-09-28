// اختبار إعادة إدخال PIN بعد الخطأ (تطبيق العميل)
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
  // حساب اختبار جديد
  const create = await rpc('create_customer', { p_full_name: 'اختبار PIN', p_phone: '0533333301', p_pin: '1111', p_device_id: 'test' });
  console.log('created:', create.status);
  const lg = JSON.parse((await rpc('customer_login', { p_phone: '0533333301', p_pin: '1111' })).body);
  // محاولة خاطئة (لا يُنشأ طلب)
  const cat = JSON.parse((await rpc('get_catalog', {})).body);
  const p1 = cat.products[0];
  const wrong = await rpc('create_order', { p_customer_id: lg.customer.id, p_pin: '9999', p_fulfillment_type: 'pickup', p_items: [{ product_id: p1.id, qty: 1 }] });
  console.log('wrong pin → error:', wrong.status, wrong.body.slice(0, 80));
  // محاولة صحيحة مباشرة بعدها (يجب أن تنجح — لا قفل لأن 1 محاولة فقط)
  const right = await rpc('create_order', { p_customer_id: lg.customer.id, p_pin: '1111', p_fulfillment_type: 'pickup', p_items: [{ product_id: p1.id, qty: 1 }] });
  console.log('right pin → order:', right.status, right.body.slice(0, 100));
  // تنظيف
  console.log('cleanup:', await sql(`delete from public.order_items where order_id in (select id from public.orders where customer_id='${lg.customer.id}');
  delete from public.orders where customer_id='${lg.customer.id}';
  delete from public.points_transactions where customer_id='${lg.customer.id}';
  delete from public.notifications where customer_id='${lg.customer.id}';
  delete from public.customer_sessions where customer_id='${lg.customer.id}';
  delete from public.customers where id='${lg.customer.id}';
  select count(*) as customers from public.customers;`));
})();
