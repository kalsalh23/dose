create or replace function public.admin_list_orders(p_token uuid, p_limit integer default 50)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
    select o.id, o.order_number, o.status, o.fulfillment_type, o.total_cents, o.total_points, o.source, o.created_at,
           o.delivery_map_url, o.points_awarded, o.estimated_delivery_at, o.eta_minutes,
           coalesce(o.customer_name, c.full_name) as customer_name, coalesce(o.customer_phone, c.phone) as customer_phone,
           (select coalesce(jsonb_agg(jsonb_build_object(
              'name_ar', i.name_ar, 'qty', i.qty, 'unit_price_cents', i.unit_price_cents,
              'options', i.options, 'additions', i.additions)), '[]'::jsonb)
            from public.order_items i where i.order_id = o.id) as items
    from public.orders o join public.customers c on c.id = o.customer_id
    order by o.created_at desc limit greatest(10, least(p_limit, 300))
  ) x
  where public._valid_admin(p_token);
$function$;