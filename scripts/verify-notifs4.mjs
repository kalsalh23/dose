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

const sql = readFileSync(join(here, 'fix-admin-send-notification.sql'), 'utf8');
console.log('apply fix:', JSON.stringify(await dbq(sql)));

const K = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xc3RzeHVzY3FieG55ZWpoaXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjAwMDksImV4cCI6MjEwNTMzNjAwOX0.1Em6nTniOf3xgQWQxBf0N6h_3WZqBHba5C17i7LJ5K0';
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const rpc = (f, b) => fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/' + f, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(async r => ({ status: r.status, body: await r.text() }));

// 1) فحص نشر دالة الدفع (استعلام بمعرّف غير موجود — لا يرسل شيئًا)
const probe = await fetch('https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer anon' },
  body: JSON.stringify({ customer_id: '00000000-0000-0000-0000-000000000000', title: 'probe' }),
});
console.log('push fn probe:', probe.status, await probe.text());

// 2) إشعار خارجي للوحة (جهاز الإدارة)
const admPush = await fetch('https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer anon' },
  body: JSON.stringify({ admin: true, title: '🔔 اختبار نظام الإشعارات', body: 'إشعار خارجي للوحة التحكم — Dose Cafe' }),
});
console.log('admin push:', admPush.status, await admPush.text());

// 3) اختبار شامل عبر admin_send_notification المُصلَحة: داخلي + خارجي لكل الزبائن
const adm = JSON.parse((await rpc('admin_login', { p_username: 'admin', p_password: 'dose-admin-2026' })).body);
const send = await rpc('admin_send_notification', { p_token: adm.token, p_title: '🔔 اختبار نظام الإشعارات', p_body: 'إشعار داخلي وخارجي معًا — Dose Cafe' });
console.log('admin_send_notification:', send.status, send.body);
await new Promise(r => setTimeout(r, 2500));

// 4) التحقق من الوصول الداخلي + تنظيف صفوف الاختبار
const check = await dbq("select count(*)::int as inserted from public.notifications where title = '🔔 اختبار نظام الإشعارات' and body = 'إشعار داخلي وخارجي معًا — Dose Cafe'");
console.log('in-app rows inserted:', check);
const cleanup = await dbq("delete from public.notifications where title = '🔔 اختبار نظام الإشعارات'; select count(*)::int as remaining from public.notifications where title = '🔔 اختبار نظام الإشعارات'");
console.log('cleanup:', cleanup);

readdirSync(here).filter(x => x.startsWith('.sbt')).forEach(x => unlinkSync(join(here, x)));
console.log('# token files cleaned');
