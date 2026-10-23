-- ============================================================
-- ميزة القوائم: قوائم مخصصة في التطبيق تُعبَّأ بالمنتجات
-- ============================================================

CREATE TABLE IF NOT EXISTS public.menus (
  id serial PRIMARY KEY,
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  emoji text NOT NULL DEFAULT '☕',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.menu_items (
  id serial PRIMARY KEY,
  menu_id integer NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  product_id integer REFERENCES public.products(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS menu_items_menu_idx ON public.menu_items(menu_id);

ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- قراءة للجميع (الكتالوج يعرض القوائم النشطة)
DROP POLICY IF EXISTS "menus read" ON public.menus;
CREATE POLICY "menus read" ON public.menus FOR SELECT USING (true);
DROP POLICY IF EXISTS "menu_items read" ON public.menu_items;
CREATE POLICY "menu_items read" ON public.menu_items FOR SELECT USING (true);

-- ============================================================
-- دوال الإدارة
-- ============================================================

-- قائمة القوائم مع منتجاتها
CREATE OR REPLACE FUNCTION public.admin_list_menus(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;
  return (
    select coalesce(jsonb_agg(x order by x.sort_order, x.id), '[]'::jsonb) from (
      select m.id, m.title, m.subtitle, m.image_url, m.emoji, m.is_active, m.sort_order, m.created_at,
             (select coalesce(jsonb_agg(mi.product_id order by mi.sort_order, mi.id) filter (where mi.product_id is not null), '[]'::jsonb)
              from public.menu_items mi where mi.menu_id = m.id) as product_ids
      from public.menus m
    ) x
  );
end $function$;

-- حفظ (إضافة/تعديل) قائمة مع منتجاتها
CREATE OR REPLACE FUNCTION public.admin_save_menu(p_token uuid, p_menu jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id integer;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;
  if btrim(coalesce(p_menu->>'title','')) = '' then raise exception 'title_required'; end if;

  if (p_menu->>'id')::int > 0 then
    v_id := (p_menu->>'id')::int;
    update public.menus set
      title = p_menu->>'title',
      subtitle = coalesce(p_menu->>'subtitle',''),
      image_url = coalesce(p_menu->>'image_url',''),
      emoji = coalesce(nullif(p_menu->>'emoji',''), '☕'),
      is_active = coalesce((p_menu->>'is_active')::boolean, true),
      sort_order = coalesce((p_menu->>'sort_order')::int, 0)
    where id = v_id;
  else
    insert into public.menus (title, subtitle, image_url, emoji, is_active, sort_order)
    values (p_menu->>'title', coalesce(p_menu->>'subtitle',''), coalesce(p_menu->>'image_url',''),
            coalesce(nullif(p_menu->>'emoji',''), '☕'),
            coalesce((p_menu->>'is_active')::boolean, true),
            coalesce((p_menu->>'sort_order')::int, 0))
    returning id into v_id;
  end if;

  -- إعادة تعيين عناصر القائمة
  delete from public.menu_items where menu_id = v_id;
  if p_menu->'product_ids' is not null then
    insert into public.menu_items (menu_id, product_id, sort_order)
    select v_id, (value)::int, ord - 1
    from jsonb_array_elements_text(p_menu->'product_ids') with ordinality as t(value, ord)
    where exists (select 1 from public.products p where p.id = (value)::int);
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end $function$;

-- حذف قائمة
CREATE OR REPLACE FUNCTION public.admin_delete_menu(p_token uuid, p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;
  delete from public.menus where id = p_id;
  return jsonb_build_object('ok', true);
end $function$;

-- ============================================================
-- الكتالوج: القوائم النشطة مع تفاصيل منتجاتها
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_catalog()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        select id, name_ar, name_en, image_url, points_cost, sort_order from public.rewards where is_active) x),
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
        select m.id, m.title, m.subtitle, m.image_url, m.emoji, m.sort_order,
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