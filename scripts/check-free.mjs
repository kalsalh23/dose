const token = process.env.SB_TOKEN;
const q = `select o.order_number, o.total_cents, o.total_points, o.status,
  (select code from public.reward_redemptions r where r.customer_id = o.customer_id order by r.created_at desc limit 1) as last_code,
  (select status from public.reward_redemptions r where r.customer_id = o.customer_id order by r.created_at desc limit 1) as code_status
from public.orders o
join public.customers c on c.id = o.customer_id
where c.phone = '0544444401'
order by o.created_at desc limit 2;`;
const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }),
});
console.log(r.status, await r.text());
