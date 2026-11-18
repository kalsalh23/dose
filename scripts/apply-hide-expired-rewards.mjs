import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const TOKEN = process.argv[2];
if (!TOKEN) throw new Error('no token');
const dbq = async (sql) => {
  const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  return JSON.parse(await r.text());
};
const sql = readFileSync(join(here, 'hide-expired-rewards.sql'), 'utf8');
console.log('RESULT:', JSON.stringify(await dbq(sql)));