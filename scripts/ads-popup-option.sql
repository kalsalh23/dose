-- ============================================================
-- خيار «إعلان منبثق بعد دقيقتين» — مستقل عن خيار الظهور في الهيرو
-- ============================================================

-- 1) الخيار الجديد
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS popup_after_2min boolean NOT NULL DEFAULT false;

-- 2) ترحيل الإعلانات الحالية: ما كان علامته «منبثق» يصبح popup_after_2min
UPDATE public.advertisements SET popup_after_2min = true WHERE full_screen = true AND popup_after_2min = false;

-- 3) admin_save_ad: حفظ الخيارين (منبثق + هيرو) في الإضافة والتعديل
CREATE OR REPLACE FUNCTION public.admin_save_ad(p_token uuid, p_ad jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare new_id int; v_cat text; v_title text; v_body text;
  v_popup boolean; v_hero boolean;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;
  v_cat := coalesce(nullif(p_ad->>'category_slug',''), null);
  if v_cat is not null then
    select 'عروض ' || name_ar into v_title from public.categories where slug = v_cat;
    if v_title is null then raise exception 'invalid_category'; end if;
  else
    v_title := coalesce(nullif(p_ad->>'title',''), 'عرض خاص من Dose Cafe');
  end if;

  v_popup := coalesce((p_ad->>'popup_after_2min')::boolean, (p_ad->>'full_screen')::boolean, false);
  v_hero := coalesce((p_ad->>'show_in_hero')::boolean, true);

  if (p_ad->>'id')::int > 0 then
    update public.advertisements set
      image_url = coalesce(p_ad->>'image_url',''), title = v_title,
      description_ar = coalesce(p_ad->>'description_ar',''),
      category_slug = v_cat,
      old_price_cents = null, new_price_cents = null, discount_percent = null,
      ends_at = nullif(p_ad->>'ends_at','')::timestamptz,
      is_active = coalesce((p_ad->>'is_active')::boolean, true),
      full_screen = v_popup,
      show_in_hero = v_hero,
      popup_after_2min = v_popup
    where id = (p_ad->>'id')::int;
    return jsonb_build_object('ok', true, 'new', false);
  end if;

  insert into public.advertisements (image_url, title, description_ar, category_slug, old_price_cents, new_price_cents, discount_percent, starts_at, ends_at, is_active, full_screen, show_in_hero, popup_after_2min)
  values (coalesce(p_ad->>'image_url',''), v_title, coalesce(p_ad->>'description_ar',''),
          v_cat, null, null, null,
          now(), nullif(p_ad->>'ends_at','')::timestamptz,
          coalesce((p_ad->>'is_active')::boolean,true), v_popup,
          v_hero, v_popup)
  returning id into new_id;

  -- إشعار داخلي وخارجي لكل الزبائن بأسلوب الفئة
  if v_cat is not null then
    select name_ar into v_body from public.categories where slug = v_cat;
    v_title := '📣 عروض جديدة على ' || v_body;
    v_body := coalesce(nullif(p_ad->>'description_ar',''), 'عروض خاصة على ' || v_body) || ' — اطلبها الآن من Dose Cafe!';
    insert into public.notifications (customer_id, title, body, kind)
    select c.id, v_title, v_body, 'admin' from public.customers c where c.is_active;
    begin
      perform net.http_post(
        url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
        body := jsonb_build_object('all', true, 'title', v_title, 'body', v_body));
    exception when others then null;
    end;
  end if;

  return jsonb_build_object('ok', true, 'new', true);
end $function$;

-- 4) get_catalog: كشف الخيار الجديد
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
    'settings', (select jsonb_object_agg(key, value) from public.settings)
  )
$function$;