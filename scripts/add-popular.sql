-- قسما «الأكثر مبيعًا» و«الأكثر طلبًا» في الكتالوج
-- الأكثر مبيعًا: أعلى كمية مباعة | الأكثر طلبًا: أكثر منتج تكرر في الطلبات
-- (يستثني الطلبات الملغاة)

create or replace function public.get_catalog()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'categories', (select coalesce(jsonb_agg(x order by x.sort_order), '[]'::jsonb) from (
        select id, slug, name_ar, emoji, sort_order from public.categories) x),
    'products', (select coalesce(jsonb_agg(x order by x.sort_order), '[]'::jsonb) from (
        select p.id, p.category_id, c.slug as category, p.name_ar, p.name_en, p.description_ar,
               p.price_cents, p.points, p.image_url, p.options, p.sort_order
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
        select id, image_url, title, description_ar, old_price_cents, new_price_cents, discount_percent, full_screen
        from public.advertisements
        where is_active and starts_at <= now() and (ends_at is null or ends_at >= now())) x),
    'settings', (select jsonb_object_agg(key, value) from public.settings)
  );
$$;

grant execute on function public.get_catalog() to anon;
