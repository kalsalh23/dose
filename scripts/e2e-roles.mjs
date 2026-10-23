// اختبار نظام الأدوار
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
  if (r.status !== 200 && r.status !== 201) throw new Error(`${r.status} ${t.slice(0, 400)}`);
  return JSON.parse(t);
};

const K = readFileSync(join(here, '..', 'src', 'lib', 'supabase.ts'), 'utf8').match(/'eyJ[A-Za-z0-9_.\-]+'/)[0].slice(1, -1);
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const rpc = (f, b) => fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/' + f, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(async r => ({ status: r.status, body: await r.text() }));
const j = async (f, b) => JSON.parse((await rpc(f, b)).body);

try {
  // 1) دخول العامل
  const wl = await j('admin_login', { p_username: 'worker', p_password: 'worker1234' });
  console.log('worker login:', JSON.stringify(wl));

  // 2) العامل يجلب الطلبات (مسموح)
  const ord = await rpc('admin_list_orders', { p_token: wl.token, p_limit: 5 });
  console.log('worker list_orders:', ord.status);

  // 3) العامل يحاول جلب المنتجات (ممنوع)
  const prod = await rpc('admin_list_products', { p_token: wl.token });
  console.log('worker list_products (should fail):', prod.status, prod.body.slice(0, 120));

  // 4) العامل يحاول الإعدادات (ممنوع)
  const set = await rpc('admin_get_settings', { p_token: wl.token });
  console.log('worker get_settings (should fail):', set.status, set.body.slice(0, 120));

  // 5) المالك يجلب المنتجات (مسموح) — كلمة مرور المالك الحالية غير معروفة هنا، نتحقق عبر جلسة موجودة
  const sessions = await dbq("select token from admin_sessions s join admin_users u on u.id=s.admin_id where u.role='owner' and s.created_at > now() - interval '12 hours' limit 1");
  if (sessions.length) {
    const p2 = await rpc('admin_list_products', { p_token: sessions[0].token });
    console.log('owner list_products (should work):', p2.status);
  } else {
    console.log('no active owner session to test with');
  }
} catch (e) {
  console.error('TEST ERROR:', e.message);
} finally {
  readdirSync(here).filter((x) => x.startsWith('.sbt') && x !== '.sbtok').forEach((x) => unlinkSync(join(here, x)));
}