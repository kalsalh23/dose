-- إدارة الفئات: صورة للفئة + دوال CRUD + إظهار الصورة في الكتالوج
alter table public.categories add column if not exists image_url text not null default '';

create or replace function public.admin_list_categories(p_token uuid)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(x order by x.sort_order, x.id), '[]'::jsonb) from (
    select c.id, c.slug, c.name_ar, c.emoji, c.image_url, c.sort_order,
      (select count(*) from public.products p where p.category_id = c.id) as product_count
    from public.categories c
  ) x where public._valid_admin(p_token) and public._is_owner(p_token);
$function$;

create or replace function public.admin_save_category(p_token uuid, p_category jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_id integer; v_name text; v_slug text; v_emoji text; v_image text; v_sort integer; v_n integer := 0;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;
  v_name := btrim(coalesce(p_category->>'name_ar', ''));
  if v_name = '' then raise exception 'name_required'; end if;
  v_emoji := coalesce(nullif(btrim(p_category->>'emoji'), ''), '☕');
  v_image := coalesce(p_category->>'image_url', '');
  v_sort := coalesce((p_category->>'sort_order')::int, 0);

  if (p_category->>'id')::int > 0 then
    v_id := (p_category->>'id')::int;
    if not exists (select 1 from public.categories c where c.id = v_id) then raise exception 'category_not_found'; end if;
    update public.categories set name_ar = v_name, emoji = v_emoji, image_url = v_image, sort_order = v_sort
    where id = v_id;
    select slug into v_slug from public.categories where id = v_id;
  else
    v_slug := btrim(regexp_replace(lower(coalesce(nullif(btrim(p_category->>'slug'), ''), v_name)), '[\s/\\]+', '-', 'g'));
    if v_slug = '' then v_slug := 'cat'; end if;
    while exists (select 1 from public.categories c where c.slug = v_slug) loop
      v_n := v_n + 1;
      v_slug := v_slug || '-' || v_n;
    end loop;
    insert into public.categories (slug, name_ar, emoji, image_url, sort_order)
    values (v_slug, v_name, v_emoji, v_image,
            case when (p_category->>'sort_order')::int > 0 then (p_category->>'sort_order')::int
                 else (select coalesce(max(sort_order), 0) + 1 from public.categories) end)
    returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'slug', v_slug);
end
$function$;

create or replace function public.admin_delete_category(p_token uuid, p_id integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_slug text;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;
  if exists (select 1 from public.products p where p.category_id = p_id) then
    raise exception 'category_has_products';
  end if;
  select slug into v_slug from public.categories where id = p_id;
  if v_slug is null then raise exception 'category_not_found'; end if;
  delete from public.categories where id = p_id;
  return jsonb_build_object('ok', true);
end
$function$;

-- إظهار صورة الفئة في الكتالوج
create or replace function public.get_catalog()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'categories', (select coalesce(jsonb_agg(x order by x.sort_order), '[]'::jsonb) from (
        select c.id, c.slug, c.name_ar, c.emoji, c.image_url, c.sort_order
        from public.categories c) x),
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
        from public.rewards where is_active and (expires_at is null or expires_at > now())) x),
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