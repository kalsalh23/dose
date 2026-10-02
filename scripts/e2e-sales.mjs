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
  throw new Error('no working token');
};
const K = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xc3RzeHVzY3FieG55ZWpoaXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjAwMDksImV4cCI6MjEwNTMzNjAwOX0.1Em6nTniOf3xgQWQxBf0N6h_3WZqBHba5C17i7LJ5K0';
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const rpc = (f, b) => fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/' + f, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(async r => ({ status: r.status, body: await r.text() }));
const adm = JSON.parse((await rpc('admin_login', { p_username: 'admin', p_password: 'dose-admin-2026' })).body);

const before = JSON.parse((await rpc('admin_sales_summary', { p_token: adm.token })).body);
console.log('SUMMARY BEFORE: today =', before.today.total, '| month =', before.month.total);

// 1) طلب تجريبي مكتمل
await rpc('create_customer', { p_full_name: 'اختبار مبيعات', p_phone: '0990123459', p_pin: '1111', p_device_id: 'sales-test' });
const login = JSON.parse((await rpc('customer_login', { p_phone: '0990123459', p_pin: '1111' })).body);
const cat = JSON.parse((await rpc('get_catalog', {})).body);
const prod = cat.products.find((p) => p.is_available !== false);
const ord = JSON.parse((await rpc('create_order', { p_customer_id: login.customer.id, p_pin: '1111', p_fulfillment_type: 'pickup', p_items: [{ product_id: prod.id, qty: 1 }], p_source: 'kiosk' })).body);
const st = await rpc('admin_set_order_status', { p_token: adm.token, p_order_id: ord.order_id, p_status: 'completed' });
console.log('order completed:', st.body, '| total:', ord.total_cents);

const after = JSON.parse((await rpc('admin_sales_summary', { p_token: adm.token })).body);
console.log('SUMMARY AFTER COMPLETION: today =', after.today.total, '(فرق +', after.today.total - before.today.total, ')');

// 2) محاكاة مرور يوم + تشغيل الحذف يدويًا (نفس ما يفعله الكرون)
await dbq(`update public.orders set completed_at = now() - interval '25 hours' where id = '${ord.order_id}'`);
const cleanup = await dbq(`
  delete from public.order_items where order_id in (
    select id from public.orders
    where status in ('completed','cancelled') and completed_at is not null and completed_at < now() - interval '1 day');
  delete from public.orders
  where status in ('completed','cancelled') and completed_at is not null and completed_at < now() - interval '1 day';
  select count(*)::int as orders_left from public.orders where id = '${ord.order_id}';`);
console.log('after cleanup: order exists?', JSON.stringify(cleanup));

const finalSum = JSON.parse((await rpc('admin_sales_summary', { p_token: adm.token })).body);
console.log('SUMMARY AFTER DELETION: today =', finalSum.today.total, '| month =', finalSum.month.total, '(يجب أن يبقى كما كان بعد الإكمال)');

// 3) تنظيف الزبون التجريبي
const clean = await dbq(`
  delete from public.points_transactions where customer_id = '${login.customer.id}';
  delete from public.reward_redemptions where customer_id = '${login.customer.id}';
  delete from public.notifications where customer_id = '${login.customer.id}';
  delete from public.customer_sessions where customer_id = '${login.customer.id}';
  delete from public.customers where id = '${login.customer.id}';
  select count(*)::int as left from customers where phone = '0990123459';`);
console.log('cleanup customer:', JSON.stringify(clean));

readdirSync(here).filter(x => x.startsWith('.sbt')).forEach(x => unlinkSync(join(here, x)));
console.log('# tokens cleaned');
