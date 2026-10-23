drop function if exists public.admin_save_product(uuid,jsonb);
drop function if exists public.admin_delete_product(uuid,integer);
drop function if exists public.admin_toggle_customer(uuid,uuid,boolean);
drop function if exists public.admin_save_reward(uuid,jsonb);
drop function if exists public.admin_delete_reward(uuid,integer);
drop function if exists public.admin_set_redemption_status(uuid,text,text);
drop function if exists public.admin_save_ad(uuid,jsonb);
drop function if exists public.admin_delete_ad(uuid,integer);
drop function if exists public.admin_save_settings(uuid,jsonb);

-- إصلاح دوال الإدارة الفارغة: ترجع {"ok":true} عند النجاح بدل null
-- (الرفض عند فقدان الصلاحية يبقى استثناءً صريحًا)

-- منتجات
create or replace function public.admin_save_product(p_token uuid, p_product jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid integer;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  select id into cid from public.categories where slug = coalesce(p_product->>'category_slug','hot');
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
      sort_order = coalesce((p_product->>'sort_order')::int, 0)
    where id = (p_product->>'id')::int;
  else
    insert into public.products (category_id, name_ar, name_en, description_ar, price_cents, points, image_url, options, is_active, sort_order)
    values (cid, p_product->>'name_ar', coalesce(p_product->>'name_en',''), coalesce(p_product->>'description_ar',''),
            greatest(0,(p_product->>'price_cents')::int), greatest(0,(p_product->>'points')::int),
            coalesce(p_product->>'image_url',''), coalesce(p_product->>'options',''),
            coalesce((p_product->>'is_active')::boolean,true), coalesce((p_product->>'sort_order')::int,0));
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_delete_product(p_token uuid, p_id integer)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  update public.products set is_active = false where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- عملاء
create or replace function public.admin_toggle_customer(p_token uuid, p_customer_id uuid, p_active boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  update public.customers set is_active = p_active where id = p_customer_id;
  return jsonb_build_object('ok', true);
end $$;

-- مكافآت
create or replace function public.admin_save_reward(p_token uuid, p_reward jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if (p_reward->>'id')::int > 0 then
    update public.rewards set
      name_ar = p_reward->>'name_ar', name_en = coalesce(p_reward->>'name_en',''),
      image_url = coalesce(p_reward->>'image_url',''),
      points_cost = greatest(1,(p_reward->>'points_cost')::int),
      is_active = coalesce((p_reward->>'is_active')::boolean, true),
      sort_order = coalesce((p_reward->>'sort_order')::int, 0)
    where id = (p_reward->>'id')::int;
  else
    insert into public.rewards (name_ar, name_en, image_url, points_cost, is_active, sort_order)
    values (p_reward->>'name_ar', coalesce(p_reward->>'name_en',''), coalesce(p_reward->>'image_url',''),
            greatest(1,(p_reward->>'points_cost')::int), coalesce((p_reward->>'is_active')::boolean,true),
            coalesce((p_reward->>'sort_order')::int,0));
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_delete_reward(p_token uuid, p_id integer)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  update public.rewards set is_active = false where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_set_redemption_status(p_token uuid, p_code text, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  update public.reward_redemptions
  set status = p_status, used_at = case when p_status = 'used' then now() else used_at end
  where code = upper(btrim(p_code)) and p_status in ('unused','used','expired');
  return jsonb_build_object('ok', true);
end $$;

-- إعلانات
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
      starts_at = coalesce((p_ad->>'starts_at')::timestamptz, now()),
      ends_at = nullif(p_ad->>'ends_at','')::timestamptz,
      is_active = coalesce((p_ad->>'is_active')::boolean, true),
      full_screen = coalesce((p_ad->>'full_screen')::boolean, false)
    where id = (p_ad->>'id')::int;
  else
    insert into public.advertisements (image_url, title, description_ar, old_price_cents, new_price_cents, discount_percent, starts_at, ends_at, is_active, full_screen)
    values (coalesce(p_ad->>'image_url',''), p_ad->>'title', coalesce(p_ad->>'description_ar',''),
            nullif(p_ad->>'old_price_cents','')::int, nullif(p_ad->>'new_price_cents','')::int,
            nullif(p_ad->>'discount_percent','')::int,
            coalesce((p_ad->>'starts_at')::timestamptz, now()), nullif(p_ad->>'ends_at','')::timestamptz,
            coalesce((p_ad->>'is_active')::boolean,true), coalesce((p_ad->>'full_screen')::boolean,false));
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_delete_ad(p_token uuid, p_id integer)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  delete from public.advertisements where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- إعدادات
create or replace function public.admin_save_settings(p_token uuid, p_settings jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k text; v text;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  for k, v in select * from jsonb_each_text(p_settings) loop
    insert into public.settings (key, value) values (k, v)
    on conflict (key) do update set value = excluded.value;
  end loop;
  return jsonb_build_object('ok', true);
end $$;
