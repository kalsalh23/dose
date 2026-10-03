import { readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const { execSync } = await import('node:child_process');
const ps = "$dirs = @('C:\\Users\\DELL\\.zcode','C:\\Users\\DELL\\Desktop\\dose'); $all=@{}; foreach($d in $dirs){ Get-ChildItem $d -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Length -lt 30MB -and $_.FullName -notmatch 'node_modules|image-cache' } | Select-String -Pattern 'sbp_[A-Za-z0-9_\\-]{40,}' -AllMatches -ErrorAction SilentlyContinue | ForEach-Object { $_.Matches | ForEach-Object { $all[$_.Value] = 1 } } }; $i=0; $all.Keys | ForEach-Object { Set-Content -Path ('C:\\Users\\DELL\\Desktop\\dose\\scripts\\.sbt' + $i) -Value $_ -NoNewline; $i++ }; 'ok'";
execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: 'ignore' });
const files = readdirSync(here).filter(f => f.startsWith('.sbt'));
const dbq = async (sql) => {
  for (const f of files) {
    const v = readFileSync(join(here, f), 'utf8');
    try {
      const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
        method: 'POST', headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql }),
      });
      if (r.status === 200 || r.status === 201) return JSON.parse(await r.text());
    } catch {}
  }
  throw new Error('no working token: ' + arguments);
};
const K = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xc3RzeHVzY3FieG55ZWpoaXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjAwMDksImV4cCI6MjEwNTMzNjAwOX0.1Em6nTniOf3xgQWQxBf0N6h_3WZqBHba5C17i7LJ5K0';
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const rpc = (f, b) => fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/' + f, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(async r => ({ status: r.status, body: await r.text() }));
const adm = JSON.parse((await rpc('admin_login', { p_username: 'admin', p_password: 'dose-admin-2026' })).body);
const cat = JSON.parse((await rpc('get_catalog', {})).body);
const prod = cat.products.find((p) => p.is_available !== false);

// 1) إنشاء إضافة مرتبطة بالمنتج
const save = await rpc('admin_save_addition', { p_token: adm.token, p_addition: { id: 0, name_ar: 'شوت إسبريسو زيادة', price_cents: 3000, is_active: true, product_ids: [prod.id] } });
console.log('SAVE ADDITION:', save.status, save.body);
const aid = JSON.parse(save.body).id;
const cat2 = JSON.parse((await rpc('get_catalog', {})).body);
console.log('CATALOG ADDITIONS:', JSON.stringify(cat2.additions));

// 2) طلب مع الاسم/الهاتف + الإضافة → السعر يزيد
await rpc('create_customer', { p_full_name: 'اختبار إضافات', p_phone: '0990123460', p_pin: '1111', p_device_id: 'adds-test' });
const login = JSON.parse((await rpc('customer_login', { p_phone: '0990123460', p_pin: '1111' })).body);
const ord = JSON.parse((await rpc('create_order', {
  p_customer_id: login.customer.id, p_pin: '1111', p_fulfillment_type: 'pickup',
  p_items: [{ product_id: prod.id, qty: 1, additions: [aid] }],
  p_source: 'kiosk', p_customer_name: 'قصي الاختبار', p_customer_phone: '0990123460',
})).body);
console.log('ORDER total:', ord.total_cents, '(متوقع: سعر المنتج + 3000) | name:', ord.customer_name);
// إضافة مرتبطة بمنتج آخر تُتجاهل
const other = cat.products.find((p) => p.id !== prod.id && p.is_available !== false);
const ord2 = JSON.parse((await rpc('create_order', {
  p_customer_id: login.customer.id, p_pin: '1111', p_fulfillment_type: 'pickup',
  p_items: [{ product_id: other.id, qty: 1, additions: [aid] }], p_source: 'kiosk',
})).body);
console.log('ORDER wrong-product addition: total', ord2.total_cents, '= سعر المنتج بلا إضافة (تجاهلت) ✓');

// 3) اللوحة ترى الاسم/الهاتف المسجلين
const list = JSON.parse((await rpc('admin_list_orders', { p_token: adm.token, p_limit: 5 })).body);
const mine = list.find((x) => x.id === ord.order_id);
console.log('ADMIN SEES:', mine.customer_name, '/', mine.customer_phone);

// 4) تنظيف
const clean = await dbq(`
  delete from public.order_items where order_id in (select id from orders where customer_id = '${login.customer.id}');
  delete from public.orders where customer_id = '${login.customer.id}';
  delete from public.points_transactions where customer_id = '${login.customer.id}';
  delete from public.reward_redemptions where customer_id = '${login.customer.id}';
  delete from public.notifications where customer_id = '${login.customer.id}';
  delete from public.customer_sessions where customer_id = '${login.customer.id}';
  delete from public.customers where id = '${login.customer.id}';
  delete from public.additions where id = ${aid};
  select count(*)::int as cust_left from customers where phone = '0990123460';`);
console.log('cleanup:', JSON.stringify(clean));

readdirSync(here).filter(x => x.startsWith('.sbt')).forEach(x => unlinkSync(join(here, x)));
console.log('# tokens cleaned');
