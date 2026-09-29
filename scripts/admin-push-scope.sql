-- 1) إشعارات خارجية للوحة الإدارة (اشتراك الإدارة في Push)
alter table public.device_tokens alter column customer_id drop not null;
alter table public.device_tokens add column if not exists is_admin boolean not null default false;

create or replace function public.save_admin_push_subscription(p_token uuid, p_sub text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  delete from public.device_tokens where token = p_sub;
  insert into public.device_tokens (customer_id, token, platform, is_admin)
  values (null, p_sub, 'web-admin', true);
end $$;
grant execute on function public.save_admin_push_subscription(uuid, text) to anon;

-- 2) نطاق كود الخصم: كامل الطلب / منتج محدد / فئة محددة
drop function if exists public.admin_publish_promo(uuid, text, int);
create or replace function public.admin_publish_promo(p_token uuid, p_code text, p_discount int, p_scope text default 'all', p_target text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cnt int; v_title text; v_body text; v_scope text; target_name text;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if btrim(p_code) = '' then raise exception 'invalid_code'; end if;
  if p_discount is null or p_discount < 1 or p_discount > 90 then raise exception 'invalid_discount'; end if;
  v_scope := coalesce(p_scope, 'all');
  if v_scope not in ('all','product','category') then raise exception 'invalid_scope'; end if;
  if v_scope = 'product' and p_target is null then raise exception 'invalid_target'; end if;

  insert into public.settings (key, value) values ('promo_code', upper(btrim(p_code)))
  on conflict (key) do update set value = excluded.value;
  insert into public.settings (key, value) values ('promo_discount', p_discount::text)
  on conflict (key) do update set value = excluded.value;
  insert into public.settings (key, value) values ('promo_scope', v_scope)
  on conflict (key) do update set value = excluded.value;
  insert into public.settings (key, value) values ('promo_target', coalesce(p_target,''))
  on conflict (key) do update set value = excluded.value;

  v_scope := coalesce(p_scope,'all');
  if v_scope = 'product' then
    select name_ar into target_name from public.products where id = p_target::int;
    v_body := 'استخدم الكود ' || upper(btrim(p_code)) || ' واحصل على خصم ' || p_discount || '% على ' || coalesce(target_name,'منتج محدد');
  elsif v_scope = 'category' then
    select name_ar into target_name from public.categories where slug = p_target;
    v_body := 'استخدم الكود ' || upper(btrim(p_code)) || ' واحصل على خصم ' || p_discount || '% على كامل فئة ' || coalesce(target_name,'محددة');
  else
    v_body := 'استخدم الكود ' || upper(btrim(p_code)) || ' واحصل على خصم ' || p_discount || '% على طلبك كاملًا';
  end if;
  v_title := '🎁 كود خصم جديد من Dose Cafe';

  insert into public.notifications (customer_id, title, body, kind)
  select c.id, v_title, v_body, 'admin' from public.customers c where c.is_active;
  select count(*) into cnt from public.notifications where kind = 'admin' and title = v_title;

  begin
    perform net.http_post(
      url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
      body := jsonb_build_object('all', true, 'title', v_title, 'body', v_body));
  exception when others then null;
  end;

  return jsonb_build_object('ok', true, 'notified', cnt);
end $$;
grant execute on function public.admin_publish_promo(uuid, text, int, text, text) to anon;

drop function if exists public.admin_delete_promo(uuid);
create or replace function public.admin_delete_promo(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  delete from public.settings where key in ('promo_code','promo_discount','promo_scope','promo_target');
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.admin_delete_promo(uuid) to anon;

-- 3) فحص موحد يُرجع نطاق الكود
create or replace function public.check_reward_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.reward_redemptions; pc text; pd int; psc text; ptg text;
begin
  select * into r from public.reward_redemptions where code = upper(btrim(p_code));
  if r is not null then
    if r.status <> 'unused' then return jsonb_build_object('valid', false, 'reason', 'الرمز مستخدم سابقًا'); end if;
    if r.expires_at < now() then return jsonb_build_object('valid', false, 'reason', 'انتهت صلاحية الرمز (أسبوع)'); end if;
    return jsonb_build_object('valid', true, 'type', 'reward', 'reward_name', r.reward_name, 'code', r.code);
  end if;
  pc := public._get_setting('promo_code', '');
  pd := coalesce(nullif(public._get_setting('promo_discount', ''), '')::int, 0);
  psc := public._get_setting('promo_scope', 'all');
  ptg := public._get_setting('promo_target', '');
  if btrim(p_code) = btrim(pc) and btrim(pc) <> '' then
    return jsonb_build_object('valid', true, 'type', 'promo', 'discount_percent', pd, 'code', btrim(pc), 'scope', psc, 'target', ptg);
  end if;
  return jsonb_build_object('valid', false, 'reason', 'الرمز غير موجود');
end $$;

-- 4) create_order: الخصم حسب النطاق (كل الطلب / منتج / فئة)
drop function if exists public.create_order(uuid, text, text, jsonb, double precision, double precision, text, text, text);
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
  v_promo_pct int := 0; v_promo_subtotal int := 0; pc text; psc text; ptg text; ptg_cat int;
begin
  if p_fulfillment_type not in ('pickup','delivery') then raise exception 'invalid_fulfillment'; end if;
  if p_fulfillment_type = 'delivery' and (p_latitude is null or p_longitude is null) then raise exception 'location_required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'invalid_order'; end if;

  select * into c from public.customers where id = p_customer_id;
  if c is null then raise exception 'customer_not_found'; end if;
  perform public._check_pin(c, p_pin);

  if p_reward_code is not null and btrim(p_reward_code) <> '' then
    select * into rc from public.reward_redemptions where code = upper(btrim(p_reward_code));
    if rc is not null then
      if rc.status <> 'unused' then raise exception 'code_used'; end if;
      if rc.expires_at < now() then raise exception 'code_expired'; end if;
    else
      pc := public._get_setting('promo_code', '');
      if btrim(p_reward_code) = btrim(pc) and btrim(pc) <> '' then
        v_promo_pct := coalesce(nullif(public._get_setting('promo_discount', ''), '')::int, 0);
        psc := public._get_setting('promo_scope', 'all');
        ptg := public._get_setting('promo_target', '');
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
    if v_qty < 1 or v_qty > 50 then raise exception 'invalid_qty'; end if;
    v_total := v_total + prod.price_cents * v_qty;
    v_points := v_points + prod.points * v_qty;
    v_count := v_count + v_qty;
    -- حساب المبلغ المشمول بالخصم حسب النطاق
    if v_promo_pct > 0 then
      if psc = 'product' and prod.id = ptg::int then
        v_promo_subtotal := v_promo_subtotal + prod.price_cents * v_qty;
      elsif psc = 'category' and prod.category_id = ptg_cat then
        v_promo_subtotal := v_promo_subtotal + prod.price_cents * v_qty;
      end if;
    end if;
  end loop;
  if v_count > 50 then raise exception 'invalid_order'; end if;

  if rc is not null then
    v_total := 0; v_free := true;
  elsif v_promo_pct > 0 then
    if psc = 'product' and v_promo_subtotal = 0 then raise exception 'code_not_applicable'; end if;
    if psc = 'category' then
      select id into ptg_cat from public.categories where slug = ptg;
      if ptg_cat is null then raise exception 'code_not_applicable'; end if;
    end if;
    if psc = 'product' then
      ptg_cat := null;
    elsif psc = 'category' and v_promo_subtotal = 0 then
      raise exception 'code_not_applicable';
    end if;
    v_total := v_total - round(v_promo_subtotal * v_promo_pct / 100.0)::int;
  end if;

  insert into public.orders (customer_id, fulfillment_type, delivery_latitude, delivery_longitude, delivery_map_url, total_cents, total_points, source)
  values (c.id, p_fulfillment_type, p_latitude, p_longitude, p_map_url, v_total, v_points, p_source)
  returning * into o;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into prod from public.products where id = (it->>'product_id')::integer;
    insert into public.order_items (order_id, product_id, name_ar, name_en, unit_price_cents, qty, points, options)
    values (o.id, prod.id, prod.name_ar, prod.name_en, prod.price_cents, (it->>'qty')::int, prod.points, coalesce(it->>'options',''));
  end loop;

  if rc is not null then
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

  -- إشعار خارجي لأجهزة لوحة الإدارة
  begin
    perform net.http_post(
      url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
      body := jsonb_build_object('admin', true, 'title', '🔔 طلب جديد #' || o.order_number,
        'body', c.full_name || ' — ' || v_total || ' ل.س (' || case p_fulfillment_type when 'delivery' then 'توصيل' else 'استلام' end || ')'));
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
    'customer_name', c.full_name, 'customer_phone', c.phone,
    'awarded_now', award_now,
    'created_at', o.created_at
  );
end $$;
grant execute on function public.create_order(uuid, text, text, jsonb, double precision, double precision, text, text, text) to anon;
