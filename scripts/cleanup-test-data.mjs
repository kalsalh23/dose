// حذف حسابات الاختبار — set SB_TOKEN=xxx && node scripts/cleanup-test-data.mjs
const REF = 'mqstsxuscqbxnyejhixk';
const token = process.env.SB_TOKEN;
if (!token) { console.error('Missing SB_TOKEN'); process.exit(1); }

const phones = ['0500000000', '0512345678', '0522222222'];
const sql = `delete from public.customers where phone in (${phones.map(p => `'${p}'`).join(', ')});
select count(*) as remaining_customers from public.customers;
select count(*) as remaining_orders from public.orders;`;

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
console.log('Status:', res.status);
console.log((await res.text()).slice(0, 1000));
