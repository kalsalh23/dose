// اختبار دوال الإدارة بعد إصلاح null
const K = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xc3RzeHVzY3FieG55ZWpoaXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjAwMDksImV4cCI6MjEwNTMzNjAwOX0.1Em6nTniOf3xgQWQxBf0N6h_3WZqBHba5C17i7LJ5K0';
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const rpc = (f, b) => fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/' + f, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(async r => [r.status, (await r.text()).slice(0, 120)]);

(async () => {
  const adm = JSON.parse((await rpc('admin_login', { p_username: 'admin', p_password: 'dose-admin-2026' }))[1]);
  const tok = adm.token;
  console.log('save_settings:', (await rpc('admin_save_settings', { p_token: tok, p_settings: { currency_symbol: 'ل.س' } }))[1]);
  console.log('save_product:', (await rpc('admin_save_product', { p_token: tok, p_product: { id: 12, name_ar: 'كيك الشوكولاتة', name_en: 'Chocolate Cake', description_ar: 'كيكة شوكولاتة غنية', price_cents: 35000, points: 5, image_url: '/img/chocolate-cake.jpg', category_slug: 'dessert', options: 'صوص شوكولاتة, مكسرات, كرز', is_active: true, sort_order: 1 } }))[1]);
  const custs = JSON.parse((await rpc('admin_list_customers', { p_token: tok }))[1]);
  const c1 = custs[0];
  console.log('toggle:', (await rpc('admin_toggle_customer', { p_token: tok, p_customer_id: c1.id, p_active: !c1.is_active }))[1]);
  console.log('toggle back:', (await rpc('admin_toggle_customer', { p_token: tok, p_customer_id: c1.id, p_active: c1.is_active }))[1]);
  console.log('bad token stats (يجب null):', (await rpc('admin_stats', { p_token: '00000000-0000-0000-0000-000000000000' }))[1]);
})();
