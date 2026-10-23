import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const token = readFileSync(join(here, '.tk0'), 'utf8');
const sql = readFileSync(join(here, 'fix-promo-scope-order.sql'), 'utf8');
const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
console.log(r.status, (await r.text()).slice(0, 400));
