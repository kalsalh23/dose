-- إضافة عمود وقت التوصيل المقدر للطلبات
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_delivery_at timestamp with time zone;

-- تحديث admin_set_order_status لقبول وحفظ ETA
CREATE OR REPLACE FUNCTION public.admin_set_order_status(p_token uuid, p_order_id uuid, p_status text, p_eta_minutes integer DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  o public.orders; bal integer; was_completed boolean;
  titles jsonb := jsonb_build_object(
    'confirmed','✅ تم تأكيد طلبك','preparing','👨‍🍳 طلبك قيد التحضير',
    'ready','مكتمل','out_for_delivery','🛵 طلبك في الطريق إليك!','completed','✅ تم إكمال طلبك','cancelled','❌ تم إلغاء طلبك');
  v_eta timestamp with time zone;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if p_status not in ('pending','confirmed','preparing','ready','out_for_delivery','completed','cancelled') then raise exception 'invalid_status'; end if;
  select * into o from public.orders where id = p_order_id;
  if o is null then raise exception 'not_found'; end if;
  if o.status = p_status then return jsonb_build_object('ok', true); end if;

  -- حساب ETA عند الانتقال إلى preparing
  if p_status = 'preparing' and p_eta_minutes is not null and p_eta_minutes > 0 then
    v_eta := now() + (p_eta_minutes || ' minutes')::interval;
    update public.orders set status = p_status, estimated_delivery_at = v_eta where id = o.id returning * into o;
  else
    update public.orders set status = p_status where id = o.id returning * into o;
  end if;

  was_completed := o.completed_at is not null;
  if p_status in ('completed','cancelled') and o.completed_at is null then
    update public.orders set completed_at = now() where id = o.id returning * into o;
  end if;
  if p_status = 'completed' and not was_completed then
    perform public._record_sales(o.id, true);
  elsif p_status = 'cancelled' and was_completed then
    perform public._record_sales(o.id, false);
  end if;

  if p_status = 'completed' and not o.points_awarded then
    perform public._award_points(o.customer_id, o.total_points, o.id, 'order#' || o.order_number);
    update public.orders set points_awarded = true where id = o.id;
    select points into bal from public.customers where id = o.customer_id;
    perform public._notify(o.customer_id, '✅ تم إكمال طلبك',
      '⭐ حصلت على ' || o.total_points || ' نقطة — رصيدك الحالي: ' || bal || ' نقطة', 'order');
    begin
      perform net.http_post(
        url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
        body := jsonb_build_object('customer_id', o.customer_id, 'title', '✅ تم إكمال طلبك',
          'body', '⭐ حصلت على ' || o.total_points || ' نقطة — رصيدك الحالي: ' || bal || ' نقطة'));
    exception when others then null;
    end;
  elsif p_status = 'cancelled' and o.points_awarded then
    perform public._award_points(o.customer_id, -o.total_points, o.id, 'cancel#' || o.order_number);
    update public.orders set points_awarded = false where id = o.id;
    perform public._notify(o.customer_id, '❌ تم إلغاء طلبك', 'طلب رقم #' || o.order_number, 'order');
    begin
      perform net.http_post(
        url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
        body := jsonb_build_object('customer_id', o.customer_id, 'title', '❌ تم إلغاء طلبك', 'body', 'طلب رقم #' || o.order_number));
    exception when others then null;
    end;
  elsif titles ? p_status then
    perform public._notify(o.customer_id, titles->>p_status, 'طلب رقم #' || o.order_number, 'order');
    begin
      perform net.http_post(
        url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
        body := jsonb_build_object('customer_id', o.customer_id, 'title', titles->>p_status, 'body', 'طلب رقم #' || o.order_number));
    exception when others then null;
    end;
  end if;

  return jsonb_build_object('ok', true, 'estimated_delivery_at', o.estimated_delivery_at);
end $function$;

-- تحديث admin_list_orders لإرجاع ETA
CREATE OR REPLACE FUNCTION public.admin_list_orders(p_token uuid, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
    select o.id, o.order_number, o.status, o.fulfillment_type, o.total_cents, o.total_points, o.source, o.created_at,
           o.delivery_map_url, o.points_awarded, o.estimated_delivery_at,
           coalesce(o.customer_name, c.full_name) as customer_name, coalesce(o.customer_phone, c.phone) as customer_phone,
           (select coalesce(jsonb_agg(jsonb_build_object('name_ar', i.name_ar, 'qty', i.qty, 'unit_price_cents', i.unit_price_cents, 'options', i.options)), '[]'::jsonb)
            from public.order_items i where i.order_id = o.id) as items
    from public.orders o join public.customers c on c.id = o.customer_id
    order by o.created_at desc limit greatest(10, least(p_limit, 300))
  ) x
  where public._valid_admin(p_token);

$function$;

-- تحديث get_my_data لإرجاع ETA في الطلبات
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
               o.completed_at, o.points_awarded, o.source, o.customer_name, o.customer_phone, o.delivery_map_url, o.estimated_delivery_at,
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