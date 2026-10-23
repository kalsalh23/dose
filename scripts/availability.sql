-- توفر المنتج: متوفر / غير متوفر (نفاد كمية)
-- 1) عمود جديد
alter table public.products add column if not exists is_available boolean not null default true;

-- 2) get_catalog يُرجع is_available
create or replace function public.get_catalog()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'categories', (select coalesce(jsonb_agg(x order by x.sort_order), '[]'::jsonb) from (
        select c.id, c.slug, c.name_ar, c.emoji, c.sort_order
        from public.categories c
        where exists (select 1 from public.products p where p.category_id = c.id and p.is_active)) x),
    'products', (select coalesce(jsonb_agg(x order by x.sort_order), '[]'::jsonb) from (
        select p.id, p.category_id, c.slug as category, p.name_ar, p.name_en, p.description_ar,
               p.price_cents, p.points, p.image_url, p.options, p.sort_order, p.is_available
        from public.products p join public.categories c on c.id = p.category_id
        where p.is_active) x),
    'best_sellers', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select p.id, p.name_ar, p.name_en, p.price_cents, p.points, p.image_url,
               sum(i.qty)::int as sold_qty
        from public.order_items i
        join public.orders o on o.id = i.order_id and o.status <> 'cancelled'
        join public.products p on p.id = i.product_id and p.is_active
        group by p.id, p.name_ar, p.name_en, p.price_cents, p.points, p.image_url
        order by sold_qty desc, p.id
        limit 6) x),
    'most_ordered', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select p.id, p.name_ar, p.name_en, p.price_cents, p.points, p.image_url,
               count(distinct i.order_id)::int as order_count
        from public.order_items i
        join public.orders o on o.id = i.order_id and o.status <> 'cancelled'
        join public.products p on p.id = i.product_id and p.is_active
        group by p.id, p.name_ar, p.name_en, p.price_cents, p.points, p.image_url
        order by order_count desc, p.id
        limit 6) x),
    'rewards', (select coalesce(jsonb_agg(x order by x.sort_order), '[]'::jsonb) from (
        select id, name_ar, name_en, image_url, points_cost, sort_order from public.rewards where is_active) x),
    'ads', (select coalesce(jsonb_agg(x order by x.id), '[]'::jsonb) from (
        select id, image_url, title, description_ar, old_price_cents, new_price_cents, discount_percent, full_screen, show_in_hero
        from public.advertisements
        where is_active and starts_at <= now() and (ends_at is null or ends_at >= now())) x),
    'settings', (select jsonb_object_agg(key, value) from public.settings)
  );
$$;
grant execute on function public.get_catalog() to anon;

-- 3) admin_save_product يحفظ is_available
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
      sort_order = coalesce((p_product->>'sort_order')::int, 0)
    where id = (p_product->>'id')::int;
  else
    insert into public.products (category_id, name_ar, name_en, description_ar, price_cents, points, image_url, options, is_active, is_available, sort_order)
    values (cid, p_product->>'name_ar', coalesce(p_product->>'name_en',''), coalesce(p_product->>'description_ar',''),
            greatest(0,(p_product->>'price_cents')::int), greatest(0,(p_product->>'points')::int),
            coalesce(p_product->>'image_url',''), coalesce(p_product->>'options',''),
            coalesce((p_product->>'is_active')::boolean,true), coalesce((p_product->>'is_available')::boolean,true),
            coalesce((p_product->>'sort_order')::int,0));
  end if;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.admin_save_product(uuid, jsonb) to anon;

-- 4) زر سريع: تبديل توفر منتج
create or replace function public.admin_set_product_availability(p_token uuid, p_product_id int, p_available boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  update public.products set is_available = p_available where id = p_product_id;
  return jsonb_build_object('ok', true, 'is_available', p_available);
end $$;
grant execute on function public.admin_set_product_availability(uuid, int, boolean) to anon;
