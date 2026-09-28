// اختبار البث الجماعي: إعلان اختبار ← إشعار لكل الزبائن ← حذف الإعلان
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
  const adm = JSON.parse((await rpc('admin_login', { p_username: 'admin', p_password: 'dose-admin-2026' })).body);
  // إضافة إعلان اختبار بخصم
  const save = await rpc('admin_save_ad', { p_token: adm.token, p_ad: { id: 0, image_url: '/img/latte.jpg', title: 'إعلان اختبار البث', description_ar: 'خصم خاص لفترة محدودة', discount_percent: '10', ends_at: '', is_active: true, full_screen: false } });
  console.log('save ad:', save.status, save.body);
  // التحقق من وصول الإشعار لكل الزبائن
  console.log('notifications sent:', await sql("select count(*) as notifs from public.notifications where title = '📣 عرض جديد من Dose Cafe' and body like '%إعلان اختبار البث%';"));
  // حذف الإعلان التجريبي وإشعاراته
  console.log('delete ad:', await rpc('admin_delete_ad', { p_token: adm.token, p_id: 0 }).then(r => r.body));
  console.log('cleanup:', await sql("delete from public.notifications where title = '📣 عرض جديد من Dose Cafe' and body like '%إعلان اختبار البث%'; select count(*) as remaining from public.notifications where body like '%إعلان اختبار البث%';"));
  // اختبار دالة البث مباشرة (صفر أجهزة مشتركة على هذا الجهاز الاختباري)
  const pushRes = await fetch('https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer anon' },
    body: JSON.stringify({ all: true, title: 'اختبار بث', body: 'x' }),
  });
  console.log('broadcast fn:', pushRes.status, await pushRes.text());
})();
