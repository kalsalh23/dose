// تنظيف بيانات اختبار التدفق والرمز
const token = process.env.SB_TOKEN;
const q = `delete from public.order_items where order_id in (select id from public.orders where customer_id in (select id from public.customers where phone='0544444401'));
delete from public.orders where customer_id in (select id from public.customers where phone='0544444401');
delete from public.reward_redemptions where customer_id in (select id from public.customers where phone='0544444401');
delete from public.points_transactions where customer_id in (select id from public.customers where phone='0544444401');
delete from public.notifications where customer_id in (select id from public.customers where phone='0544444401');
delete from public.customer_sessions where customer_id in (select id from public.customers where phone='0544444401');
delete from public.customers where phone='0544444401';
select full_name, phone from public.customers;
select count(*) as orders from public.orders;`;
const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }),
});
console.log(r.status, (await r.text()).slice(0, 500));
