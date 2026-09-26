// إدراج قسمي hot و cold من ملف المنيو (بدون خطوة التعطيل)
import { readFileSync } from 'node:fs';

const token = process.env.SB_TOKEN;
if (!token) { console.error('Missing SB_TOKEN'); process.exit(1); }

let s = readFileSync('scripts/menu2.sql', 'utf8').replace(/\r\n/g, '\n');
const deactivate = "update public.products p set is_active = false\nwhere p.category_id in (select id from public.categories where slug in ('hot','cold'));\n";
s = s.replace(deactivate, '');

const res = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: s }),
});
console.log('insert:', res.status, (await res.text()).slice(0, 300));
