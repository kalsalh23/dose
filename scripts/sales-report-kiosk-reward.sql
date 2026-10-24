-- ????? ????? ????????: ????? ???????? ????? ???????? ??????? ?? ?????
drop function if exists public.admin_sales_report(uuid, date, date);
create or replace function public.admin_sales_report(p_token uuid, p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_from date; v_to date;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;
  v_from := least(p_from, p_to);
  v_to := greatest(p_from, p_to);
  if v_to - v_from > 366 then v_from := v_to - 366; end if;

  return jsonb_build_object(
    'from', v_from,
    'to', v_to,
    'daily', (select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb) from (
      with days as (select generate_series(v_from, v_to, interval '1 day')::date as day),
      live as (
        select (coalesce(o.completed_at, o.created_at) at time zone 'Asia/Damascus')::date as day,
               sum(o.total_cents)::int as total_cents,
               count(*)::int as orders_count,
               count(*) filter (where o.source = 'kiosk')::int as kiosk_orders,
               count(*) filter (where o.source = 'kiosk' and o.total_cents = 0)::int as kiosk_reward_orders
        from public.orders o
        where o.status in ('ready','completed')
          and (coalesce(o.completed_at, o.created_at) at time zone 'Asia/Damascus')::date between v_from and v_to
        group by 1
      )
      select d.day,
             (coalesce(l.total_cents, 0) + coalesce(s.total_cents, 0))::int as total_cents,
             (coalesce(l.orders_count, 0) + coalesce(s.orders_count, 0))::int as orders_count,
             coalesce(l.kiosk_orders, 0) as kiosk_orders,
             coalesce(l.kiosk_reward_orders, 0) as kiosk_reward_orders
      from days d
      left join live l on l.day = d.day
      left join public.sales_daily s on s.day = d.day
    ) x),
    'totals', (select jsonb_build_object(
        'total', coalesce(sum(x.total_cents), 0),
        'orders', coalesce(sum(x.orders_count), 0),
        'kiosk', coalesce(sum(x.kiosk_orders), 0),
        'kiosk_rewards', coalesce(sum(x.kiosk_reward_orders), 0),
        'days', count(x.day),
        'avg_per_day', coalesce(round(sum(x.total_cents)::numeric / greatest(count(x.day), 1)), 0)::int,
        'avg_per_order', coalesce(round(sum(x.total_cents)::numeric / greatest(sum(x.orders_count), 1)), 0)::int
      ) from (
      with days as (select generate_series(v_from, v_to, interval '1 day')::date as day),
      live as (
        select (coalesce(o.completed_at, o.created_at) at time zone 'Asia/Damascus')::date as day,
               sum(o.total_cents)::int as total_cents,
               count(*)::int as orders_count,
               count(*) filter (where o.source = 'kiosk')::int as kiosk_orders,
               count(*) filter (where o.source = 'kiosk' and o.total_cents = 0)::int as kiosk_reward_orders
        from public.orders o
        where o.status in ('ready','completed')
          and (coalesce(o.completed_at, o.created_at) at time zone 'Asia/Damascus')::date between v_from and v_to
        group by 1
      )
      select d.day,
             (coalesce(l.total_cents, 0) + coalesce(s.total_cents, 0))::int as total_cents,
             (coalesce(l.orders_count, 0) + coalesce(s.orders_count, 0))::int as orders_count,
             coalesce(l.kiosk_orders, 0) as kiosk_orders,
             coalesce(l.kiosk_reward_orders, 0) as kiosk_reward_orders
      from days d
      left join live l on l.day = d.day
      left join public.sales_daily s on s.day = d.day
    ) x),
    'products', (select coalesce(jsonb_agg(y order by y.revenue_cents desc), '[]'::jsonb) from (
      select coalesce(i.name_ar, '??? ?????') as name_ar,
             sum(i.qty)::int as qty,
             sum(i.qty * i.unit_price_cents)::int as revenue_cents
      from public.orders o join public.order_items i on i.order_id = o.id
      where o.status in ('ready','completed')
        and (coalesce(o.completed_at, o.created_at) at time zone 'Asia/Damascus')::date between v_from and v_to
      group by 1
    ) y),
    'orders', (select coalesce(jsonb_agg(z order by z.created_at desc), '[]'::jsonb) from (
      select o.id, o.order_number, o.source, o.total_cents, o.status,
             o.created_at, o.customer_name, o.customer_phone,
             (o.total_cents = 0 and o.source = 'kiosk') as is_reward
      from public.orders o
      where o.status in ('ready','completed')
        and (coalesce(o.completed_at, o.created_at) at time zone 'Asia/Damascus')::date between v_from and v_to
      limit 500
    ) z)
  );
end
$$;
grant execute on function public.admin_sales_report(uuid, date, date) to anon;
