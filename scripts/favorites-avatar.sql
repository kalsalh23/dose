-- المفضلة + صورة الملف الشخصي

create table if not exists public.favorites (
  id bigint generated always as identity primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id integer not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (customer_id, product_id)
);
alter table public.favorites enable row level security;
revoke all on public.favorites from anon, authenticated;

alter table public.customers add column if not exists avatar_url text not null default '';

-- تبديل حالة المفضلة — يرجع true إذا أصبحت مفضلة
create or replace function public.toggle_favorite(p_token uuid, p_product_id integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare cid uuid; cnt integer;
begin
  select customer_id into cid from public.customer_sessions where token = p_token;
  if cid is null then raise exception 'unauthorized'; end if;
  select count(*) into cnt from public.favorites where customer_id = cid and product_id = p_product_id;
  if cnt > 0 then
    delete from public.favorites where customer_id = cid and product_id = p_product_id;
    return false;
  else
    insert into public.favorites (customer_id, product_id) values (cid, p_product_id);
    return true;
  end if;
end $$;

-- تحديث صورة الملف الشخصي
create or replace function public.update_avatar(p_token uuid, p_url text)
returns void language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select customer_id into cid from public.customer_sessions where token = p_token;
  if cid is null then raise exception 'unauthorized'; end if;
  update public.customers set avatar_url = left(btrim(p_url), 500) where id = cid;
end $$;

-- get_my_data مع المفضلة وصورة الملف
create or replace function public.get_my_data(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'customer', (select jsonb_build_object('id', c.id, 'full_name', c.full_name, 'phone', c.phone,
                 'points', c.points, 'orders_count', c.orders_count, 'avatar_url', c.avatar_url)
                 from public.customers c join public.customer_sessions s on s.customer_id = c.id where s.token = p_token),
    'favorites', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select p.id, p.name_ar, p.name_en, p.description_ar, p.price_cents, p.points, p.image_url, p.options, f.created_at
        from public.favorites f
        join public.products p on p.id = f.product_id
        join public.customer_sessions s2 on s2.customer_id = f.customer_id
        where s2.token = p_token) x),
    'orders', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select o.id, o.order_number, o.status, o.fulfillment_type, o.total_cents, o.total_points, o.created_at,
               (select coalesce(jsonb_agg(jsonb_build_object('name_ar', i.name_ar, 'qty', i.qty, 'unit_price_cents', i.unit_price_cents, 'options', i.options)), '[]'::jsonb)
                from public.order_items i where i.order_id = o.id) as items
        from public.orders o join public.customer_sessions s3 on s3.customer_id = o.customer_id
        where s3.token = p_token) x),
    'redemptions', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select r.code, r.reward_name, r.points_cost, r.status, r.created_at
        from public.reward_redemptions r join public.customer_sessions s4 on s4.customer_id = r.customer_id
        where s4.token = p_token) x),
    'notifications', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select n.id, n.title, n.body, n.kind, n.is_read, n.created_at
        from public.notifications n join public.customer_sessions s5 on s5.customer_id = n.customer_id
        where s5.token = p_token order by n.created_at desc limit 50) x)
  );
$$;

grant execute on function public.toggle_favorite(uuid, integer) to anon;
grant execute on function public.update_avatar(uuid, text) to anon;
