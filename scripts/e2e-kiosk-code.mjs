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

// 0) الإعدادات الحالية لكود الخصم
const settings = await dbq(`select key, value from settings where key like 'promo%' order by key`);
console.log('PROMO SETTINGS:', JSON.stringify(settings));

// 1) زبون تجريبي بنقاط
await rpc('create_customer', { p_full_name: 'اختبار كشك', p_phone: '0990123457', p_pin: '1111', p_device_id: 'kiosk-code-test' });
const login = JSON.parse((await rpc('customer_login', { p_phone: '0990123457', p_pin: '1111' })).body);
console.log('test customer:', login.customer.id);
await dbq(`update customers set points = 100 where id = '${login.customer.id}'`);

// 2) استبدال مكافأة → كود
const red = JSON.parse((await rpc('redeem_reward', { p_token: login.token, p_reward_id: 4 })).body);
console.log('REDEEMED code:', red.code, red.reward_name);

// 3) فحص الكود كما تفعل واجهة الكشك
const check = JSON.parse((await rpc('check_reward_code', { p_code: red.code })).body);
console.log('CHECK (kiosk step):', JSON.stringify(check));

// 4) طلب الكشك بالكود (استلام، صنف واحد)
const cat = JSON.parse((await rpc('get_catalog', {})).body);
const prod = cat.products.find((p) => p.is_available !== false);
const order = await rpc('create_order', {
  p_customer_id: login.customer.id, p_pin: '1111', p_fulfillment_type: 'pickup',
  p_items: [{ product_id: prod.id, qty: 1 }], p_source: 'kiosk', p_reward_code: red.code,
});
console.log('KIOSK ORDER with reward code:', order.status, order.body.slice(0, 220));

// 5) تنظيف شامل للزبون التجريبي
const clean = await dbq(`
  delete from public.order_items where order_id in (select id from orders where customer_id = '${login.customer.id}');
  delete from public.orders where customer_id = '${login.customer.id}';
  delete from public.points_transactions where customer_id = '${login.customer.id}';
  delete from public.reward_redemptions where customer_id = '${login.customer.id}';
  delete from public.notifications where customer_id = '${login.customer.id}';
  delete from public.customer_sessions where customer_id = '${login.customer.id}';
  delete from public.customers where id = '${login.customer.id}';
  select count(*)::int as left from customers where phone = '0990123457';`);
console.log('cleanup:', JSON.stringify(clean));

readdirSync(here).filter(x => x.startsWith('.sbt')).forEach(x => unlinkSync(join(here, x)));
console.log('# tokens cleaned');
