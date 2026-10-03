-- دفعة التعديلات: إضافات مدفوعة + اسم/هاتف الطلب + صلاحية 10 أيام + جاري التوصيل + حذف المكافآت نهائيًا

-- (1) الإضافات المدفوعة
create table if not exists public.additions (
  id serial primary key,
  name_ar text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  is_active boolean not null default true
);
create table if not exists public.addition_products (
  addition_id integer not null references public.additions(id) on delete cascade,
  product_id integer not null references public.products(id) on delete cascade,
  primary key (addition_id, product_id)
);
alter table public.order_items add column if not exists additions jsonb not null default '[]';
-- أعمدة اسم/هاتف الطلب
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists customer_phone text;


drop function if exists public.admin_list_additions(uuid);
create or replace function public.admin_list_additions(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  return coalesce(jsonb_agg(x order by x.id), '[]'::jsonb) from (
    select a.id, a.name_ar, a.price_cents, a.is_active,
           (select coalesce(jsonb_agg(ap.product_id), '[]'::jsonb) from public.addition_products ap where ap.addition_id = a.id) as product_ids
    from public.additions a) x where public._valid_admin(p_token);
end $$;
grant execute on function public.admin_list_additions(uuid) to anon;

drop function if exists public.admin_save_addition(uuid, jsonb);
create or replace function public.admin_save_addition(p_token uuid, p_addition jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare aid int; pid int;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if btrim(coalesce(p_addition->>'name_ar','')) = '' then raise exception 'invalid_name'; end if;
  if (p_addition->>'id')::int > 0 then
    update public.additions set
      name_ar = btrim(p_addition->>'name_ar'),
      price_cents = greatest(0, coalesce((p_addition->>'price_cents')::int, 0)),
      is_active = coalesce((p_addition->>'is_active')::boolean, true)
    where id = (p_addition->>'id')::int
    returning id into aid;
    if aid is null then raise exception 'not_found'; end if;
    delete from public.addition_products where addition_id = aid;
  else
    insert into public.additions (name_ar, price_cents, is_active)
    values (btrim(p_addition->>'name_ar'), greatest(0, coalesce((p_addition->>'price_cents')::int, 0)),
            coalesce((p_addition->>'is_active')::boolean, true))
    returning id into aid;
  end if;
  for pid in select j::int from jsonb_array_elements_text(coalesce(p_addition->'product_ids', '[]'::jsonb)) j loop
    insert into public.addition_products (addition_id, product_id) values (aid, pid)
    on conflict do nothing;
  end loop;
  return jsonb_build_object('ok', true, 'id', aid);
end $$;
grant execute on function public.admin_save_addition(uuid, jsonb) to anon;

drop function if exists public.admin_delete_addition(uuid, int);
create or replace function public.admin_delete_addition(p_token uuid, p_addition_id int)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  delete from public.additions where id = p_addition_id;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.admin_delete_addition(uuid, int) to anon;

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
    'additions', (select coalesce(jsonb_agg(x order by x.id), '[]'::jsonb) from (
        select a.id, a.name_ar, a.price_cents,
               (select coalesce(jsonb_agg(ap.product_id), '[]'::jsonb) from public.addition_products ap where ap.addition_id = a.id) as product_ids
        from public.additions a where a.is_active) x),
    'settings', (select jsonb_object_agg(key, value) from public.settings)
  );
$$;
grant execute on function public.get_catalog() to anon;

drop function if exists public.create_order(uuid, text, text, jsonb, double precision, double precision, text, text, text);
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
  p_customer_phone text default null
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
  perform public._check_pin(c, p_pin);

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
    'customer_name', coalesce(btrim(p_customer_name), c.full_name), 'customer_phone', coalesce(btrim(p_customer_phone), c.phone),
    'awarded_now', award_now,
    'created_at', o.created_at
  );
end $$;
grant execute on function public.create_order(uuid, text, text, jsonb, double precision, double precision, text, text, text, text, text) to anon;

drop function if exists public.admin_set_order_status(uuid, uuid, text);
create or replace function public.admin_set_order_status(p_token uuid, p_order_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$

declare
  o public.orders; bal integer; was_completed boolean;
  titles jsonb := jsonb_build_object(
    'confirmed','✅ تم تأكيد طلبك','preparing','👨‍🍳 طلبك قيد التحضير',
    'ready','☕ طلبك جاهز','out_for_delivery','🛵 طلبك في الطريق إليك!','completed','✅ تم إكمال طلبك','cancelled','❌ تم إلغاء طلبك');
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if p_status not in ('pending','confirmed','preparing','ready','out_for_delivery','completed','cancelled') then raise exception 'invalid_status'; end if;
  select * into o from public.orders where id = p_order_id;
  if o is null then raise exception 'not_found'; end if;
  if o.status = p_status then return jsonb_build_object('ok', true); end if;

  update public.orders set status = p_status where id = o.id returning * into o;

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

  return jsonb_build_object('ok', true);
end 
$$;
grant execute on function public.admin_set_order_status(uuid, uuid, text) to anon;

drop function if exists public.redeem_reward(uuid, integer);
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

  exp := now() + interval '10 days';

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
end 
$$;
grant execute on function public.redeem_reward(uuid, integer) to anon;

create or replace function public.check_reward_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.reward_redemptions; pc text; pd int; psc text; ptg text;
begin
  select * into r from public.reward_redemptions where code = upper(btrim(p_code));
  if FOUND then
    if r.status <> 'unused' then return jsonb_build_object('valid', false, 'reason', 'الرمز مستخدم سابقًا'); end if;
    if r.expires_at is not null and r.expires_at < now() then return jsonb_build_object('valid', false, 'reason', 'انتهت صلاحية الرمز (10 أيام)'); end if;
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
grant execute on function public.check_reward_code(text) to anon;

-- حذف مكافأة نهائيًا مع فك الارتباطات
alter table public.reward_redemptions alter column reward_id drop not null;
alter table public.points_transactions alter column reward_id drop not null;
drop function if exists public.admin_delete_reward(uuid, integer);
create or replace function public.admin_delete_reward(p_token uuid, p_reward_id integer)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  update public.reward_redemptions set reward_id = null where reward_id = p_reward_id;
  update public.points_transactions set reward_id = null where reward_id = p_reward_id;
  delete from public.rewards where id = p_reward_id;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.admin_delete_reward(uuid, integer) to anon;

create or replace function public.admin_list_orders(p_token uuid, p_limit int default 50)
returns jsonb language sql stable security definer set search_path = public as $$

  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
    select o.id, o.order_number, o.status, o.fulfillment_type, o.total_cents, o.total_points, o.source, o.created_at,
           o.delivery_map_url, o.points_awarded,
           coalesce(o.customer_name, c.full_name) as customer_name, coalesce(o.customer_phone, c.phone) as customer_phone,
           (select coalesce(jsonb_agg(jsonb_build_object('name_ar', i.name_ar, 'qty', i.qty, 'unit_price_cents', i.unit_price_cents, 'options', i.options)), '[]'::jsonb)
            from public.order_items i where i.order_id = o.id) as items
    from public.orders o join public.customers c on c.id = o.customer_id
    order by o.created_at desc limit greatest(10, least(p_limit, 300))
  ) x
  where public._valid_admin(p_token);

$$;
grant execute on function public.admin_list_orders(uuid, int) to anon;

