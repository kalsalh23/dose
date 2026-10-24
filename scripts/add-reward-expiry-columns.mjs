import { readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
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

const sql = `
alter table public.rewards add column if not exists expires_at timestamptz;
alter table public.rewards add column if not exists redemption_days integer;
update public.rewards set redemption_days = 7 where redemption_days is null;
alter table public.rewards alter column redemption_days set not null;
alter table public.rewards alter column redemption_days set default 7;
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name='rewards' order by ordinal_position;
`;
console.log('ADD COLS:', JSON.stringify(await dbq(sql)));
readdirSync(here).filter(x => x.startsWith('.sbt')).forEach(x => unlinkSync(join(here, x)));
console.log('# tokens cleaned');