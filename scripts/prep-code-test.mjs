// تجهيز اختبار رمز الخصم: نقاط + استبدال → كود
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
  // منح 100 نقطة لحساب الاختبار
  console.log('points given:', await sql("update public.customers set points = 100 where phone = '0544444401'; select points from public.customers where phone = '0544444401';"));
  // دخول واستبدال
  const lg = JSON.parse((await rpc('customer_login', { p_phone: '0544444401', p_pin: '7777' })).body);
  const rd = JSON.parse((await rpc('redeem_reward', { p_token: lg.token, p_reward_id: 1 })).body);
  console.log('redemption:', JSON.stringify(rd));
  // فحص الرمز
  console.log('check valid:', (await rpc('check_reward_code', { p_code: rd.code })).body);
  console.log('check used:', (await rpc('check_reward_code', { p_code: 'ZZZZZZ' })).body);
})();
