-- صلاحية النقاط: استخدام إعداد points_expire_days + تصفير تلقائي + عرض التاريخ
alter table public.customers add column if not exists points_expires_at timestamptz;

create or replace function public._award_points(p_customer uuid, p_delta integer, p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare d int;
begin
  select coalesce(nullif(value,'')::int, 15) into d from public.settings where key='points_expire_days';
  if d is null then d := 15; end if;
  update public.customers
  set points = points + p_delta,
      points_expires_at = case when p_delta > 0 then now() + (d || ' days')::interval else points_expires_at end
  where id = p_customer;
  insert into public.points_transactions (customer_id, order_id, delta, reason)
  values (p_customer, p_order, p_delta, p_reason);
end $$;

create or replace function public.reset_expired_points()
returns void language plpgsql security definer set search_path = public as $$
declare c record; lost int;
begin
  for c in
    select id, points, full_name from public.customers
    where points > 0 and points_expires_at is not null and points_expires_at < now()
  loop
    lost := c.points;
    update public.customers set points = 0, points_expires_at = null where id = c.id;
    insert into public.points_transactions (customer_id, delta, reason)
    values (c.id, -lost, 'انتهاء صلاحية النقاط');
  end loop;
end $$;

-- opportunistic reset inside get_my_data
create or replace function public.get_my_data(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cid uuid;
begin
  select customer_id into cid from public.customer_sessions where token = p_token;
  if cid is not null then
    perform public.reset_expired_points(); -- lightweight; resets all expired
  end if;
  return (select jsonb_build_object(
    'customer', (select jsonb_build_object('id', c.id, 'full_name', c.full_name, 'phone', c.phone,
                 'points', c.points, 'orders_count', c.orders_count, 'avatar_url', c.avatar_url,
                 'points_expires_at', c.points_expires_at)
                 from public.customers c where c.id = cid),
    'favorites', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select p.id, p.name_ar, p.name_en, p.description_ar, p.price_cents, p.points, p.image_url, p.options, f.created_at
        from public.favorites f
        join public.products p on p.id = f.product_id
        join public.customer_sessions s2 on s2.customer_id = f.customer_id
        where s2.token = p_token) x),
    'orders', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select o.id, o.order_number, o.status, o.fulfillment_type, o.total_cents, o.total_points, o.created_at,
               (select coalesce(jsonb_agg(jsonb_build_object('name_ar', i.name_ar, 'qty', i.qty, 'unit_price_cents', i.unit_price_cents, 'options', i.options)), '[]'::jsonb)
                from public.order_items i where i.order_id = o.id) as items
        from public.orders o join public.customer_sessions s3 on s3.customer_id = o.customer_id
        where s3.token = p_token
          and not (o.status = 'completed' and o.created_at < now() - interval '2 days')) x),
    'redemptions', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select r.code, r.reward_name, r.points_cost, r.status, r.expires_at, r.created_at
        from public.reward_redemptions r join public.customer_sessions s4 on s4.customer_id = r.customer_id
        where s4.token = p_token) x),
    'notifications', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select n.id, n.title, n.body, n.kind, n.is_read, n.created_at
        from public.notifications n join public.customer_sessions s5 on s5.customer_id = n.customer_id
        where s5.token = p_token order by n.created_at desc limit 50) x)
  ));
end $$;
