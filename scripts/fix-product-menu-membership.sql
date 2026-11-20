-- إصلاح عرض/تعديل القوائم التي يتبع لها المنتج
-- 1) إرجاع قوائم المنتج ضمن admin_list_products
create or replace function public.admin_list_products(p_token uuid)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(x order by x.sort_order, x.id), '[]'::jsonb) from (
    select p.*, c.slug as category_slug,
      (select coalesce(jsonb_agg(mi.menu_id order by mi.menu_id), '[]'::jsonb)
         from public.menu_items mi where mi.product_id = p.id) as menu_ids
    from public.products p join public.categories c on c.id = p.category_id
  ) x where public._valid_admin(p_token) and public._is_owner(p_token);
$function$;

-- 2) حفظ عضويات المنتج في القوائم بدون حذفها عند عدم إرسالها
create or replace function public.admin_save_product(p_token uuid, p_product jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare cid integer; v_slug text; v_id integer;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;
  v_slug := coalesce(nullif(btrim(p_product->>'category_slug'), ''), 'hot_drinks');
  select id into cid from public.categories where slug = v_slug;
  if cid is null then raise exception 'invalid_category'; end if;
  if (p_product->>'id')::int > 0 then
    v_id := (p_product->>'id')::int;
    update public.products set
      category_id = cid, name_ar = p_product->>'name_ar', name_en = coalesce(p_product->>'name_en',''),
      description_ar = coalesce(p_product->>'description_ar',''),
      price_cents = greatest(0,(p_product->>'price_cents')::int),
      points = greatest(0,(p_product->>'points')::int),
      image_url = coalesce(p_product->>'image_url',''),
      options = coalesce(p_product->>'options',''),
      is_active = coalesce((p_product->>'is_active')::boolean, true),
      is_available = coalesce((p_product->>'is_available')::boolean, true),
      sale_price_cents = nullif(p_product->>'sale_price_cents','')::int,
      sort_order = coalesce((p_product->>'sort_order')::int, 0)
    where id = v_id;
  else
    insert into public.products (category_id, name_ar, name_en, description_ar, price_cents, points, image_url, options, is_active, is_available, sale_price_cents, sort_order)
    values (cid, p_product->>'name_ar', coalesce(p_product->>'name_en',''), coalesce(p_product->>'description_ar',''),
            greatest(0,(p_product->>'price_cents')::int), greatest(0,(p_product->>'points')::int),
            coalesce(p_product->>'image_url',''), coalesce(p_product->>'options',''),
            coalesce((p_product->>'is_active')::boolean,true), coalesce((p_product->>'is_available')::boolean,true),
            nullif(p_product->>'sale_price_cents','')::int,
            coalesce((p_product->>'sort_order')::int,0))
    returning id into v_id;
  end if;

  if p_product ? 'menu_ids' then
    delete from public.menu_items where product_id = v_id;
    insert into public.menu_items (menu_id, product_id, sort_order)
    select distinct (value)::int, v_id, coalesce((p_product->>'sort_order')::int, 0)
    from jsonb_array_elements_text(coalesce(p_product->'menu_ids', '[]'::jsonb)) as t(value)
    where exists (select 1 from public.menus m where m.id = (value)::int);
  elsif p_product ? 'menu_id' then
    delete from public.menu_items where product_id = v_id;
    if nullif(p_product->>'menu_id','') is not null then
      insert into public.menu_items (menu_id, product_id, sort_order)
      select (p_product->>'menu_id')::int, v_id, coalesce((p_product->>'sort_order')::int, 0)
      where exists (select 1 from public.menus m where m.id = (p_product->>'menu_id')::int);
    end if;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $function$;
