-- خيارات ظهور الإعلان: ملء الشاشة و/أو الهيرو
alter table public.advertisements add column if not exists show_in_hero boolean not null default true;
update public.advertisements set show_in_hero = true;

-- الكتالوج: إرجاع show_in_hero مع الإعلانات
create or replace function public.get_catalog()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'categories', (select coalesce(jsonb_agg(x order by x.sort_order), '[]'::jsonb) from (
        select c.id, c.slug, c.name_ar, c.emoji, c.sort_order
        from public.categories c
        where exists (select 1 from public.products p where p.category_id = c.id and p.is_active)) x),
    'products', (select coalesce(jsonb_agg(x order by x.sort_order), '[]'::jsonb) from (
        select p.id, p.category_id, c.slug as category, p.name_ar, p.name_en, p.description_ar,
               p.price_cents, p.points, p.image_url, p.options, p.sort_order
        from public.products p join public.categories c on c.id = p.category_id
        where p.is_active) x),
    'best_sellers', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select p.id, p.name_ar, p.name_en, p.price_cents, p.points, p.image_url,
               sum(i.qty)::int as sold_qty
        from public.order_items i
        join public.orders o on o.id = i.order_id and o.status <> 'cancelled'
        join public.products p on p.id = i.product_id and p.is_active
        group by p.id, p.name_ar, p.name_en, p.price_cents, p.points, p.image_url
        order by sold_qty desc, p.id
        limit 6) x),
    'most_ordered', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select p.id, p.name_ar, p.name_en, p.price_cents, p.points, p.image_url,
               count(distinct i.order_id)::int as order_count
        from public.order_items i
        join public.orders o on o.id = i.order_id and o.status <> 'cancelled'
        join public.products p on p.id = i.product_id and p.is_active
        group by p.id, p.name_ar, p.name_en, p.price_cents, p.points, p.image_url
        order by order_count desc, p.id
        limit 6) x),
    'rewards', (select coalesce(jsonb_agg(x order by x.sort_order), '[]'::jsonb) from (
        select id, name_ar, name_en, image_url, points_cost, sort_order from public.rewards where is_active) x),
    'ads', (select coalesce(jsonb_agg(x order by x.id), '[]'::jsonb) from (
        select id, image_url, title, description_ar, old_price_cents, new_price_cents, discount_percent, full_screen, show_in_hero
        from public.advertisements
        where is_active and starts_at <= now() and (ends_at is null or ends_at >= now())) x),
    'settings', (select jsonb_object_agg(key, value) from public.settings)
  );
$$;

grant execute on function public.get_catalog() to anon;

-- حفظ الإعلان: يقبل show_in_hero
drop function if exists public.admin_save_ad(uuid, jsonb);
create or replace function public.admin_save_ad(p_token uuid, p_ad jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare new_id int;
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
      full_screen = coalesce((p_ad->>'full_screen')::boolean, false),
      show_in_hero = coalesce((p_ad->>'show_in_hero')::boolean, true)
    where id = (p_ad->>'id')::int;
    return jsonb_build_object('ok', true, 'new', false);
  end if;

  insert into public.advertisements (image_url, title, description_ar, old_price_cents, new_price_cents, discount_percent, starts_at, ends_at, is_active, full_screen, show_in_hero)
  values (coalesce(p_ad->>'image_url',''), p_ad->>'title', coalesce(p_ad->>'description_ar',''),
          nullif(p_ad->>'old_price_cents','')::int, nullif(p_ad->>'new_price_cents','')::int,
          nullif(p_ad->>'discount_percent','')::int,
          now(), nullif(p_ad->>'ends_at','')::timestamptz,
          coalesce((p_ad->>'is_active')::boolean,true), coalesce((p_ad->>'full_screen')::boolean,false),
          coalesce((p_ad->>'show_in_hero')::boolean,true))
  returning id into new_id;

  -- إعلان جديد: تذكير جميع الزبائن
  declare v_title text; v_body text; disc int;
  begin
    disc := coalesce(nullif(p_ad->>'discount_percent','')::int, 0);
    v_title := '📣 عرض جديد من Dose Cafe';
    v_body := p_ad->>'title' || ' — ' || coalesce(p_ad->>'description_ar','')
      || case when disc > 0 then ' — خصم ' || disc || '%!' else '' end
      || ' لا تفوّت الفرصة، اطلبه الآن!';
    insert into public.notifications (customer_id, title, body, kind)
    select c.id, v_title, v_body, 'admin' from public.customers c where c.is_active;
    begin
      perform net.http_post(
        url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
        body := jsonb_build_object('all', true, 'title', v_title, 'body', v_body));
    exception when others then null;
    end;
  end;

  return jsonb_build_object('ok', true, 'new', true, 'id', new_id);
end $$;
