// استعلام قاعدة البيانات — يحاول كل الرموز المتاحة
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));

let token = null;
try { token = readFileSync(join(here, '.sbtok'), 'utf8'); } catch {}
if (!token) {
  for (const f of readdirSync(here).filter((x) => x.startsWith('.sbt'))) {
    const v = readFileSync(join(here, f), 'utf8');
    const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
      method: 'POST', headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'select 1' }),
    });
  if (r.status === 200 || r.status === 201) { token = v; break; }
}
if (!token) { console.error('NO TOKEN'); process.exit(1); }
try { writeFileSync(join(here, '.sbtok'), token); } catch {}

const dbq = async (sql) => {
  const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  if (r.status !== 200 && r.status !== 201) throw new Error(`${r.status} ${t.slice(0, 500)}`);
  return t;
};

const sql = process.argv[2];
if (!sql) { console.error('usage: node dbq2.mjs "select ..."'); process.exit(1); }
console.log(await dbq(sql));
