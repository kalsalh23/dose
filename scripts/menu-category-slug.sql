-- إضافة حقل التصنيف (category_slug) إلى جدول القوائم
alter table public.menus add column if not exists category_slug text;
update public.menus set category_slug = 'hot_drinks' where category_slug is null or category_slug = '';

-- دالة حفظ القائمة: تُخزن category_slug وتعمل على التحقق من صحته
drop function if exists public.admin_save_menu(uuid, jsonb);
create or replace function public.admin_save_menu(p_token uuid, p_menu jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id integer; v_cat text; v_slug text;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;
  if btrim(coalesce(p_menu->>'title','')) = '' then raise exception 'title_required'; end if;

  v_cat := coalesce(nullif(btrim(p_menu->>'category_slug'), ''), 'hot_drinks');
  select slug into v_slug from public.categories where slug = v_cat;
  if v_slug is null then raise exception 'invalid_category'; end if;

  if (p_menu->>'id')::int > 0 then
    v_id := (p_menu->>'id')::int;
    update public.menus set
      title = p_menu->>'title',
      subtitle = coalesce(p_menu->>'subtitle',''),
      image_url = coalesce(p_menu->>'image_url',''),
      emoji = coalesce(nullif(p_menu->>'emoji',''), '☕'),
      is_active = coalesce((p_menu->>'is_active')::boolean, true),
      sort_order = coalesce((p_menu->>'sort_order')::int, 0),
      category_slug = v_slug
    where id = v_id;
  else
    insert into public.menus (title, subtitle, image_url, emoji, is_active, sort_order, category_slug)
    values (p_menu->>'title', coalesce(p_menu->>'subtitle',''), coalesce(p_menu->>'image_url',''),
            coalesce(nullif(p_menu->>'emoji',''), '☕'),
            coalesce((p_menu->>'is_active')::boolean, true),
            coalesce((p_menu->>'sort_order')::int, 0), v_slug)
    returning id into v_id;
  end if;

  delete from public.menu_items where menu_id = v_id;
  if p_menu->'product_ids' is not null then
    insert into public.menu_items (menu_id, product_id, sort_order)
    select v_id, (value)::int, ord - 1
    from jsonb_array_elements_text(p_menu->'product_ids') with ordinality as t(value, ord)
    where exists (select 1 from public.products p where p.id = (value)::int);
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end
$$;
grant execute on function public.admin_save_menu(uuid, jsonb) to anon;

-- عرض القوائم: يعيد category_slug وقائمة product_ids
drop function if exists public.admin_list_menus(uuid);
create or replace function public.admin_list_menus(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $function$
  select coalesce(jsonb_agg(x order by x.sort_order, x.id), '[]'::jsonb) from (
    select m.*, (select coalesce(jsonb_agg(mp.product_id order by mp.sort_order, mp.id), '[]'::jsonb) from public.menu_items mp where mp.menu_id = m.id) as product_ids
    from public.menus m
  ) x where public._valid_admin(p_token) and public._is_owner(p_token);
$function$;
grant execute on function public.admin_list_menus(uuid) to anon;