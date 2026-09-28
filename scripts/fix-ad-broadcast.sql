-- عند إدراج إعلان جديد (كود خصم/عرض): إشعار تذكير لكل الزبائن + إشعار فوري جماعي
drop function if exists public.admin_save_ad(uuid, jsonb);
create or replace function public.admin_save_ad(p_token uuid, p_ad jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare new_id int; disc int; v_title text; v_body text;
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
    return jsonb_build_object('ok', true, 'new', false);
  end if;

  -- إعلان جديد
  insert into public.advertisements (image_url, title, description_ar, old_price_cents, new_price_cents, discount_percent, starts_at, ends_at, is_active, full_screen)
  values (coalesce(p_ad->>'image_url',''), p_ad->>'title', coalesce(p_ad->>'description_ar',''),
          nullif(p_ad->>'old_price_cents','')::int, nullif(p_ad->>'new_price_cents','')::int,
          nullif(p_ad->>'discount_percent','')::int,
          now(), nullif(p_ad->>'ends_at','')::timestamptz,
          coalesce((p_ad->>'is_active')::boolean,true), coalesce((p_ad->>'full_screen')::boolean,false))
  returning id into new_id;

  -- تذكير جميع الزبائن بالإعلان (كود الخصم)
  disc := coalesce(nullif(p_ad->>'discount_percent','')::int, 0);
  v_title := '📣 عرض جديد من Dose Cafe';
  v_body := p_ad->>'title' || ' — ' || coalesce(p_ad->>'description_ar','')
    || case when disc > 0 then ' — خصم ' || disc || '%!' else '' end
    || ' لا تفوّت الفرصة، اطلبه الآن!';

  insert into public.notifications (customer_id, title, body, kind)
  select c.id, v_title, v_body, 'admin' from public.customers c where c.is_active;

  -- إشعار فوري جماعي
  begin
    perform net.http_post(
      url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
      body := jsonb_build_object('all', true, 'title', v_title, 'body', v_body));
  exception when others then null;
  end;

  return jsonb_build_object('ok', true, 'new', true, 'id', new_id);
end $$;
