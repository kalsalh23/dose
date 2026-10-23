// التحقق من الأدوار والمالك المُستعاد
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
  // 1) الحساب الجديد = عامل + كلمة السر الصحيحة
  const r1 = await j('admin_login', { p_username: 'one@gmail.com', p_password: '123123' });
  console.log('1) one@gmail.com / 123123 →', r1.status, 'role:', r1.body?.role);

  // 2) كلمة مرور خاطئة ترفض
  const r2 = await j('admin_login', { p_username: 'one@gmail.com', p_password: '000000' });
  console.log('2) wrong password →', r2.status);

  // 3) العامل يرى الطلبات فقط
  const wt = r1.body?.token;
  const ord = await j('admin_list_orders', { p_token: wt, p_limit: 3 });
  console.log('3) worker orders list →', ord.status, '| orders:', Array.isArray(ord.body) ? ord.body.length : 'n/a');
  for (const fn of ['admin_list_products', 'admin_stats', 'admin_sales_report', 'admin_get_settings', 'admin_list_customers']) {
    const body = fn === 'admin_sales_report' ? { p_token: wt, p_from: '2026-10-01', p_to: '2026-10-12' } : { p_token: wt };
    const rr = await j(fn, body);
    const blocked = rr.status !== 200 || (Array.isArray(rr.body) && rr.body.length === 0) || (typeof rr.body === 'object' && rr.body && Object.keys(rr.body).length === 0);
    console.log('   worker ' + fn + ' →', rr.status, blocked ? '(BLOCKED ✓)' : '(LEAK!)');
  }

  // 4) المالك: نفس البصمة الأصلية (كلمة المرور القديمة عندك ستعمل)
  const rows = await dbq("select username, role, password_hash from admin_users order by id");
  console.log('4) accounts:', rows.map((r) => r.username + '=' + r.role).join(', '));
  console.log('   admin hash is original:', rows.find((r) => r.username === 'admin')?.password_hash === 'e62bdf9a90490023d41db9261fa14c7d008fb227c0ccfc0465e78c0c69726269');

  // 5) المالك يصل لكل شيء (بجلسة جديدة)
  const os = await dbq("insert into admin_sessions (admin_id, token) values ((select id from admin_users where username='admin'), gen_random_uuid()) returning token");
  const r5 = await j('admin_list_products', { p_token: os[0].token });
  console.log('5) owner list_products →', r5.status, '| products:', Array.isArray(r5.body) ? r5.body.length : 'n/a');
  await dbq("delete from admin_sessions where token='" + os[0].token + "'; delete from admin_sessions where token='" + wt + "';");
  console.log('cleanup done');
} catch (e) {
  console.error('TEST ERROR:', e.message);
} finally {
  readdirSync(here).filter((x) => x.startsWith('.sbt') && x !== '.sbtok').forEach((x) => unlinkSync(join(here, x)));
}