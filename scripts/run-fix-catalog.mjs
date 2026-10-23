// إصلاح get_catalog لإرجاع خيارات المنتجات
import { readFileSync } from 'node:fs';

const token = process.env.SB_TOKEN;
if (!token) { console.error('Missing SB_TOKEN'); process.exit(1); }

const q = readFileSync('scripts/fix-catalog.sql', 'utf8');
const res = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: q }),
});
console.log('status:', res.status, (await res.text()).slice(0, 300));
