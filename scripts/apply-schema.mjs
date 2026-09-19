// تنفيذ مخطط قاعدة البيانات على Supabase عبر Management API
// الاستخدام: set SB_TOKEN=sbp_xxx && node scripts/apply-schema.mjs
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REF = 'mqstsxuscqbxnyejhixk';
const token = process.env.SB_TOKEN;
if (!token) { console.error('Missing SB_TOKEN env var'); process.exit(1); }

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = await readFile(join(__dirname, 'schema.sql'), 'utf8');

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
const body = await res.text();
console.log('Status:', res.status);
console.log(body.slice(0, 2000));
process.exit(res.ok ? 0 : 1);
