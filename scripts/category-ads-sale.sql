-- إعلانات موجّهة للفئات + سعر عرض لكل منتج (يُمشَّط القديم ويُبرز الجديد بشارة «عرض»)
-- 1) أعمدة جديدة
alter table public.products add column if not exists sale_price_cents integer;
alter table public.advertisements add column if not exists category_slug text;

-- 2) get_catalog: يُرجع سعر العرض وسلوق إعلان الفئة
create or replace function public.get_catalog()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'categories', (select coalesce(jsonb_agg(x order by x.sort_order), '[]'::jsonb) from (
        select c.id, c.slug, c.name_ar, c.emoji, c.sort_order
        from public.categories c
        where exists (select 1 from public.products p where p.category_id = c.id and p.is_active)) x),
    'products', (select coalesce(jsonb_agg(x order by x.sort_order), '[]'::jsonb) from (
        select p.id, p.category_id, c.slug as category, p.name_ar, p.name_en, p.description_ar,
               p.price_cents, p.sale_price_cents, p.points, p.image_url, p.options, p.sort_order, p.is_available
        from public.products p join public.categories c on c.id = p.category_id
        where p.is_active) x),
    'best_sellers', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select p.id, p.name_ar, p.name_en, p.price_cents, p.sale_price_cents, p.points, p.image_url,
               sum(i.qty)::int as sold_qty
        from public.order_items i
        join public.orders o on o.id = i.order_id and o.status <> 'cancelled'
        join public.products p on p.id = i.product_id and p.is_active
        group by p.id, p.name_ar, p.name_en, p.price_cents, p.sale_price_cents, p.points, p.image_url
        order by sold_qty desc, p.id
        limit 6) x),
    'most_ordered', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select p.id, p.name_ar, p.name_en, p.price_cents, p.sale_price_cents, p.points, p.image_url,
               count(distinct i.order_id)::int as order_count
        from public.order_items i
        join public.orders o on o.id = i.order_id and o.status <> 'cancelled'
        join public.products p on p.id = i.product_id and p.is_active
        group by p.id, p.name_ar, p.name_en, p.price_cents, p.sale_price_cents, p.points, p.image_url
        order by order_count desc, p.id
        limit 6) x),
    'rewards', (select coalesce(jsonb_agg(x order by x.sort_order), '[]'::jsonb) from (
        select id, name_ar, name_en, image_url, points_cost, sort_order from public.rewards where is_active) x),
    'ads', (select coalesce(jsonb_agg(x order by x.id), '[]'::jsonb) from (
        select id, image_url, title, description_ar, old_price_cents, new_price_cents, discount_percent,
               full_screen, show_in_hero, category_slug
        from public.advertisements
        where is_active and starts_at <= now() and (ends_at is null or ends_at >= now())) x),
    'settings', (select jsonb_object_agg(key, value) from public.settings)
  );
$$;
grant execute on function public.get_catalog() to anon;

-- 3) admin_save_product: يحفظ سعر العرض أيضًا
create or replace function public.admin_save_product(p_token uuid, p_product jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid integer;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  select id into cid from public.categories where slug = coalesce(p_product->>'category_slug','hot');
  if cid is null then raise exception 'invalid_category'; end if;
  if (p_product->>'id')::int > 0 then
    update public.products set
      category_id = cid, name_ar = p_product->>'name_ar', name_en = coalesce(p_product->>'name_en',''),
      description_ar = coalesce(p_product->>'description_ar',''),
      price_cents = greatest(0,(p_product->>'price_cents')::int),
      points = greatest(0,(p_product->>'points')::int),
      image_url = coalesce(p_product->>'image_url',''),
      options = coalesce(p_product->>'options',''),
      is_active = coalesce((p_product->>'is_active')::boolean, true),
      is_available = coalesce((p_product->>'is_available')::boolean, true),
      sale_price_cents = nullif(p_product->>'sale_price_cents','')::int,
      sort_order = coalesce((p_product->>'sort_order')::int, 0)
    where id = (p_product->>'id')::int;
  else
    insert into public.products (category_id, name_ar, name_en, description_ar, price_cents, points, image_url, options, is_active, is_available, sale_price_cents, sort_order)
    values (cid, p_product->>'name_ar', coalesce(p_product->>'name_en',''), coalesce(p_product->>'description_ar',''),
            greatest(0,(p_product->>'price_cents')::int), greatest(0,(p_product->>'points')::int),
            coalesce(p_product->>'image_url',''), coalesce(p_product->>'options',''),
            coalesce((p_product->>'is_active')::boolean,true), coalesce((p_product->>'is_available')::boolean,true),
            nullif(p_product->>'sale_price_cents','')::int,
            coalesce((p_product->>'sort_order')::int,0));
  end if;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.admin_save_product(uuid, jsonb) to anon;

-- 4) زر «عرض»: تحديد/إزالة سعر العرض لمنتج
create or replace function public.admin_set_product_sale(p_token uuid, p_product_id int, p_sale_cents int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_price int;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  select price_cents into v_price from public.products where id = p_product_id;
  if v_price is null then raise exception 'invalid_product'; end if;
  if p_sale_cents is null or p_sale_cents <= 0 then
    update public.products set sale_price_cents = null where id = p_product_id;
    return jsonb_build_object('ok', true, 'sale', null);
  end if;
  if p_sale_cents >= v_price then raise exception 'sale_not_lower'; end if;
  update public.products set sale_price_cents = p_sale_cents where id = p_product_id;
  return jsonb_build_object('ok', true, 'sale', p_sale_cents);
end $$;
grant execute on function public.admin_set_product_sale(uuid, int, int) to anon;

-- 5) admin_save_ad: إعلان موجّه لفئة — العنوان يُشتق من اسم الفئة تلقائيًا، بلا أسعار
drop function if exists public.admin_save_ad(uuid, jsonb);
create or replace function public.admin_save_ad(p_token uuid, p_ad jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare new_id int; v_cat text; v_title text; v_body text;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  v_cat := coalesce(nullif(p_ad->>'category_slug',''), null);
  if v_cat is not null then
    select 'عروض ' || name_ar into v_title from public.categories where slug = v_cat;
    if v_title is null then raise exception 'invalid_category'; end if;
  else
    v_title := coalesce(nullif(p_ad->>'title',''), 'عرض خاص من Dose Cafe');
  end if;

  if (p_ad->>'id')::int > 0 then
    update public.advertisements set
      image_url = coalesce(p_ad->>'image_url',''), title = v_title,
      description_ar = coalesce(p_ad->>'description_ar',''),
      category_slug = v_cat,
      old_price_cents = null, new_price_cents = null, discount_percent = null,
      ends_at = nullif(p_ad->>'ends_at','')::timestamptz,
      is_active = coalesce((p_ad->>'is_active')::boolean, true),
      full_screen = coalesce((p_ad->>'full_screen')::boolean, false)
    where id = (p_ad->>'id')::int;
    return jsonb_build_object('ok', true, 'new', false);
  end if;

  insert into public.advertisements (image_url, title, description_ar, category_slug, old_price_cents, new_price_cents, discount_percent, starts_at, ends_at, is_active, full_screen, show_in_hero)
  values (coalesce(p_ad->>'image_url',''), v_title, coalesce(p_ad->>'description_ar',''),
          v_cat, null, null, null,
          now(), nullif(p_ad->>'ends_at','')::timestamptz,
          coalesce((p_ad->>'is_active')::boolean,true), coalesce((p_ad->>'full_screen')::boolean,false),
          coalesce((p_ad->>'show_in_hero')::boolean, true))
  returning id into new_id;

  -- إشعار داخلي وخارجي لكل الزبائن بأسلوب الفئة
  if v_cat is not null then
    select name_ar into v_body from public.categories where slug = v_cat;
    v_title := '📣 عروض جديدة على ' || v_body;
    v_body := coalesce(nullif(p_ad->>'description_ar',''), 'عروض خاصة على ' || v_body) || ' — اطلبها الآن من Dose Cafe!';
    insert into public.notifications (customer_id, title, body, kind)
    select c.id, v_title, v_body, 'admin' from public.customers c where c.is_active;
    begin
      perform net.http_post(
        url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
        body := jsonb_build_object('all', true, 'title', v_title, 'body', v_body));
    exception when others then null;
    end;
  end if;

  return jsonb_build_object('ok', true, 'new', true);
end $$;
grant execute on function public.admin_save_ad(uuid, jsonb) to anon;

-- 6) create_order: السعر الفعلي (سعر العرض إن وجد) في الإجمالي والخصم وبنود الطلب
-- إصلاح تطبيق كود الخصم على فئة/منتج محدد في create_order:
-- 1) حلّ فئة الهدف قبل حلقة الأصناف (كان يُقرأ ptg_cat قبل تعريفه فيفشل كود الفئة دائمًا)
-- 2) حماية تحويل معرّف المنتج من نص فارغ
-- 3) تبسيط تحقق ما بعد الحلقة: إن لم يشمل الطلب أي صنف مشمول بالخصم → code_not_applicable
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
    -- حساب المبلغ المشمول بالخصم حسب النطاق (كل الطلب / منتج محدد / فئة محددة)
    if v_promo_pct > 0 then
      if psc = 'product' then
        if ptg <> '' and prod.id = ptg::int then
          v_promo_subtotal := v_promo_subtotal + coalesce(prod.sale_price_cents, prod.price_cents) * v_qty;
        end if;
      elsif psc = 'category' and prod.category_id = ptg_cat then
        v_promo_subtotal := v_promo_subtotal + coalesce(prod.sale_price_cents, prod.price_cents) * v_qty;
      end if;
    end if;
  end loop;
  if v_count > 50 then raise exception 'invalid_order'; end if;

  if rc is not null then
    v_total := 0; v_free := true;
  elsif v_promo_pct > 0 then
    if psc in ('product','category') and v_promo_subtotal = 0 then raise exception 'code_not_applicable'; end if;
    v_total := v_total - round(v_promo_subtotal * v_promo_pct / 100.0)::int;
  end if;

  insert into public.orders (customer_id, fulfillment_type, delivery_latitude, delivery_longitude, delivery_map_url, total_cents, total_points, source)
  values (c.id, p_fulfillment_type, p_latitude, p_longitude, p_map_url, v_total, v_points, p_source)
  returning * into o;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into prod from public.products where id = (it->>'product_id')::integer;
    insert into public.order_items (order_id, product_id, name_ar, name_en, unit_price_cents, qty, points, options)
    values (o.id, prod.id, prod.name_ar, prod.name_en, coalesce(prod.sale_price_cents, prod.price_cents), (it->>'qty')::int, prod.points, coalesce(it->>'options',''));
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
