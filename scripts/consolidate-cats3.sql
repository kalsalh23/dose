-- فصل منتجات الإضافات عن الطلبات القديمة ثم التنفيذ الكامل
update public.order_items set product_id = null
where product_id in (select p.id from public.products p join public.categories c on c.id = p.category_id where c.slug = 'extras');

insert into public.categories (slug, name_ar, emoji, sort_order) values
  ('hot_drinks','مشروبات ساخنة','☕',1),
  ('cold_drinks','مشروبات باردة','🧊',2),
  ('matcha_tea','ماتشا وشاي','🍵',3),
  ('fresh','مشروبات فريش','🥤',4)
on conflict (slug) do nothing;

update public.products set category_id = (select id from public.categories where slug='hot_drinks')
where category_id in (select id from public.categories where slug in ('hot','hotdrinks'));

update public.products set category_id = (select id from public.categories where slug='cold_drinks')
where category_id in (select id from public.categories where slug='cold');

update public.products set category_id = (select id from public.categories where slug='matcha_tea')
where category_id in (select id from public.categories where slug in ('matcha','icetea'));

update public.products set category_id = (select id from public.categories where slug='fresh')
where category_id in (select id from public.categories where slug in ('juices','smoothie','special'));

update public.categories set name_ar='موهيتو', emoji='🍹', sort_order=5 where slug='mojito';
update public.categories set name_ar='حلويات', emoji='🍰', sort_order=6 where slug='dessert';

update public.products set is_active = false
where category_id in (select id from public.categories where slug='extras');

delete from public.categories where slug in ('hot','hotdrinks','cold','matcha','icetea','juices','smoothie','special','extras');

create or replace function public.get_catalog()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'categories', (select coalesce(jsonb_agg(x order by x.sort_order), '[]'::jsonb) from (
        select c.id, c.slug, c.name_ar, c.emoji, c.sort_order
        from public.categories c
        where exists (select 1 from public.products p where p.category_id = c.id and p.is_active)) x),
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

select c.slug, c.name_ar, count(p.id) as cnt
from public.products p
join public.categories c on c.id = p.category_id
where p.is_active
group by c.slug, c.name_ar, c.sort_order
order by c.sort_order;
