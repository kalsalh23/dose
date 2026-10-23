// اختبار تقرير المبيعات مع جلسة مالك حقيقية
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
const j = async (f, b) => JSON.parse((await fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/' + f, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(r => r.text())));

try {
  const ownerTok = '032033ea-6f39-43d6-abfc-86d2dd189702';
  const r1 = await j('admin_sales_report', { p_token: ownerTok, p_from: '2026-09-01', p_to: '2026-10-12' });
  console.log('range 09-01..10-12 totals:', JSON.stringify(r1.totals));
  console.log('daily days:', (r1.daily || []).length, '| products:', (r1.products || []).length);
  if (r1.products?.length) console.log('top product:', JSON.stringify(r1.products[0]));

  const r2 = await j('admin_sales_report', { p_token: ownerTok, p_from: '2026-10-12', p_to: '2026-10-12' });
  console.log('today totals:', JSON.stringify(r2.totals));

  const r3 = await j('admin_sales_report', { p_token: ownerTok, p_from: '2026-10-06', p_to: '2026-10-12' });
  console.log('week totals:', JSON.stringify(r3.totals), '| days:', (r3.daily || []).map((d) => d.day + '=' + d.total_cents).join(' '));

  // المقارنة الخام
  const chk = await dbq("select count(*)::int as ord, coalesce(sum(total_cents),0)::int as total from orders where status in ('ready','completed')");
  console.log('raw ready+completed:', JSON.stringify(chk[0]));
  const sd = await dbq("select coalesce(sum(total_cents),0)::int as total, coalesce(sum(orders_count),0)::int as cnt from sales_daily");
  console.log('sales_daily all:', JSON.stringify(sd[0]));
} catch (e) {
  console.error('TEST ERROR:', e.message);
} finally {
  readdirSync(here).filter((x) => x.startsWith('.sbt') && x !== '.sbtok').forEach((x) => unlinkSync(join(here, x)));
}