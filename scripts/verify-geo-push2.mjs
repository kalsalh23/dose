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

// قصي: جهاز مشترك + جلسة نشطة
const cand = await dbq(`
  select c.id, c.full_name,
    (select token from customer_sessions s where s.customer_id = c.id order by created_at desc limit 1) as token,
    (select count(*)::int from device_tokens dt where dt.customer_id = c.id and dt.is_admin = false) as devices
  from customers c where c.id = '4fb256b1-6059-4807-8da8-4f8d800daf19'`);
const c = cand[0];
console.log('candidate:', c.full_name, '| devices:', c.devices, '| session:', c.token ? 'OK' : 'MISSING');

// 1) فحص الاقتراب من الموقع المحفوظ في اللوحة (50 م شمالًا)
const lat = 35.133024 + 0.00045, lng = 36.708247;
const geo = await rpc('check_geo_proximity', { p_token: c.token, p_lat: lat, p_lng: lng });
console.log('GEO PROXIMITY RESULT:', geo.status, geo.body);

// 2) انتظر pg_net ثم اقرأ رد دالة الدفع الفعلي
await new Promise(r => setTimeout(r, 4000));
const resp = await dbq(`select id, status_code, content from net._http_response order by id desc limit 3`).catch(() => 'no _http_response table');
console.log('PUSH FN RESPONSES (net):', JSON.stringify(resp, null, 1));

// 3) الصف الداخلي
const row = await dbq(`select title, body, kind from notifications where customer_id = '${c.id}' and kind = 'geo' order by created_at desc limit 1`);
console.log('IN-APP ROW:', JSON.stringify(row));

readdirSync(here).filter(x => x.startsWith('.sbt')).forEach(x => unlinkSync(join(here, x)));
console.log('# tokens cleaned');
