-- دعم الإضافات المخفّضة للسعر: تخزين القيمة بإشارتها (سالب = استنقاص)
create or replace function public.admin_save_addition(p_token uuid, p_addition jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare aid integer; pid integer;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if btrim(coalesce(p_addition->>'name_ar', '')) = '' then raise exception 'invalid_name'; end if;
  if (p_addition->>'id')::int > 0 then
    update public.additions set
      name_ar = btrim(p_addition->>'name_ar'),
      price_cents = coalesce((p_addition->>'price_cents')::int, 0),
      is_active = coalesce((p_addition->>'is_active')::boolean, true)
    where id = (p_addition->>'id')::int
    returning id into aid;
    if aid is null then raise exception 'not_found'; end if;
    delete from public.addition_products where addition_id = aid;
  else
    insert into public.additions (name_ar, price_cents, is_active)
    values (btrim(p_addition->>'name_ar'), coalesce((p_addition->>'price_cents')::int, 0),
            coalesce((p_addition->>'is_active')::boolean, true))
    returning id into aid;
  end if;
  for pid in select j::int from jsonb_array_elements_text(coalesce(p_addition->'product_ids', '[]'::jsonb)) j loop
    insert into public.addition_products (addition_id, product_id) values (aid, pid)
    on conflict do nothing;
  end loop;
  return jsonb_build_object('ok', true, 'id', aid);
end
$function$;

grant execute on function public.admin_save_addition(uuid, jsonb) to anon;