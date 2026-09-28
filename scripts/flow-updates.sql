-- ============================================================
-- تدفق الطلب المحدّث: تحقق PIN منفصل + رمز خصم (طلب مجاني) + صلاحية الرمز أسبوعًا
-- ============================================================

-- 1) تحقق PIN منفصل (قبل تأكيد الطلب) — مع نفس حماية التخمين
create or replace function public.verify_customer_pin(p_customer_id uuid, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.customers;
begin
  select * into c from public.customers where id = p_customer_id;
  if c is null then raise exception 'customer_not_found'; end if;
  perform public._check_pin(c, p_pin);
  return jsonb_build_object('ok', true, 'full_name', c.full_name);
end $$;
grant execute on function public.verify_customer_pin(uuid, text) to anon;

-- 2) صلاحية رمز المكافأة: أسبوع من لحظة الاستبدال
alter table public.reward_redemptions add column if not exists expires_at timestamptz not null default now() + interval '7 days';

-- 3) رمز الخصم للكشك: فحص الصلاحية
create or replace function public.check_reward_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.reward_redemptions;
begin
  select * into r from public.reward_redemptions where code = upper(btrim(p_code));
  if r is null then return jsonb_build_object('valid', false, 'reason', 'الرمز غير موجود'); end if;
  if r.status <> 'unused' then return jsonb_build_object('valid', false, 'reason', 'الرمز مستخدم سابقًا'); end if;
  if r.expires_at < now() then return jsonb_build_object('valid', false, 'reason', 'انتهت صلاحية الرمز (أسبوع)'); end if;
  return jsonb_build_object('valid', true, 'reward_name', r.reward_name, 'code', r.code);
end $$;
grant execute on function public.check_reward_code(text) to anon;

-- 4) create_order مع رمز الخصم (الطلب مجاني + استهلاك الرمز)
drop function if exists public.create_order(uuid, text, text, jsonb, double precision, double precision, text, text);
create or replace function public.create_order(
  p_customer_id uuid,
  p_pin text,
  p_fulfillment_type text,
  p_items jsonb,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_map_url text default null,
  p_source text default 'kiosk',
  p_reward_code text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.customers;
  o public.orders;
  v_total integer := 0; v_points integer := 0; v_count integer := 0;
  it jsonb; pid integer; prod public.products; v_qty integer;
  award_now boolean; rc public.reward_redemptions; v_free boolean := false;
begin
  if p_fulfillment_type not in ('pickup','delivery') then raise exception 'invalid_fulfillment'; end if;
  if p_fulfillment_type = 'delivery' and (p_latitude is null or p_longitude is null) then raise exception 'location_required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'invalid_order'; end if;

  select * into c from public.customers where id = p_customer_id;
  if c is null then raise exception 'customer_not_found'; end if;
  perform public._check_pin(c, p_pin);

  -- رمز الخصم: يجب أن يكون صالحًا (غير مستخدم وضمن الأسبوع)
  if p_reward_code is not null and btrim(p_reward_code) <> '' then
    select * into rc from public.reward_redemptions where code = upper(btrim(p_reward_code));
    if rc is null then raise exception 'invalid_code'; end if;
    if rc.status <> 'unused' then raise exception 'code_used'; end if;
    if rc.expires_at < now() then raise exception 'code_expired'; end if;
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    pid := (it->>'product_id')::integer;
    v_qty := (it->>'qty')::int;
    select * into prod from public.products where id = pid and is_active;
    if prod is null then raise exception 'invalid_product'; end if;
    if v_qty < 1 or v_qty > 50 then raise exception 'invalid_qty'; end if;
    v_total := v_total + prod.price_cents * v_qty;
    v_points := v_points + prod.points * v_qty;
    v_count := v_count + v_qty;
  end loop;
  if v_count > 50 then raise exception 'invalid_order'; end if;

  -- تطبيق الرمز: الطلب مجاني بالكامل
  if p_reward_code is not null and btrim(p_reward_code) <> '' then
    v_total := 0;
    v_free := true;
  end if;

  insert into public.orders (customer_id, fulfillment_type, delivery_latitude, delivery_longitude, delivery_map_url, total_cents, total_points, source)
  values (c.id, p_fulfillment_type, p_latitude, p_longitude, p_map_url, v_total, v_points, p_source)
  returning * into o;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into prod from public.products where id = (it->>'product_id')::integer;
    insert into public.order_items (order_id, product_id, name_ar, name_en, unit_price_cents, qty, points, options)
    values (o.id, prod.id, prod.name_ar, prod.name_en, prod.price_cents, (it->>'qty')::int, prod.points, coalesce(it->>'options',''));
  end loop;

  -- استهلاك رمز الخصم
  if v_free then
    update public.reward_redemptions
    set status = 'used', used_at = now()
    where code = upper(btrim(p_reward_code)) and status = 'unused';
    perform public._notify(c.id, '🎁 تم استخدام رمز الخصم',
      'طلب رقم #' || o.order_number || ' مجانًا — الرمز: ' || upper(btrim(p_reward_code)), 'reward');
  end if;

  update public.customers set orders_count = orders_count + 1 where id = c.id;

  perform public._notify(c.id, '☕ تم تسجيل طلبك بنجاح', 'طلب رقم #' || o.order_number || ' — ' ||
    case p_fulfillment_type when 'delivery' then 'توصيل' else 'استلام من المحل' end, 'order');

  award_now := public._get_setting('points_award_mode', 'on_complete') = 'on_create';
  if award_now then
    perform public._award_points(c.id, v_points, o.id, 'order#' || o.order_number);
    update public.orders set points_awarded = true where id = o.id;
  end if;

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
    'total_cents', v_total, 'total_points', v_points, 'free', v_free,
    'customer_name', c.full_name, 'customer_phone', c.phone,
    'awarded_now', award_now,
    'created_at', o.created_at
  );
end $$;
grant execute on function public.create_order(uuid, text, text, jsonb, double precision, double precision, text, text, text) to anon;

-- 5) استبدال المكافأة: تنبيه صلاحية أسبوع داخل المحل حصرًا
create or replace function public.redeem_reward(p_token uuid, p_reward_id integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  vc public.customers; r public.rewards; new_code text; i integer := 0;
  exp timestamptz;
begin
  select cust.* into vc from public.customers cust
    join public.customer_sessions s on s.customer_id = cust.id where s.token = p_token;
  if vc is null then raise exception 'unauthorized'; end if;
  select * into r from public.rewards where id = p_reward_id and is_active;
  if r is null then raise exception 'invalid_reward'; end if;
  if vc.points < r.points_cost then raise exception 'insufficient_points'; end if;

  exp := now() + interval '7 days';

  loop
    i := i + 1;
    new_code := upper(substr(replace(md5(random()::text || clock_timestamp()::text), '-', ''), 1, 6));
    begin
      insert into public.reward_redemptions (code, customer_id, reward_id, reward_name, points_cost, expires_at)
      values (new_code, vc.id, r.id, r.name_ar, r.points_cost, exp);
      exit;
    exception when unique_violation then
      if i > 5 then raise exception 'code_generation_failed'; end if;
    end;
  end loop;

  update public.customers set points = points - r.points_cost where id = vc.id;
  insert into public.points_transactions (customer_id, reward_id, delta, reason)
  values (vc.id, r.id, -r.points_cost, 'redemption:' || new_code);

  perform public._notify(vc.id, '🎁 تم استبدال المكافأة بنجاح',
    r.name_ar || ' — الكود: ' || new_code || ' — الرمز صالح أسبوعًا واحدًا فقط للاستخدام داخل المحل حصرًا', 'reward');

  begin
    perform net.http_post(
      url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer anon'),
      body := jsonb_build_object('customer_id', vc.id, 'title', '🎁 تم استبدال المكافأة بنجاح',
        'body', r.name_ar || ' — الكود: ' || new_code || ' — صالح أسبوعًا فقط داخل المحل حصرًا')
    );
  exception when others then null;
  end;

  return jsonb_build_object('code', new_code, 'reward_name', r.name_ar,
    'points_cost', r.points_cost, 'status', 'unused', 'expires_at', exp,
    'remaining_points', vc.points - r.points_cost);
end $$;
