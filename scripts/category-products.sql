-- اختيار منتجات الفئة مباشرة: تعيين المنتجات المحددة إلى الفئة، ونقل غير المحددة إلى فئة بديلة
create or replace function public.admin_set_category_products(p_token uuid, p_category_id integer, p_product_ids jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_fallback integer; v_count integer;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;
  if not exists (select 1 from public.categories c where c.id = p_category_id) then raise exception 'category_not_found'; end if;

  select c.id into v_fallback from public.categories c
   where c.id <> p_category_id order by c.sort_order, c.id limit 1;

  update public.products p
     set category_id = p_category_id
   where p.id in (
     select (t.value)::int from jsonb_array_elements_text(coalesce(p_product_ids, '[]'::jsonb)) as t(value)
   );

  if v_fallback is not null then
    update public.products p
       set category_id = v_fallback
     where p.category_id = p_category_id
       and p.id not in (
         select (t.value)::int from jsonb_array_elements_text(coalesce(p_product_ids, '[]'::jsonb)) as t(value)
       );
  end if;

  select count(*) into v_count from public.products p where p.category_id = p_category_id;
  return jsonb_build_object('ok', true, 'count', v_count, 'fallback_category_id', v_fallback);
end
$function$;