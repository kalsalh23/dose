-- الدفعة 9: بلا PIN — إنشاء حساب بدون رمز، وتأكيد الطلب برقم الهاتف
-- 1) إنشاء الحساب: PIN اختياري (حسابات جديدة بلا PIN)
drop function if exists public.create_customer(text, text, text, text);
create or replace function public.create_customer(p_full_name text, p_phone text, p_pin text default null, p_device_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.customers;
begin
  if length(btrim(p_full_name)) < 2 then raise exception 'invalid_name'; end if;
  if length(btrim(p_phone)) < 8 or length(btrim(p_phone)) > 15 then raise exception 'invalid_phone'; end if;
  if p_pin is not null and btrim(p_pin) <> '' and p_pin !~ '^[0-9]{4}$' then raise exception 'invalid_pin'; end if;
  insert into public.customers (full_name, phone, pin_hash, device_id)
  values (btrim(p_full_name), btrim(p_phone),
          case when p_pin is not null and btrim(p_pin) <> '' then public._pin_hash(btrim(p_phone), p_pin) else null end,
          p_device_id)
  on conflict (phone) do nothing returning * into c;
  if c is null then raise exception 'phone_exists'; end if;
  perform public._notify(c.id, '☕ أهلًا بك في Dose', 'تم إنشاء حسابك بنجاح — اجمع النقاط مع كل طلب واستبدلها بمكافآت', 'welcome');
  return jsonb_build_object('id', c.id, 'full_name', c.full_name, 'phone', c.phone, 'points', c.points);
end $$;
grant execute on function public.create_customer(text, text, text, text) to anon;

-- 2) الدخول: الحساب بلا PIN يدخل برقم الهاتف وحده؛ الحساب القديم يتطلب PIN
drop function if exists public.customer_login(text, text);
create or replace function public.customer_login(p_phone text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.customers; tok uuid;
begin
  select * into c from public.customers where phone = btrim(p_phone);
  if c is null then raise exception 'wrong_pin'; end if;
  if c.pin_hash is not null then
    perform public._check_pin(c, p_pin);
  elsif c.is_active is distinct from true then
    raise exception 'account_disabled';
  end if;
  insert into public.customer_sessions (customer_id) values (c.id) returning token into tok;
  return jsonb_build_object('token', tok, 'customer', jsonb_build_object(
    'id', c.id, 'full_name', c.full_name, 'phone', c.phone, 'points', c.points, 'orders_count', c.orders_count));
end $$;
grant execute on function public.customer_login(text, text) to anon;

-- 3) الطلب: التأكيد برقم الهاتف (يطابق رقم الحساب) أو PIN القديم أو بلا تحقق لحساب بلا PIN
drop function if exists public.create_order(uuid, text, text, jsonb, double precision, double precision, text, text, text, text, text);
create or replace function public.create_order(
  p_customer_id uuid,
  p_pin text,
  p_fulfillment_type text,
  p_items jsonb,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_map_url text default null,
  p_source text default 'kiosk',
  p_reward_code text default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_confirm_phone text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.customers;
  o public.orders;
  v_total integer := 0; v_points integer := 0; v_count integer := 0;
  it jsonb; pid integer; prod public.products; v_qty integer;
  award_now boolean; rc public.reward_redemptions; v_free boolean := false; v_reward boolean := false;
  v_promo_pct int := 0; v_promo_subtotal int := 0; pc text; psc text; ptg text; ptg_cat int;
  v_add_json jsonb := '[]'::jsonb; a jsonb; aid int; aname text; aprice int;
  v_open text; v_close text; v_local text;
begin
  if p_fulfillment_type not in ('pickup','delivery') then raise exception 'invalid_fulfillment'; end if;
  if p_fulfillment_type = 'delivery' and (p_latitude is null or p_longitude is null) then raise exception 'location_required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'invalid_order'; end if;

  -- وقت الدوام: رفض الطلبات خارج ساعات العمل (بتوقيت دمشق)
  v_open := public._get_setting('work_open', '');
  v_close := public._get_setting('work_close', '');
  if v_open <> '' and v_close <> '' then
    v_local := to_char(now() at time zone 'Asia/Damascus', 'HH24:MI');
    if (v_open <= v_close and (v_local < v_open or v_local >= v_close))
       or (v_open > v_close and (v_local < v_open and v_local >= v_close)) then
      raise exception 'shop_closed';
    end if;
  end if;

  select * into c from public.customers where id = p_customer_id;
  if c is null then raise exception 'customer_not_found'; end if;
  -- تأكيد الهوية: رقم الهاتف المطابق (الجديد) أو PIN (للتوافق مع القديم)
  if p_confirm_phone is not null and btrim(p_confirm_phone) <> '' then
    if regexp_replace(c.phone, '\D', '', 'g') <> regexp_replace(btrim(p_confirm_phone), '\D', '', 'g') then
      raise exception 'phone_mismatch';
    end if;
  elsif p_pin is not null and btrim(p_pin) <> '' then
    perform public._check_pin(c, p_pin);
  elsif c.pin_hash is not null then
    raise exception 'pin_required';
  end if;

  if p_reward_code is not null and btrim(p_reward_code) <> '' then
    select * into rc from public.reward_redemptions where code = upper(btrim(p_reward_code));
    if FOUND then
      if rc.status <> 'unused' then raise exception 'code_used'; end if;
      if rc.expires_at is not null and rc.expires_at < now() then raise exception 'code_expired'; end if;
      v_reward := true;
    else
      pc := public._get_setting('promo_code', '');
      if btrim(p_reward_code) = btrim(pc) and btrim(pc) <> '' then
        v_promo_pct := coalesce(nullif(public._get_setting('promo_discount', ''), '')::int, 0);
        psc := public._get_setting('promo_scope', 'all');
        ptg := public._get_setting('promo_target', '');
        -- حل فئة الهدف قبل الحلقة حتى يُحسب المبلغ المشمول بالخصم صحيحًا
        if psc = 'category' then
          select id into ptg_cat from public.categories where slug = ptg;
          if ptg_cat is null then raise exception 'code_not_applicable'; end if;
        end if;
      else
        raise exception 'invalid_code';
      end if;
    end if;
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    pid := (it->>'product_id')::integer;
    v_qty := (it->>'qty')::int;
    select * into prod from public.products where id = pid and is_active;
    if prod is null then raise exception 'invalid_product'; end if;
    if prod.is_available = false then raise exception 'product_unavailable'; end if;
    if v_qty < 1 or v_qty > 50 then raise exception 'invalid_qty'; end if;
    v_total := v_total + coalesce(prod.sale_price_cents, prod.price_cents) * v_qty;
    v_points := v_points + prod.points * v_qty;
    v_count := v_count + v_qty;
    -- الإضافات المدفوعة: تحقق من تفعيلها وارتباطها بالمنتج ثم تسعيرها
    v_add_json := '[]'::jsonb;
    if jsonb_typeof(it->'additions') = 'array' then
      for a in select * from jsonb_array_elements(it->'additions') loop
        aid := null; aname := null; aprice := null;
        select ad.id, ad.name_ar, ad.price_cents into aid, aname, aprice
        from public.additions ad
        join public.addition_products ap on ap.addition_id = ad.id
        where ad.id = (a::text)::int and ad.is_active and ap.product_id = prod.id;
        if aid is not null then
          v_total := v_total + aprice * v_qty;
          v_add_json := v_add_json || jsonb_build_object('id', aid, 'name_ar', aname, 'price_cents', aprice);
        end if;
      end loop;
    end if;
    -- حساب المبلغ المشمول بالخصم حسب النطاق: كل الطلب / منتج محدد / فئة محددة
    if v_promo_pct > 0 then
      if psc = 'product' then
        if ptg <> '' and prod.id = ptg::int then
          v_promo_subtotal := v_promo_subtotal + coalesce(prod.sale_price_cents, prod.price_cents) * v_qty;
        end if;
      elsif psc = 'category' then
        if prod.category_id = ptg_cat then
          v_promo_subtotal := v_promo_subtotal + coalesce(prod.sale_price_cents, prod.price_cents) * v_qty;
        end if;
      else
        v_promo_subtotal := v_promo_subtotal + coalesce(prod.sale_price_cents, prod.price_cents) * v_qty;
      end if;
    end if;
  end loop;
  if v_count > 50 then raise exception 'invalid_order'; end if;

  if v_reward then
    v_total := 0; v_free := true;
  elsif v_promo_pct > 0 then
    if psc in ('product','category') and v_promo_subtotal = 0 then raise exception 'code_not_applicable'; end if;
    v_total := v_total - round(v_promo_subtotal * v_promo_pct / 100.0)::int;
  end if;

  insert into public.orders (customer_id, fulfillment_type, delivery_latitude, delivery_longitude, delivery_map_url, total_cents, total_points, source, customer_name, customer_phone)
  values (c.id, p_fulfillment_type, p_latitude, p_longitude, p_map_url, v_total, v_points, p_source,
          coalesce(btrim(p_customer_name), c.full_name), coalesce(btrim(p_customer_phone), c.phone))
  returning * into o;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into prod from public.products where id = (it->>'product_id')::integer;
    insert into public.order_items (order_id, product_id, name_ar, name_en, unit_price_cents, qty, points, options, additions)
    values (o.id, prod.id, prod.name_ar, prod.name_en, coalesce(prod.sale_price_cents, prod.price_cents), (it->>'qty')::int, prod.points, coalesce(it->>'options',''), v_add_json);
  end loop;

  if v_reward then
    update public.reward_redemptions set status = 'used', used_at = now() where code = upper(btrim(p_reward_code)) and status = 'unused';
    perform public._notify(c.id, '🎁 تم استخدام رمز الخصم',
      'طلب رقم #' || o.order_number || ' مجانًا — الرمز: ' || upper(btrim(p_reward_code)), 'reward');
  elsif v_promo_pct > 0 then
    perform public._notify(c.id, '🎉 تم تطبيق كود الخصم',
      'طلب رقم #' || o.order_number || ' — خصم ' || v_promo_pct || '%', 'reward');
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
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
      body := jsonb_build_object('admin', true, 'title', '🔔 طلب جديد #' || o.order_number,
        'body', coalesce(btrim(p_customer_name), c.full_name) || ' — ' || v_total || ' ل.س (' || case p_fulfillment_type when 'delivery' then 'توصيل' else 'استلام' end || ')'));
  exception when others then null;
  end;

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
    'promo_pct', v_promo_pct, 'promo_subtotal', v_promo_subtotal,
    'customer_name', coalesce(btrim(p_customer_name), c.full_name), 'customer_phone', coalesce(btrim(p_customer_phone), c.phone),
    'awarded_now', award_now,
    'created_at', o.created_at
  );
end $$;
grant execute on function public.create_order(uuid, text, text, jsonb, double precision, double precision, text, text, text, text, text, text) to anon;
