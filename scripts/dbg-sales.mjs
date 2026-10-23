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
  return { status: r.status, body: t };
};
// تنفيذ جسم الدالة مباشرة لرؤية الخطأ
const t = await dbq("select jsonb_build_object('daily', (select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb) from (with days as (select generate_series('2026-10-01'::date, '2026-10-12', interval '1 day')::date as day), live as (select coalesce(sum(o.total_cents) filter (where o.status = 'ready'), 0)::int as ready_total, coalesce(count(*) filter (where o.status = 'ready'), 0)::int as ready_count from public.orders o where (coalesce(o.completed_at, o.created_at) at time zone 'Asia/Damascus')::date between '2026-10-01' and '2026-10-12') select d.day, (l.ready_total + coalesce(s.total_cents, 0))::int as total_cents from days d, live l left join public.sales_daily s on s.day = d.day) x) as t");
console.log(t.body.slice(0, 800));
readdirSync(here).filter((x) => x.startsWith('.sbt') && x !== '.sbtok').forEach((x) => unlinkSync(join(here, x)));