-- إصلاح استدعاء pg_net: المخطط الصحيح هو net وليس extensions.net
-- مع تمرير رقم الطلب للدالة للتحقق اللاحق
create or replace function public.create_order(
  p_customer_id uuid,
  p_pin text,
  p_fulfillment_type text,
  p_items jsonb,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_map_url text default null,
  p_source text default 'kiosk'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.customers;
  o public.orders;
  v_total integer := 0; v_points integer := 0; v_count integer := 0;
  it jsonb; pid integer; prod public.products; v_qty integer; v_opt text;
  award_now boolean;
begin
  if p_fulfillment_type not in ('pickup','delivery') then raise exception 'invalid_fulfillment'; end if;
  if p_fulfillment_type = 'delivery' and (p_latitude is null or p_longitude is null) then raise exception 'location_required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'invalid_order'; end if;

  select * into c from public.customers where id = p_customer_id;
  if c is null then raise exception 'customer_not_found'; end if;
  perform public._check_pin(c, p_pin);

  for it in select * from jsonb_array_elements(p_items) loop
    pid := (it->>'product_id')::integer;
    v_qty := (it->>'qty')::int;
    v_opt := coalesce(it->>'options','');
    select * into prod from public.products where id = pid and is_active;
    if prod is null then raise exception 'invalid_product'; end if;
    if v_qty < 1 or v_qty > 50 then raise exception 'invalid_qty'; end if;
    v_total := v_total + prod.price_cents * v_qty;
    v_points := v_points + prod.points * v_qty;
    v_count := v_count + v_qty;
  end loop;
  if v_count > 50 then raise exception 'invalid_order'; end if;

  insert into public.orders (customer_id, fulfillment_type, delivery_latitude, delivery_longitude, delivery_map_url, total_cents, total_points, source)
  values (c.id, p_fulfillment_type, p_latitude, p_longitude, p_map_url, v_total, v_points, p_source)
  returning * into o;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into prod from public.products where id = (it->>'product_id')::integer;
    insert into public.order_items (order_id, product_id, name_ar, name_en, unit_price_cents, qty, points, options)
    values (o.id, prod.id, prod.name_ar, prod.name_en, prod.price_cents, (it->>'qty')::int, prod.points, coalesce(it->>'options',''));
  end loop;

  update public.customers set orders_count = orders_count + 1 where id = c.id;

  perform public._notify(c.id, '☕ تم تسجيل طلبك بنجاح', 'طلب رقم #' || o.order_number || ' — ' ||
    case p_fulfillment_type when 'delivery' then 'توصيل' else 'استلام من المحل' end, 'order');

  award_now := public._get_setting('points_award_mode', 'on_complete') = 'on_create';
  if award_now then
    perform public._award_points(c.id, v_points, o.id, 'order#' || o.order_number);
    update public.orders set points_awarded = true where id = o.id;
  end if;

  -- إشعار فوري لهاتف العميل (pg_net — غير متزامن)
  begin
    perform net.http_post(
      url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer anon'),
      body := jsonb_build_object('customer_id', c.id, 'title', '☕ تم تسجيل طلبك بنجاح', 'body', 'طلب رقم #' || o.order_number)
    );
  exception when others then null;
  end;

  return jsonb_build_object(
    'order_id', o.id, 'order_number', o.order_number,
    'total_cents', v_total, 'total_points', v_points,
    'customer_name', c.full_name, 'customer_phone', c.phone,
    'awarded_now', award_now,
    'created_at', o.created_at
  );
end $$;

create or replace function public.admin_set_order_status(p_token uuid, p_order_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders; c public.customers; bal integer; titles jsonb := jsonb_build_object(
  'confirmed','✅ تم تأكيد طلبك','preparing','👨‍🍳 طلبك قيد التحضير','ready','☕ طلبك جاهز','completed','✅ تم إكمال طلبك','cancelled','❌ تم إلغاء طلبك');
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if p_status not in ('pending','confirmed','preparing','ready','completed','cancelled') then raise exception 'invalid_status'; end if;
  select * into o from public.orders where id = p_order_id;
  if o is null then raise exception 'not_found'; end if;
  if o.status = p_status then return jsonb_build_object('ok', true); end if;

  update public.orders set status = p_status where id = o.id returning * into o;

  if p_status = 'completed' and not o.points_awarded then
    perform public._award_points(o.customer_id, o.total_points, o.id, 'order#' || o.order_number);
    update public.orders set points_awarded = true where id = o.id;
    select points into bal from public.customers where id = o.customer_id;
    perform public._notify(o.customer_id, '✅ تم إكمال طلبك',
      '⭐ حصلت على ' || o.total_points || ' نقطة' || ' — رصيدك الحالي: ' || bal || ' نقطة', 'order');
  elsif p_status = 'cancelled' and o.points_awarded then
    perform public._award_points(o.customer_id, -o.total_points, o.id, 'cancel#' || o.order_number);
    update public.orders set points_awarded = false where id = o.id;
    perform public._notify(o.customer_id, '❌ تم إلغاء طلبك', 'طلب رقم #' || o.order_number, 'order');
  elsif titles ? p_status then
    perform public._notify(o.customer_id, titles->>p_status, 'طلب رقم #' || o.order_number, 'order');
  end if;

  begin
    perform net.http_post(
      url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer anon'),
      body := jsonb_build_object('customer_id', o.customer_id, 'title', coalesce(titles->>p_status, 'تحديث الطلب'), 'body', 'طلب رقم #' || o.order_number)
    );
  exception when others then null;
  end;

  return jsonb_build_object('ok', true);
end $$;

create or replace function public.redeem_reward(p_token uuid, p_reward_id integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  vc public.customers; r public.rewards; new_code text; i integer := 0;
begin
  select cust.* into vc from public.customers cust
    join public.customer_sessions s on s.customer_id = cust.id where s.token = p_token;
  if vc is null then raise exception 'unauthorized'; end if;
  select * into r from public.rewards where id = p_reward_id and is_active;
  if r is null then raise exception 'invalid_reward'; end if;
  if vc.points < r.points_cost then raise exception 'insufficient_points'; end if;

  loop
    i := i + 1;
    new_code := upper(substr(replace(md5(random()::text || clock_timestamp()::text), '-', ''), 1, 6));
    begin
      insert into public.reward_redemptions (code, customer_id, reward_id, reward_name, points_cost)
      values (new_code, vc.id, r.id, r.name_ar, r.points_cost);
      exit;
    exception when unique_violation then
      if i > 5 then raise exception 'code_generation_failed'; end if;
    end;
  end loop;

  update public.customers set points = points - r.points_cost where id = vc.id;
  insert into public.points_transactions (customer_id, reward_id, delta, reason)
  values (vc.id, r.id, -r.points_cost, 'redemption:' || new_code);

  perform public._notify(vc.id, '🎁 تم استبدال المكافأة بنجاح',
    r.name_ar || ' — الكود: ' || new_code, 'reward');

  begin
    perform net.http_post(
      url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer anon'),
      body := jsonb_build_object('customer_id', vc.id, 'title', '🎁 تم استبدال المكافأة بنجاح', 'body', r.name_ar || ' — الكود: ' || new_code)
    );
  exception when others then null;
  end;

  return jsonb_build_object('code', new_code, 'reward_name', r.name_ar,
    'points_cost', r.points_cost, 'status', 'unused',
    'remaining_points', vc.points - r.points_cost);
end $$;

-- اختبار إطلاق مباشر
select net.http_post(
  url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
  headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer anon'),
  body := jsonb_build_object('customer_id', '21b26760-7b5e-4f81-bc2d-7c9566573546', 'title', '🔔 اختبار إشعار Dose', 'body', 'إذا وصل هذا الإشعار فالنظام يعمل')
) as request_id;
