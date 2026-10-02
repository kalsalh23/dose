-- المبيعات الدائمة + حذف الطلبات بعد يوم من الإكمال مع بقاء المبالغ محسوبة
-- 1) وقت إنهاء الطلب (إكمال/إلغاء) + جدول المبيعات اليومي الدائم
alter table public.orders add column if not exists completed_at timestamptz;
create table if not exists public.sales_daily (
  day date primary key,
  total_cents bigint not null default 0,
  orders_count integer not null default 0
);

-- 2) تسجيل/خصم مبيعات طلب (تُحدَّث بتوقيت دمشق)
create or replace function public._record_sales(p_order_id uuid, p_add boolean)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders; d date;
begin
  select * into o from public.orders where id = p_order_id;
  if o is null then return; end if;
  d := (coalesce(o.completed_at, now()) at time zone 'Asia/Damascus')::date;
  if p_add then
    insert into public.sales_daily (day, total_cents, orders_count) values (d, o.total_cents, 1)
    on conflict (day) do update set total_cents = public.sales_daily.total_cents + excluded.total_cents,
                                    orders_count = public.sales_daily.orders_count + 1;
  else
    insert into public.sales_daily (day, total_cents, orders_count) values (d, -o.total_cents, -1)
    on conflict (day) do update set total_cents = public.sales_daily.total_cents + excluded.total_cents,
                                    orders_count = public.sales_daily.orders_count - 1;
  end if;
end $$;

-- 3) ملخص المبيعات للوحة (اليوم / آخر 7 أيام / الشهر الحالي / آخر 14 يوم)
create or replace function public.admin_sales_summary(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare today date;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  today := (now() at time zone 'Asia/Damascus')::date;
  return jsonb_build_object(
    'today', (select jsonb_build_object('total', coalesce(sum(total_cents),0), 'count', coalesce(sum(orders_count),0)) from public.sales_daily where day = today),
    'week',  (select jsonb_build_object('total', coalesce(sum(total_cents),0), 'count', coalesce(sum(orders_count),0)) from public.sales_daily where day > today - 7),
    'month', (select jsonb_build_object('total', coalesce(sum(total_cents),0), 'count', coalesce(sum(orders_count),0)) from public.sales_daily where day >= date_trunc('month', today)),
    'daily', (select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb) from (
                select day, total_cents, orders_count from public.sales_daily where day > today - 15) x)
  );
end $$;
grant execute on function public.admin_sales_summary(uuid) to anon;

-- 4) حذف الطلبات المنتهية بعد يوم (كل ساعة) — بنود الطلب أولًا ثم الطلبات
select cron.unschedule(jobid) from cron.job where jobname = 'dose-orders-cleanup';
select cron.schedule('dose-orders-cleanup', '30 * * * *', $$
  delete from public.order_items where order_id in (
    select id from public.orders
    where status in ('completed','cancelled') and completed_at is not null and completed_at < now() - interval '1 day');
  delete from public.orders
  where status in ('completed','cancelled') and completed_at is not null and completed_at < now() - interval '1 day';
$$);

-- 5) ترحيل الطلبات المنتهية الحالية إلى المبيعات (لا تُفقد أي ليرة)
update public.orders set completed_at = created_at where status in ('completed','cancelled') and completed_at is null;
insert into public.sales_daily (day, total_cents, orders_count)
select (completed_at at time zone 'Asia/Damascus')::date, sum(total_cents)::bigint, count(*)::int
from public.orders where status = 'completed' and completed_at is not null
group by 1
on conflict (day) do update set total_cents = excluded.total_cents, orders_count = excluded.orders_count;
