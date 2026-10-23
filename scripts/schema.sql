-- ============================================================
-- Dose Coffee & More — Kiosk Loyalty Schema
-- يُنفَّذ عبر Supabase Management API
-- الجداول محمية بـ RLS (لا وصول مباشر من anon) — الوصول فقط عبر دوال RPC
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  phone       text not null unique,
  pin_hash    text not null,
  device_id   text,
  points      integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  order_number  bigint generated always as identity,
  customer_id   uuid not null references public.customers(id) on delete cascade,
  items         jsonb not null default '[]'::jsonb,
  total_points  integer not null default 0,
  status        text not null default 'new',
  created_at    timestamptz not null default now()
);

create index if not exists orders_customer_idx on public.orders (customer_id, created_at desc);

-- قفل الجداول المباشر
alter table public.customers enable row level security;
alter table public.orders    enable row level security;
revoke all on public.customers from anon, authenticated;
revoke all on public.orders    from anon, authenticated;

-- إنشاء حساب جديد (يرفض الأرقام المسجلة مسبقًا)
create or replace function public.create_customer(
  p_full_name text, p_phone text, p_pin_hash text, p_device_id text default null
)
returns public.customers
language plpgsql security definer set search_path = public as $$
declare c public.customers;
begin
  if p_full_name is null or length(btrim(p_full_name)) < 2 then raise exception 'invalid_name'; end if;
  if p_phone is null or length(btrim(p_phone)) < 8 or length(btrim(p_phone)) > 15 then raise exception 'invalid_phone'; end if;
  if p_pin_hash is null or length(p_pin_hash) <> 64 then raise exception 'invalid_pin'; end if;
  insert into public.customers (full_name, phone, pin_hash, device_id)
  values (btrim(p_full_name), btrim(p_phone), p_pin_hash, p_device_id)
  on conflict (phone) do nothing
  returning * into c;
  if c is null then raise exception 'phone_exists'; end if;
  return c;
end $$;

-- التحقق من الهوية (هاتف + PIN) — يُستخدم عند تأكيد الطلب
create or replace function public.verify_customer(p_phone text, p_pin_hash text)
returns public.customers
language sql security definer set search_path = public as $$
  select * from public.customers
  where phone = btrim(p_phone) and pin_hash = p_pin_hash
  limit 1;
$$;

-- تسجيل طلب + إضافة النقاط في عملية واحدة
create or replace function public.create_order(
  p_customer_id uuid, p_items jsonb, p_total_points integer
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders; bal integer;
begin
  if p_total_points is null or p_total_points <= 0 then raise exception 'invalid_order'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'invalid_order'; end if;
  insert into public.orders (customer_id, items, total_points)
  values (p_customer_id, p_items, p_total_points)
  returning * into o;
  update public.customers
  set points = points + p_total_points
  where id = p_customer_id
  returning points into bal;
  return jsonb_build_object(
    'order_id', o.id,
    'order_number', o.order_number,
    'earned', o.total_points,
    'balance', bal
  );
end $$;

grant execute on function public.create_customer(text, text, text, text) to anon;
grant execute on function public.verify_customer(text, text)            to anon;
grant execute on function public.create_order(uuid, jsonb, integer)     to anon;

-- اقتراح الأسماء أثناء الكتابة (مع تمييز مبهم لآخر أرقام الهاتف)
drop function if exists public.search_customers(text);
create or replace function public.search_customers(p_query text)
returns table (id uuid, full_name text, mask text)
language sql security definer set search_path = public as $$
  select c.id, c.full_name, '••• ' || right(c.phone, 3) as mask
  from public.customers c
  where btrim(p_query) <> '' and c.full_name ilike '%' || btrim(p_query) || '%'
  order by c.full_name asc
  limit 8;
$$;

-- التحقق من رمز PIN عبر معرف العميل (يُحسب الهاش داخل القاعدة)
create or replace function public.verify_pin_by_id(p_customer_id uuid, p_pin text)
returns table (id uuid, full_name text)
language sql security definer set search_path = public as $$
  select c.id, c.full_name
  from public.customers c
  where c.id = p_customer_id
    and c.pin_hash = encode(extensions.digest(btrim(c.phone) || ':' || btrim(p_pin), 'sha256'), 'hex')
  limit 1;
$$;

grant execute on function public.search_customers(text)       to anon;
grant execute on function public.verify_pin_by_id(uuid, text) to anon;
