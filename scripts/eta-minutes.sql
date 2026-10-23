-- عمود دقائق الوقت المقدر (حسب ما يُدخله المالك في اللوحة)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS eta_minutes integer;

-- تحديث admin_set_order_status ليحفظ الدقائق مع وقت الوصول
CREATE OR REPLACE FUNCTION public.admin_set_order_status(p_token uuid, p_order_id uuid, p_status text, p_eta_minutes integer DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  select * into o from public.orders where id = p_order_id;
  if o is null then raise exception 'not_found'; end if;
  if p_status = 'preparing' and p_eta_minutes is not null and p_eta_minutes > 0 then
    update public.orders
      set status = p_status,
          estimated_delivery_at = now() + (p_eta_minutes || ' minutes')::interval,
          eta_minutes = p_eta_minutes
      where id = o.id returning * into o;
  else
    update public.orders set status = p_status where id = o.id returning * into o;
  end if;
  return jsonb_build_object('ok', true, 'estimated_delivery_at', o.estimated_delivery_at, 'eta_minutes', o.eta_minutes);
end $function$;

-- تحديث حفظ الوقت المقدر ليحفظ الدقائق أيضًا
CREATE OR REPLACE FUNCTION public.admin_set_order_eta(p_token uuid, p_order_id uuid, p_eta_minutes integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; v_eta timestamp with time zone;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  select * into o from public.orders where id = p_order_id;
  if o is null then raise exception 'not_found'; end if;
  if p_eta_minutes is not null and p_eta_minutes > 0 then
    v_eta := now() + (p_eta_minutes || ' minutes')::interval;
    update public.orders set estimated_delivery_at = v_eta, eta_minutes = p_eta_minutes where id = o.id returning * into o;
  else
    update public.orders set estimated_delivery_at = null, eta_minutes = null where id = o.id returning * into o;
  end if;
  return jsonb_build_object('ok', true, 'estimated_delivery_at', o.estimated_delivery_at, 'eta_minutes', o.eta_minutes);
end $function$;

-- كشف الدقائق في قائمة طلبات اللوحة
CREATE OR REPLACE FUNCTION public.admin_list_orders(p_token uuid, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
    select o.id, o.order_number, o.status, o.fulfillment_type, o.total_cents, o.total_points, o.source, o.created_at,
           o.delivery_map_url, o.points_awarded, o.estimated_delivery_at, o.eta_minutes,
           coalesce(o.customer_name, c.full_name) as customer_name, coalesce(o.customer_phone, c.phone) as customer_phone,
           (select coalesce(jsonb_agg(jsonb_build_object('name_ar', i.name_ar, 'qty', i.qty, 'unit_price_cents', i.unit_price_cents, 'options', i.options)), '[]'::jsonb)
            from public.order_items i where i.order_id = o.id) as items
    from public.orders o join public.customers c on c.id = o.customer_id
    order by o.created_at desc limit greatest(10, least(p_limit, 300))
  ) x
  where public._valid_admin(p_token);
$function$;

-- كشف الدقائق في بيانات الزبون (تفاصيل الطلب)
CREATE OR REPLACE FUNCTION public.get_my_data(p_token uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'customer', (select jsonb_build_object('id', c.id, 'full_name', c.full_name, 'phone', c.phone,
                 'points', c.points, 'orders_count', c.orders_count, 'avatar_url', c.avatar_url,
                 'points_expires_at', c.points_expires_at)
                 from public.customers c join public.customer_sessions s on s.customer_id = c.id where s.token = p_token),
    'favorites', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select p.id, p.name_ar, p.name_en, p.description_ar, p.price_cents, p.points, p.image_url, p.options, f.created_at
        from public.favorites f
        join public.products p on p.id = f.product_id
        join public.customer_sessions s2 on s2.customer_id = f.customer_id
        where s2.token = p_token) x),
    'orders', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select o.id, o.order_number, o.status, o.fulfillment_type, o.total_cents, o.total_points, o.created_at,
               o.completed_at, o.points_awarded, o.source, o.customer_name, o.customer_phone, o.delivery_map_url,
               o.estimated_delivery_at, o.eta_minutes,
               (select coalesce(jsonb_agg(jsonb_build_object('name_ar', i.name_ar, 'qty', i.qty, 'unit_price_cents', i.unit_price_cents, 'options', i.options, 'additions', i.additions)), '[]'::jsonb)
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
        where s5.token = p_token order by n.created_at desc) x)
  )
$function$;