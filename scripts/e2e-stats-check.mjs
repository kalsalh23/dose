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
  const l = await j('admin_login', { p_username: 'one@gmail.com', p_password: '123123' });
  const wt = l.body.token;
  const s1 = await j('admin_stats', { p_token: wt });
  console.log('worker admin_stats →', s1.status, '| body:', JSON.stringify(s1.body));
  const s2 = await j('admin_stats', { p_token: '00000000-0000-0000-0000-000000000000' });
  console.log('invalid token admin_stats →', s2.status, '| body:', JSON.stringify(s2.body).slice(0, 80));
  // للمقارنة: المالك
  const os = await dbq("insert into admin_sessions (admin_id, token) values ((select id from admin_users where username='admin'), gen_random_uuid()) returning token");
  const s3 = await j('admin_stats', { p_token: os[0].token });
  console.log('owner admin_stats →', s3.status, '| customers:', s3.body?.customers, '| sales:', s3.body?.sales_cents);
  await dbq("delete from admin_sessions where token='" + os[0].token + "'; delete from admin_sessions where token='" + wt + "';");
  console.log('cleanup done');
} catch (e) { console.error('ERR:', e.message); }
finally { readdirSync(here).filter((x) => x.startsWith('.sbt') && x !== '.sbtok').forEach((x) => unlinkSync(join(here, x))); }