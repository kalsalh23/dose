-- ============================================================
-- Dose Coffee & More — Full Platform Schema
-- customers / products / orders / rewards / notifications / admin …
-- كل الوصول من الواجهات عبر دوال RPC آمنة (security definer) مع RLS كامل
-- ملاحظة: آمن لإعادة التطبيق — لا يحذف أي بيانات
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- الجداول ----------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null unique,
  pin_hash text not null,
  device_id text,
  points integer not null default 0,
  orders_count integer not null default 0,
  pin_failed_attempts integer not null default 0,
  pin_locked_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.customers
  add column if not exists orders_count integer not null default 0,
  add column if not exists pin_failed_attempts integer not null default 0,
  add column if not exists pin_locked_until timestamptz,
  add column if not exists is_active boolean not null default true;

create table if not exists public.customer_sessions (
  token uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id serial primary key,
  slug text not null unique,
  name_ar text not null,
  emoji text not null default '☕',
  sort_order integer not null default 0
);

create table if not exists public.products (
  id serial primary key,
  category_id integer not null references public.categories(id) on delete cascade,
  name_ar text not null,
  name_en text not null default '',
  description_ar text not null default '',
  price_cents integer not null default 0,
  points integer not null default 0,
  image_url text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.rewards (
  id serial primary key,
  name_ar text not null,
  name_en text not null default '',
  image_url text not null default '',
  points_cost integer not null,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity (start with 1000),
  customer_id uuid not null references public.customers(id),
  fulfillment_type text not null default 'pickup' check (fulfillment_type in ('pickup','delivery')),
  delivery_latitude double precision,
  delivery_longitude double precision,
  delivery_map_url text,
  total_cents integer not null default 0,
  total_points integer not null default 0,
  status text not null default 'pending' check (status in ('pending','confirmed','preparing','ready','completed','cancelled')),
  source text not null default 'kiosk' check (source in ('kiosk','customer','admin')),
  points_awarded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists orders_customer_idx on public.orders (customer_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id integer references public.products(id),
  name_ar text not null,
  name_en text not null default '',
  unit_price_cents integer not null default 0,
  qty integer not null default 1,
  points integer not null default 0
);

create table if not exists public.points_transactions (
  id bigint generated always as identity primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  reward_id integer references public.rewards(id),
  delta integer not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.reward_redemptions (
  id bigint generated always as identity primary key,
  code text not null unique,
  customer_id uuid not null references public.customers(id),
  reward_id integer references public.rewards(id),
  reward_name text not null,
  points_cost integer not null,
  status text not null default 'unused' check (status in ('unused','used','expired')),
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  title text not null,
  body text not null default '',
  kind text not null default 'general',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_customer_idx on public.notifications (customer_id, created_at desc);

create table if not exists public.advertisements (
  id serial primary key,
  image_url text not null default '',
  title text not null,
  description_ar text not null default '',
  old_price_cents integer,
  new_price_cents integer,
  discount_percent integer,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  full_screen boolean not null default false
);

create table if not exists public.stores (
  id serial primary key,
  name text not null default 'Dose Coffee & More',
  phone text not null default '',
  whatsapp_number text not null default '',
  address text not null default '',
  is_default boolean not null default true
);

create table if not exists public.device_tokens (
  id bigint generated always as identity primary key,
  customer_id uuid references public.customers(id) on delete cascade,
  token text not null,
  platform text not null default 'web',
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id serial primary key,
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_sessions (
  token uuid primary key default gen_random_uuid(),
  admin_id integer not null references public.admin_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  key text primary key,
  value text not null
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer',
  created_at timestamptz not null default now()
);

-- ---------- قفل كل الجداول عن الوصول المباشر ----------
do $$
declare t text;
begin
  foreach t in array array['customers','customer_sessions','categories','products','rewards','orders','order_items',
                           'points_transactions','reward_redemptions','notifications','advertisements','stores',
                           'device_tokens','admin_users','admin_sessions','settings','profiles']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ============================================================
-- أدوات داخلية
-- ============================================================
create or replace function public._pin_hash(p_phone text, p_pin text)
returns text language sql immutable as $$
  select encode(extensions.digest(btrim(p_phone) || ':' || btrim(p_pin), 'sha256'), 'hex');
$$;

create or replace function public._get_setting(p_key text, p_default text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.settings where key = p_key), p_default);
$$;

create or replace function public._award_points(p_customer uuid, p_delta integer, p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.customers set points = points + p_delta where id = p_customer;
  insert into public.points_transactions (customer_id, order_id, delta, reason)
  values (p_customer, p_order, p_delta, p_reason);
end $$;

create or replace function public._notify(p_customer uuid, p_title text, p_body text, p_kind text default 'general')
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (customer_id, title, body, kind) values (p_customer, p_title, p_body, p_kind);
$$;

-- تحقق PIN مع حماية من التخمين (5 محاولات ثم قفل 5 دقائق)
create or replace function public._check_pin(p_customer public.customers, p_pin text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_customer.is_active is distinct from true then raise exception 'account_disabled'; end if;
  if p_customer.pin_locked_until is not null and p_customer.pin_locked_until > now() then
    raise exception 'pin_locked';
  end if;
  if p_customer.pin_hash = public._pin_hash(p_customer.phone, p_pin) then
    update public.customers set pin_failed_attempts = 0, pin_locked_until = null where id = p_customer.id;
    return true;
  else
    update public.customers
      set pin_failed_attempts = pin_failed_attempts + 1,
          pin_locked_until = case when pin_failed_attempts + 1 >= 5 then now() + interval '5 minutes' else pin_locked_until end
      where id = p_customer.id;
    raise exception 'wrong_pin';
  end if;
end $$;

create or replace function public._valid_admin(p_token uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admin_sessions s where s.token = p_token and s.created_at > now() - interval '12 hours');
$$;

-- ============================================================
-- RPCs عامة (anon)
-- ============================================================

-- الكتالوج الكامل للواجهات
create or replace function public.get_catalog()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'categories', (select coalesce(jsonb_agg(x order by x.sort_order), '[]'::jsonb) from (
        select id, slug, name_ar, emoji, sort_order from public.categories) x),
    'products', (select coalesce(jsonb_agg(x order by x.sort_order), '[]'::jsonb) from (
        select p.id, p.category_id, c.slug as category, p.name_ar, p.name_en, p.description_ar,
               p.price_cents, p.points, p.image_url, p.sort_order
        from public.products p join public.categories c on c.id = p.category_id
        where p.is_active) x),
    'rewards', (select coalesce(jsonb_agg(x order by x.sort_order), '[]'::jsonb) from (
        select id, name_ar, name_en, image_url, points_cost, sort_order from public.rewards where is_active) x),
    'ads', (select coalesce(jsonb_agg(x order by x.id), '[]'::jsonb) from (
        select id, image_url, title, description_ar, old_price_cents, new_price_cents, discount_percent, full_screen
        from public.advertisements
        where is_active and starts_at <= now() and (ends_at is null or ends_at >= now())) x),
    'settings', (select jsonb_object_agg(key, value) from public.settings)
  );
$$;

-- إنشاء حساب (الهاتف فريد، PIN يُخزن هاشًا)
create or replace function public.create_customer(p_full_name text, p_phone text, p_pin text, p_device_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.customers;
begin
  if length(btrim(p_full_name)) < 2 then raise exception 'invalid_name'; end if;
  if length(btrim(p_phone)) < 8 or length(btrim(p_phone)) > 15 then raise exception 'invalid_phone'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'invalid_pin'; end if;
  insert into public.customers (full_name, phone, pin_hash, device_id)
  values (btrim(p_full_name), btrim(p_phone), public._pin_hash(p_phone, p_pin), p_device_id)
  on conflict (phone) do nothing returning * into c;
  if c is null then raise exception 'phone_exists'; end if;
  perform public._notify(c.id, '☕ أهلًا بك في Dose', 'تم إنشاء حسابك بنجاح — اجمع النقاط مع كل طلب واستبدلها بمكافآت', 'welcome');
  return jsonb_build_object('id', c.id, 'full_name', c.full_name, 'phone', c.phone, 'points', c.points);
end $$;

-- اقتراح الأسماء للكشك
create or replace function public.search_customers(p_query text)
returns table (id uuid, full_name text, mask text) language sql security definer set search_path = public as $$
  select c.id, c.full_name, '••• ' || right(c.phone, 3)
  from public.customers c
  where c.is_active and btrim(p_query) <> '' and c.full_name ilike '%' || btrim(p_query) || '%'
  order by c.full_name asc limit 8;
$$;

-- دخول العميل من تطبيق الهاتف (هاتف + PIN) → جلسة
create or replace function public.customer_login(p_phone text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.customers; tok uuid;
begin
  select * into c from public.customers where phone = btrim(p_phone);
  if c is null then raise exception 'wrong_pin'; end if;
  perform public._check_pin(c, p_pin);
  insert into public.customer_sessions (customer_id) values (c.id) returning token into tok;
  return jsonb_build_object('token', tok, 'customer', jsonb_build_object(
    'id', c.id, 'full_name', c.full_name, 'phone', c.phone, 'points', c.points, 'orders_count', c.orders_count));
end $$;

create or replace function public.customer_logout(p_token uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.customer_sessions where token = p_token;
$$;

-- بيانات العميل الكاملة (جلسة موقعة)
create or replace function public.get_my_data(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'customer', (select jsonb_build_object('id', c.id, 'full_name', c.full_name, 'phone', c.phone,
                 'points', c.points, 'orders_count', c.orders_count)
                 from public.customers c join public.customer_sessions s on s.customer_id = c.id where s.token = p_token),
    'orders', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select o.id, o.order_number, o.status, o.fulfillment_type, o.total_cents, o.total_points, o.created_at,
               (select coalesce(jsonb_agg(jsonb_build_object('name_ar', i.name_ar, 'qty', i.qty, 'unit_price_cents', i.unit_price_cents)), '[]'::jsonb)
                from public.order_items i where i.order_id = o.id) as items
        from public.orders o join public.customer_sessions s2 on s2.customer_id = o.customer_id
        where s2.token = p_token) x),
    'redemptions', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select r.code, r.reward_name, r.points_cost, r.status, r.created_at
        from public.reward_redemptions r join public.customer_sessions s3 on s3.customer_id = r.customer_id
        where s3.token = p_token) x),
    'notifications', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select n.id, n.title, n.body, n.kind, n.is_read, n.created_at
        from public.notifications n join public.customer_sessions s4 on s4.customer_id = n.customer_id
        where s4.token = p_token order by n.created_at desc limit 50) x)
  );
$$;

create or replace function public.mark_notifications_read(p_token uuid)
returns void language sql security definer set search_path = public as $$
  update public.notifications n set is_read = true
  from public.customer_sessions s
  where s.customer_id = n.customer_id and s.token = p_token and n.is_read = false;
$$;

-- إنشاء طلب (كشك: تحقق PIN داخلي — تطبيق: تحقق PIN أيضًا لكل طلب)
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
  it jsonb; pid integer; prod public.products;
  award_now boolean;
begin
  if p_fulfillment_type not in ('pickup','delivery') then raise exception 'invalid_fulfillment'; end if;
  if p_fulfillment_type = 'delivery' and (p_latitude is null or p_longitude is null) then raise exception 'location_required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'invalid_order'; end if;

  select * into c from public.customers where id = p_customer_id;
  if c is null then raise exception 'customer_not_found'; end if;
  perform public._check_pin(c, p_pin);

  -- السعر والنقاط تُحسب من جدول المنتجات فقط (منع التلاعب)
  for it in select * from jsonb_array_elements(p_items) loop
    pid := (it->>'product_id')::integer;
    select * into prod from public.products where id = pid and is_active;
    if prod is null then raise exception 'invalid_product'; end if;
    if (it->>'qty')::int < 1 or (it->>'qty')::int > 50 then raise exception 'invalid_qty'; end if;
    v_total := v_total + prod.price_cents * (it->>'qty')::int;
    v_points := v_points + prod.points * (it->>'qty')::int;
    v_count := v_count + (it->>'qty')::int;
  end loop;
  if v_count > 50 then raise exception 'invalid_order'; end if;

  insert into public.orders (customer_id, fulfillment_type, delivery_latitude, delivery_longitude, delivery_map_url, total_cents, total_points, source)
  values (c.id, p_fulfillment_type, p_latitude, p_longitude, p_map_url, v_total, v_points, p_source)
  returning * into o;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into prod from public.products where id = (it->>'product_id')::integer;
    insert into public.order_items (order_id, product_id, name_ar, name_en, unit_price_cents, qty, points)
    values (o.id, prod.id, prod.name_ar, prod.name_en, prod.price_cents, (it->>'qty')::int, prod.points);
  end loop;

  update public.customers set orders_count = orders_count + 1 where id = c.id;

  perform public._notify(c.id, '☕ تم تسجيل طلبك بنجاح', 'طلب رقم #' || o.order_number || ' — ' ||
    case p_fulfillment_type when 'delivery' then 'توصيل' else 'استلام من المحل' end, 'order');

  award_now := public._get_setting('points_award_mode', 'on_complete') = 'on_create';
  if award_now then
    perform public._award_points(c.id, v_points, o.id, 'order#' || o.order_number);
    update public.orders set points_awarded = true where id = o.id;
  end if;

  return jsonb_build_object(
    'order_id', o.id, 'order_number', o.order_number,
    'total_cents', v_total, 'total_points', v_points,
    'customer_name', c.full_name, 'customer_phone', c.phone,
    'awarded_now', award_now,
    'created_at', o.created_at
  );
end $$;

-- استبدال نقاط مقابل مكافأة (معاملة واحدة)
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

  return jsonb_build_object('code', new_code, 'reward_name', r.name_ar,
    'points_cost', r.points_cost, 'status', 'unused',
    'remaining_points', vc.points - r.points_cost);
end $$;

-- ============================================================
-- RPCs الإدارة
-- ============================================================
create or replace function public.admin_login(p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.admin_users; tok uuid;
begin
  select * into a from public.admin_users where username = btrim(p_username);
  if a is null or a.password_hash <> encode(extensions.digest('dose:' || p_password, 'sha256'), 'hex') then
    raise exception 'bad_credentials';
  end if;
  insert into public.admin_sessions (admin_id) values (a.id) returning token into tok;
  return jsonb_build_object('token', tok, 'username', a.username);
end $$;

create or replace function public.admin_stats(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'customers', (select count(*) from public.customers),
    'orders', (select count(*) from public.orders),
    'active_orders', (select count(*) from public.orders where status in ('pending','confirmed','preparing','ready')),
    'completed_orders', (select count(*) from public.orders where status = 'completed'),
    'sales_cents', (select coalesce(sum(total_cents),0) from public.orders where status <> 'cancelled'),
    'points_outstanding', (select coalesce(sum(points),0) from public.customers),
    'points_earned', (select coalesce(sum(delta),0) from public.points_transactions where delta > 0),
    'redemptions', (select count(*) from public.reward_redemptions),
    'products', (select count(*) from public.products where is_active),
    'unread_notifications', (select count(*) from public.notifications where is_read = false)
  ) where public._valid_admin(p_token);
$$;

create or replace function public.admin_list_orders(p_token uuid, p_limit integer default 100)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
    select o.id, o.order_number, o.status, o.fulfillment_type, o.total_cents, o.total_points, o.source, o.created_at,
           o.delivery_map_url, o.points_awarded,
           c.full_name as customer_name, c.phone as customer_phone,
           (select coalesce(jsonb_agg(jsonb_build_object('name_ar', i.name_ar, 'qty', i.qty, 'unit_price_cents', i.unit_price_cents)), '[]'::jsonb)
            from public.order_items i where i.order_id = o.id) as items
    from public.orders o join public.customers c on c.id = o.customer_id
    order by o.created_at desc limit greatest(10, least(p_limit, 300))
  ) x
  where public._valid_admin(p_token);
$$;

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
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_list_products(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.sort_order, x.id), '[]'::jsonb) from (
    select p.*, c.slug as category_slug from public.products p join public.categories c on c.id = p.category_id
  ) x where public._valid_admin(p_token);
$$;

create or replace function public.admin_save_product(p_token uuid, p_product jsonb)
returns void language plpgsql security definer set search_path = public as $$
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
      is_active = coalesce((p_product->>'is_active')::boolean, true),
      sort_order = coalesce((p_product->>'sort_order')::int, 0)
    where id = (p_product->>'id')::int;
  else
    insert into public.products (category_id, name_ar, name_en, description_ar, price_cents, points, image_url, is_active, sort_order)
    values (cid, p_product->>'name_ar', coalesce(p_product->>'name_en',''), coalesce(p_product->>'description_ar',''),
            greatest(0,(p_product->>'price_cents')::int), greatest(0,(p_product->>'points')::int),
            coalesce(p_product->>'image_url',''), coalesce((p_product->>'is_active')::boolean,true),
            coalesce((p_product->>'sort_order')::int,0));
  end if;
end $$;

create or replace function public.admin_delete_product(p_token uuid, p_id integer)
returns void language sql security definer set search_path = public as $$
  update public.products set is_active = false where id = p_id and public._valid_admin(p_token);
$$;

create or replace function public.admin_list_customers(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
    select c.id, c.full_name, c.phone, c.points, c.orders_count, c.is_active, c.created_at,
           (select count(*) from public.reward_redemptions r where r.customer_id = c.id) as redemptions
    from public.customers c
  ) x where public._valid_admin(p_token);
$$;

create or replace function public.admin_toggle_customer(p_token uuid, p_customer_id uuid, p_active boolean)
returns void language sql security definer set search_path = public as $$
  update public.customers set is_active = p_active
  where id = p_customer_id and public._valid_admin(p_token);
$$;

create or replace function public.admin_list_rewards(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.sort_order, x.id), '[]'::jsonb) from (
    select r.*, (select count(*) from public.reward_redemptions x2 where x2.reward_id = r.id) as redemptions_count
    from public.rewards r
  ) x where public._valid_admin(p_token);
$$;

create or replace function public.admin_save_reward(p_token uuid, p_reward jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if (p_reward->>'id')::int > 0 then
    update public.rewards set
      name_ar = p_reward->>'name_ar', name_en = coalesce(p_reward->>'name_en',''),
      image_url = coalesce(p_reward->>'image_url',''),
      points_cost = greatest(1,(p_reward->>'points_cost')::int),
      is_active = coalesce((p_reward->>'is_active')::boolean, true),
      sort_order = coalesce((p_reward->>'sort_order')::int, 0)
    where id = (p_reward->>'id')::int;
  else
    insert into public.rewards (name_ar, name_en, image_url, points_cost, is_active, sort_order)
    values (p_reward->>'name_ar', coalesce(p_reward->>'name_en',''), coalesce(p_reward->>'image_url',''),
            greatest(1,(p_reward->>'points_cost')::int), coalesce((p_reward->>'is_active')::boolean,true),
            coalesce((p_reward->>'sort_order')::int,0));
  end if;
end $$;

create or replace function public.admin_delete_reward(p_token uuid, p_id integer)
returns void language sql security definer set search_path = public as $$
  update public.rewards set is_active = false where id = p_id and public._valid_admin(p_token);
$$;

create or replace function public.admin_list_redemptions(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
    select r.code, r.reward_name, r.points_cost, r.status, r.created_at, r.used_at, c.full_name as customer_name, c.phone as customer_phone
    from public.reward_redemptions r join public.customers c on c.id = r.customer_id
  ) x where public._valid_admin(p_token);
$$;

create or replace function public.admin_set_redemption_status(p_token uuid, p_code text, p_status text)
returns void language sql security definer set search_path = public as $$
  update public.reward_redemptions
  set status = p_status, used_at = case when p_status = 'used' then now() else used_at end
  where code = upper(btrim(p_code)) and p_status in ('unused','used','expired') and public._valid_admin(p_token);
$$;

create or replace function public.admin_send_notification(p_token uuid, p_title text, p_body text, p_customer_id uuid default null)
returns integer language sql security definer set search_path = public as $$
  with ins as (
    insert into public.notifications (customer_id, title, body, kind)
    select coalesce(p_customer_id, c.id), p_title, coalesce(p_body,''), 'admin'
    from public.customers c where c.is_active and (p_customer_id is null or c.id = p_customer_id)
    returning 1
  )
  select count(*) from ins where public._valid_admin(p_token);
$$;

create or replace function public.admin_list_ads(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.id desc), '[]'::jsonb) from (select * from public.advertisements) x
  where public._valid_admin(p_token);
$$;

create or replace function public.admin_save_ad(p_token uuid, p_ad jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if (p_ad->>'id')::int > 0 then
    update public.advertisements set
      image_url = coalesce(p_ad->>'image_url',''), title = p_ad->>'title',
      description_ar = coalesce(p_ad->>'description_ar',''),
      old_price_cents = nullif(p_ad->>'old_price_cents','')::int,
      new_price_cents = nullif(p_ad->>'new_price_cents','')::int,
      discount_percent = nullif(p_ad->>'discount_percent','')::int,
      starts_at = coalesce((p_ad->>'starts_at')::timestamptz, now()),
      ends_at = nullif(p_ad->>'ends_at','')::timestamptz,
      is_active = coalesce((p_ad->>'is_active')::boolean, true),
      full_screen = coalesce((p_ad->>'full_screen')::boolean, false)
    where id = (p_ad->>'id')::int;
  else
    insert into public.advertisements (image_url, title, description_ar, old_price_cents, new_price_cents, discount_percent, starts_at, ends_at, is_active, full_screen)
    values (coalesce(p_ad->>'image_url',''), p_ad->>'title', coalesce(p_ad->>'description_ar',''),
            nullif(p_ad->>'old_price_cents','')::int, nullif(p_ad->>'new_price_cents','')::int,
            nullif(p_ad->>'discount_percent','')::int,
            coalesce((p_ad->>'starts_at')::timestamptz, now()), nullif(p_ad->>'ends_at','')::timestamptz,
            coalesce((p_ad->>'is_active')::boolean,true), coalesce((p_ad->>'full_screen')::boolean,false));
  end if;
end $$;

create or replace function public.admin_delete_ad(p_token uuid, p_id integer)
returns void language sql security definer set search_path = public as $$
  delete from public.advertisements where id = p_id and public._valid_admin(p_token);
$$;

create or replace function public.admin_get_settings(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from public.settings where public._valid_admin(p_token);
$$;

create or replace function public.admin_save_settings(p_token uuid, p_settings jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare k text; v text;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  for k, v in select * from jsonb_each_text(p_settings) loop
    insert into public.settings (key, value) values (k, v)
    on conflict (key) do update set value = excluded.value;
  end loop;
end $$;

grant execute on function public.get_catalog() to anon;
grant execute on function public.create_customer(text, text, text, text) to anon;
grant execute on function public.search_customers(text) to anon;
grant execute on function public.customer_login(text, text) to anon;
grant execute on function public.customer_logout(uuid) to anon;
grant execute on function public.get_my_data(uuid) to anon;
grant execute on function public.mark_notifications_read(uuid) to anon;
grant execute on function public.create_order(uuid, text, text, jsonb, double precision, double precision, text, text) to anon;
grant execute on function public.redeem_reward(uuid, integer) to anon;
grant execute on function public.admin_login(text, text) to anon;

-- ============================================================
-- بيانات أولية
-- ============================================================
insert into public.categories (slug, name_ar, emoji, sort_order) values
  ('hot','القهوة الساخنة','☕',1),
  ('cold','المشروبات الباردة','🧊',2),
  ('dessert','الحلويات','🍰',3),
  ('extras','الإضافات','➕',4)
on conflict (slug) do nothing;

insert into public.stores (name, phone, whatsapp_number, address) values
  ('Dose Coffee & More','0952639157','963952639157','Dose Coffee & More')
on conflict do nothing;

insert into public.settings (key, value) values
  ('points_award_mode','on_complete'),
  ('whatsapp_number','963952639157'),
  ('store_phone','0952639157'),
  ('currency_symbol','€')
on conflict (key) do nothing;

insert into public.admin_users (username, password_hash) values
  ('admin','e62bdf9a90490023d41db9261fa14c7d008fb227c0ccfc0465e78c0c69726269')
on conflict (username) do nothing;

insert into public.products (category_id, name_ar, name_en, description_ar, price_cents, points, image_url, sort_order)
select c.id, v.name_ar, v.name_en, v.descr, v.price, v.pts, v.img, v.sort
from (values
  ('hot','إسبريسو','Espresso','إسبريسو مركّز من حبوب مختارة',200,2,'/img/espresso.jpg',1),
  ('hot','ماكياتو','Macchiato','إسبريسو مع لمسة حليب',300,3,'/img/macchiato.jpg',2),
  ('hot','أمريكانو','Americano','إسبريسو مع ماء ساخن',250,4,'/img/americano.jpg',3),
  ('hot','كابتشينو','Cappuccino','إسبريسو مع حليب مبخر ورغوة ناعمة',400,4,'/img/cappuccino.jpg',4),
  ('hot','لاتيه','Latte','إسبريسو مع حليب حريري',400,5,'/img/latte.jpg',5),
  ('hot','موكا','Mocha','إسبريسو مع شوكولاتة وحليب',450,6,'/img/mocha.jpg',6),
  ('hot','كراميل ماكياتو','Caramel Macchiato','لاتيه مع كراميل ذهبي',450,5,'/img/caramel-macchiato.jpg',7),
  ('cold','آيس لاتيه','Iced Latte','لاتيه بارد منعش',450,7,'/img/iced-latte.jpg',1),
  ('cold','آيس موكا','Iced Mocha','موكا بارد مع كريمة',450,7,'/img/iced-mocha.jpg',2),
  ('dessert','كيك الشوكولاتة','Chocolate Cake','كيكة شوكولاتة غنية',350,5,'/img/chocolate-cake.jpg',1),
  ('dessert','كيك الفانيليا','Vanilla Cake','كيكة فانيليا طرية',350,4,'/img/vanilla-cake.jpg',2),
  ('dessert','كوكيز','Cookies','كوكيز بالشوكولاتة طازج',250,3,'/img/cookies.jpg',3),
  ('extras','شوت إسبريسو إضافي','Extra Espresso Shot','شوت إسبريسو إضافي لطلبك',100,1,'/img/espresso.jpg',1),
  ('extras','كراميل إضافي','Extra Caramel','صوص كراميل إضافي',50,1,'/img/caramel-macchiato.jpg',2),
  ('extras','حليب إضافي','Extra Milk','حليب إضافي لطلبك',50,1,'/img/latte.jpg',3)
) as v(cat, name_ar, name_en, descr, price, pts, img, sort)
join public.categories c on c.slug = v.cat
where not exists (select 1 from public.products p where p.name_ar = v.name_ar);

insert into public.rewards (name_ar, name_en, image_url, points_cost, sort_order)
select v.name_ar, v.name_en, v.img, v.cost, v.sort
from (values
  ('كوكيز مجاني','Free Cookies','/img/cookies.jpg',30,1),
  ('كابتشينو مجاني','Free Cappuccino','/img/cappuccino.jpg',40,2),
  ('لاتيه مجاني','Free Latte','/img/latte.jpg',50,3),
  ('موكا مجاني','Free Mocha','/img/mocha.jpg',60,4),
  ('كيك الشوكولاتة مجاني','Free Chocolate Cake','/img/chocolate-cake.jpg',60,5),
  ('آيس لاتيه مجاني','Free Iced Latte','/img/iced-latte.jpg',70,6)
) as v(name_ar, name_en, img, cost, sort)
where not exists (select 1 from public.rewards r where r.name_ar = v.name_ar);

insert into public.advertisements (image_url, title, description_ar, old_price_cents, new_price_cents, discount_percent, is_active, full_screen)
select v.img, v.title, v.descr, v.old_p, v.new_p, v.disc, true, false
from (values
  ('/img/latte.jpg','عرض الصباح','لاتيه + كوكيز بسعر خاص',800,650,19),
  ('/img/iced-mocha.jpg','عرض المشروبات الباردة','آيس موكا بخصم 15%',450,380,15)
) as v(img, title, descr, old_p, new_p, disc)
where not exists (select 1 from public.advertisements a where a.title = v.title);
