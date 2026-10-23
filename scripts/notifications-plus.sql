-- ============================================================
-- 1) حذف إشعار من حساب الزبون
-- 2) إخفاء الطلبات المكتملة بعد يومين من واجهات الزبائن
-- 3) كود الخصم: نشر من لوحة التحكم + إشعار داخلي وفوري لكل الزبائن
-- 4) تذكير يومي بصلاحية المكافآت (pg_cron)
-- ============================================================

-- 1) حذف إشعار
create or replace function public.delete_notification(p_token uuid, p_notif_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select customer_id into cid from public.customer_sessions where token = p_token;
  if cid is null then raise exception 'unauthorized'; end if;
  delete from public.notifications where id = p_notif_id and customer_id = cid;
end $$;
grant execute on function public.delete_notification(uuid, bigint) to anon;

-- 2) get_my_data: الطلبات المكتملة تختفي بعد يومين (تبقى في لوحة الإدارة)
create or replace function public.get_my_data(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'customer', (select jsonb_build_object('id', c.id, 'full_name', c.full_name, 'phone', c.phone,
                 'points', c.points, 'orders_count', c.orders_count, 'avatar_url', c.avatar_url)
                 from public.customers c join public.customer_sessions s on s.customer_id = c.id where s.token = p_token),
    'favorites', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select p.id, p.name_ar, p.name_en, p.description_ar, p.price_cents, p.points, p.image_url, p.options, f.created_at
        from public.favorites f
        join public.products p on p.id = f.product_id
        join public.customer_sessions s2 on s2.customer_id = f.customer_id
        where s2.token = p_token) x),
    'orders', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select o.id, o.order_number, o.status, o.fulfillment_type, o.total_cents, o.total_points, o.created_at,
               (select coalesce(jsonb_agg(jsonb_build_object('name_ar', i.name_ar, 'qty', i.qty, 'unit_price_cents', i.unit_price_cents, 'options', i.options)), '[]'::jsonb)
                from public.order_items i where i.order_id = o.id) as items
        from public.orders o join public.customer_sessions s3 on s3.customer_id = o.customer_id
        where s3.token = p_token
          and not (o.status = 'completed' and o.created_at < now() - interval '2 days')) x),
    'redemptions', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select r.code, r.reward_name, r.points_cost, r.status, r.expires_at, r.created_at
        from public.reward_redemptions r join public.customer_sessions s4 on s4.customer_id = r.customer_id
        where s4.token = p_token) x),
    'notifications', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select n.id, n.title, n.body, n.kind, n.is_read, n.created_at
        from public.notifications n join public.customer_sessions s5 on s5.customer_id = n.customer_id
        where s5.token = p_token order by n.created_at desc limit 50) x)
  );
$$;

-- 3) نشر كود الخصم + إشعار داخلي وفوري لكل الزبائن
create or replace function public.admin_publish_promo(p_token uuid, p_code text, p_discount int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cnt int; v_title text; v_body text;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if btrim(p_code) = '' then raise exception 'invalid_code'; end if;
  if p_discount is null or p_discount < 1 or p_discount > 90 then raise exception 'invalid_discount'; end if;

  insert into public.settings (key, value) values ('promo_code', upper(btrim(p_code)))
  on conflict (key) do update set value = excluded.value;
  insert into public.settings (key, value) values ('promo_discount', p_discount::text)
  on conflict (key) do update set value = excluded.value;

  v_title := '🎁 كود خصم جديد من Dose Cafe';
  v_body := 'استخدم الكود ' || upper(btrim(p_code)) || ' واحصل على خصم ' || p_discount || '% عند طلبك التالي في الكشك';

  insert into public.notifications (customer_id, title, body, kind)
  select c.id, v_title, v_body, 'admin' from public.customers c where c.is_active;
  select count(*) into cnt from public.notifications where kind = 'admin' and title = v_title;

  begin
    perform net.http_post(
      url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
      body := jsonb_build_object('all', true, 'title', v_title, 'body', v_body));
  exception when others then null;
  end;

  return jsonb_build_object('ok', true, 'notified', cnt);
end $$;
grant execute on function public.admin_publish_promo(uuid, text, int) to anon;

-- 4) تذكير يومي بصلاحية المكافآت
create or replace function public.notify_expiring_rewards()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record; days_left int;
begin
  for r in
    select rr.id, rr.customer_id, rr.code, rr.reward_name, rr.expires_at
    from public.reward_redemptions rr
    where rr.status = 'unused' and rr.expires_at >= now()
  loop
    days_left := (r.expires_at::date - now()::date);
    if days_left between 0 and 7 then
      perform public._notify(r.customer_id, '⏰ تذكير: مكافأتك قربت تنتهي',
        r.reward_name || ' — الكود: ' || r.code || ' — باقي ' ||
        case when days_left = 0 then 'أقل من يوم! استخدمها اليوم داخل المحل'
             when days_left = 1 then 'يوم واحد فقط'
             else days_left || ' أيام' end,
        'reward');
      begin
        perform net.http_post(
          url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
          body := jsonb_build_object('customer_id', r.customer_id, 'title', '⏰ تذكير: مكافأتك قربت تنتهي',
            'body', r.reward_name || ' — الكود: ' || r.code || ' — باقي ' || days_left || ' أيام'));
      exception when others then null;
      end;
    end if;
  end loop;
end $$;

-- جدولة التذكير اليومي (9 صباحًا) — تجاهل الفشل إن لم يتوفر pg_cron
do $$
begin
  create extension if not exists pg_cron;
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('dose-reward-reminders');
exception when others then null;
end $$;

do $$
begin
  perform cron.schedule('dose-reward-reminders', '0 9 * * *', 'select public.notify_expiring_rewards();');
  raise notice 'cron scheduled';
exception when others then
  raise notice 'cron not available: %', SQLERRM;
end $$;
