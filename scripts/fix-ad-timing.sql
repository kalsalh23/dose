-- إصلاح حفظ الإعلان: البداية دائمًا الآن، والنهاية بصيغة ISO (تشمل المنطقة الزمنية)
drop function if exists public.admin_save_ad(uuid, jsonb);
create or replace function public.admin_save_ad(p_token uuid, p_ad jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if (p_ad->>'id')::int > 0 then
    update public.advertisements set
      image_url = coalesce(p_ad->>'image_url',''), title = p_ad->>'title',
      description_ar = coalesce(p_ad->>'description_ar',''),
      old_price_cents = nullif(p_ad->>'old_price_cents','')::int,
      new_price_cents = nullif(p_ad->>'new_price_cents','')::int,
      discount_percent = nullif(p_ad->>'discount_percent','')::int,
      ends_at = nullif(p_ad->>'ends_at','')::timestamptz,
      is_active = coalesce((p_ad->>'is_active')::boolean, true),
      full_screen = coalesce((p_ad->>'full_screen')::boolean, false)
    where id = (p_ad->>'id')::int;
  else
    insert into public.advertisements (image_url, title, description_ar, old_price_cents, new_price_cents, discount_percent, starts_at, ends_at, is_active, full_screen)
    values (coalesce(p_ad->>'image_url',''), p_ad->>'title', coalesce(p_ad->>'description_ar',''),
            nullif(p_ad->>'old_price_cents','')::int, nullif(p_ad->>'new_price_cents','')::int,
            nullif(p_ad->>'discount_percent','')::int,
            now(), nullif(p_ad->>'ends_at','')::timestamptz,
            coalesce((p_ad->>'is_active')::boolean,true), coalesce((p_ad->>'full_screen')::boolean,false));
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- فحص الإعلانات الحالية
select id, title, is_active, full_screen, starts_at, ends_at from public.advertisements order by id;
