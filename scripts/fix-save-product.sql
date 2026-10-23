-- إصلاح التصنيف الافتراضي في حفظ المنتجات
CREATE OR REPLACE FUNCTION public.admin_save_product(p_token uuid, p_product jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cid integer; v_slug text;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;
  v_slug := coalesce(nullif(btrim(p_product->>'category_slug'), ''), 'hot_drinks');
  select id into cid from public.categories where slug = v_slug;
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
      sale_price_cents = nullif(p_product->>'sale_price_cents','')::int,
      sort_order = coalesce((p_product->>'sort_order')::int, 0)
    where id = (p_product->>'id')::int;
  else
    insert into public.products (category_id, name_ar, name_en, description_ar, price_cents, points, image_url, options, is_active, is_available, sale_price_cents, sort_order)
    values (cid, p_product->>'name_ar', coalesce(p_product->>'name_en',''), coalesce(p_product->>'description_ar',''),
            greatest(0,(p_product->>'price_cents')::int), greatest(0,(p_product->>'points')::int),
            coalesce(p_product->>'image_url',''), coalesce(p_product->>'options',''),
            coalesce((p_product->>'is_active')::boolean,true), coalesce((p_product->>'is_available')::boolean,true),
            nullif(p_product->>'sale_price_cents','')::int,
            coalesce((p_product->>'sort_order')::int,0));
  end if;
  return jsonb_build_object('ok', true);
end $function$;