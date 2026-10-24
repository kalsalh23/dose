drop function if exists public.get_catalog();
create or replace function public.get_catalog()
returns jsonb language sql stable security definer set search_path = public as $function$
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
               count(distinct o.id)::int as order_count
        from public.order_items i
        join public.orders o on o.id = i.order_id and o.status <> 'cancelled'
        join public.products p on p.id = i.product_id and p.is_active
        group by p.id, p.name_ar, p.name_en, p.price_cents, p.sale_price_cents, p.points, p.image_url
        order by order_count desc, p.id
        limit 6) x),
    'rewards', (select coalesce(jsonb_agg(x order by x.sort_order), '[]'::jsonb) from (
        select id, name_ar, name_en, image_url, points_cost, sort_order, expires_at, redemption_days
        from public.rewards where is_active) x),
    'ads', (select coalesce(jsonb_agg(x order by x.id), '[]'::jsonb) from (
        select id, image_url, title, description_ar, old_price_cents, new_price_cents, discount_percent,
               full_screen, show_in_hero, popup_after_2min, category_slug
        from public.advertisements
        where is_active and starts_at <= now() and (ends_at is null or ends_at >= now())) x),
    'additions', (select coalesce(jsonb_agg(x order by x.id), '[]'::jsonb) from (
        select a.id, a.name_ar, a.price_cents,
               (select coalesce(jsonb_agg(ap.product_id), '[]'::jsonb) from public.addition_products ap where ap.addition_id = a.id) as product_ids
        from public.additions a where a.is_active) x),
    'menus', (select coalesce(jsonb_agg(x order by x.sort_order, x.id), '[]'::jsonb) from (
        select m.id, m.title, m.subtitle, m.image_url, m.emoji, m.sort_order, m.category_slug,
               (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', p.id, 'category', c.slug, 'name_ar', p.name_ar, 'name_en', p.name_en,
                    'description_ar', p.description_ar, 'price_cents', p.price_cents, 'sale_price_cents', p.sale_price_cents,
                    'points', p.points, 'image_url', p.image_url, 'options', p.options,
                    'sort_order', p.sort_order, 'is_available', p.is_available) order by mi.sort_order, mi.id), '[]'::jsonb)
                from public.menu_items mi
                join public.products p on p.id = mi.product_id and p.is_active
                join public.categories c on c.id = p.category_id
                where mi.menu_id = m.id) as items
        from public.menus m
        where m.is_active) x),
    'settings', (select jsonb_object_agg(key, value) from public.settings)
  )
$function$;
grant execute on function public.get_catalog() to anon;