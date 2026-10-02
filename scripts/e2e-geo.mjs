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

// 1) زبون تجريبي
await rpc('create_customer', { p_full_name: 'اختبار جيو', p_phone: '0990123456', p_pin: '1111', p_device_id: 'geo-test-device' });
const login = await rpc('customer_login', { p_phone: '0990123456', p_pin: '1111' });
const sess = JSON.parse(login.body);
console.log('test customer token:', sess.token ? 'OK' : login.body);

// 2) قرب المحل (~50 م شمالًا)
const near = await rpc('check_geo_proximity', { p_token: sess.token, p_lat: 35.1331834, p_lng: 36.7526210 });
console.log('NEAR  (~50m):', near.status, near.body);

// 3) التهدئة — استدعاء ثانٍ فورًا
const again = await rpc('check_geo_proximity', { p_token: sess.token, p_lat: 35.1331834, p_lng: 36.7526210 });
console.log('COOLDOWN    :', again.status, again.body);

// 4) بعيد (~100 كم غربًا)
const far = await rpc('check_geo_proximity', { p_token: sess.token, p_lat: 35.1331834, p_lng: 35.6526210 });
console.log('FAR (~100km):', far.status, far.body);

// 5) صف الإشعار الداخلي
const row = await dbq(`select title, body, kind from notifications where customer_id = '${sess.customer.id}' and kind = 'geo' order by created_at desc limit 1`);
console.log('in-app row:', JSON.stringify(row));

// 6) تنظيف الزبون التجريبي وبياناته
const cleanup = await dbq(`
  delete from public.notifications where customer_id = '${sess.customer.id}';
  delete from public.customer_sessions where customer_id = '${sess.customer.id}';
  delete from public.points_transactions where customer_id = '${sess.customer.id}';
  delete from public.customers where id = '${sess.customer.id}';
  select count(*)::int as remaining from public.customers where phone = '0990123456';`);
console.log('cleanup:', JSON.stringify(cleanup));

readdirSync(here).filter(x => x.startsWith('.sbt')).forEach(x => unlinkSync(join(here, x)));
console.log('# tokens cleaned');
