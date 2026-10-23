// التحقق من دخول المسؤول الجديد
import { readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
let token = null;
for (const f of readdirSync(here).filter((x) => x.startsWith('.sbt'))) {
  const v = readFileSync(join(here, f), 'utf8');
  const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'select 1' }),
  });
  if (r.status === 200 || r.status === 201) { token = v; break; }
}
if (!token) { console.error('NO TOKEN'); process.exit(1); }
const dbq = async (sql) => {
  const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  if (r.status !== 200 && r.status !== 201) throw new Error(`${r.status} ${t.slice(0, 300)}`);
  return JSON.parse(t);
};
const K = readFileSync(join(here, '..', 'src', 'lib', 'supabase.ts'), 'utf8').match(/'eyJ[A-Za-z0-9_.\-]+'/)[0].slice(1, -1);
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const j = async (f, b) => { const r = await fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/' + f, { method: 'POST', headers: H, body: JSON.stringify(b) }); return { status: r.status, body: await r.json() }; };

try {
  const r1 = await j('admin_login', { p_username: 'one@gmail.com', p_password: '123123' });
  console.log('new owner login:', r1.status, JSON.stringify(r1.body).slice(0, 120));

  const r2 = await j('admin_login', { p_username: 'admin', p_password: '123123' });
  console.log('old admin login (should fail):', r2.status, JSON.stringify(r2.body).slice(0, 100));

  const r3 = await j('admin_login', { p_username: 'one@gmail.com', p_password: 'wrong' });
  console.log('wrong password (should fail):', r3.status, JSON.stringify(r3.body).slice(0, 80));

  // المالك الجديد يصل لكل شيء
  const r4 = await j('admin_sales_report', { p_token: r1.body.token, p_from: '2026-10-12', p_to: '2026-10-12' });
  console.log('owner sales_report:', r4.status, 'total:', r4.body?.totals?.total);

  // بناءً على طلبك: الدخول واحد فقط — نحذف جلسات الاختبار
  await dbq("delete from admin_sessions where token = '" + r1.body.token + "'");
  console.log('cleanup done');
} catch (e) {
  console.error('TEST ERROR:', e.message);
} finally {
  readdirSync(here).filter((x) => x.startsWith('.sbt') && x !== '.sbtok').forEach((x) => unlinkSync(join(here, x)));
}