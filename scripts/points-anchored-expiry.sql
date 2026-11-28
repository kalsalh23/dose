-- ============================================================
-- صلاحية النقاط مرتبطة بتاريخ إنشاء حساب كل مستخدم
-- كل مستخدم: points_expires_at = created_at + points_expire_days
-- مثال: قصي سجّل اليوم (صلاحية 10 أيام) ، عدي سجّل بعد 5 أيام (صلاحية 10 أيام له)
--        لكن قصي بقي له 5 أيام فقط.
-- يُنفَّذ عبر Supabase Management API (أو SQL Editor).
-- ============================================================

-- 1) منح النقاط: يُثبّت تاريخ الصلاحية على تاريخ إنشاء الحساب لا على وقت المنح
create or replace function public._award_points(p_customer uuid, p_delta integer, p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare d int;
begin
  select coalesce(nullif(value,'')::int, 15) into d from public.settings where key='points_expire_days';
  if d is null then d := 15; end if;
  update public.customers
  set points = points + p_delta,
      points_expires_at = case
        when p_delta > 0 then created_at + (d || ' days')::interval
        else points_expires_at
      end
  where id = p_customer;
  insert into public.points_transactions (customer_id, order_id, delta, reason)
  values (p_customer, p_order, p_delta, p_reason);
end $$;

-- 2) عند تغيير مدة الصلاحية من الإعدادات: إعادة الحساب لكل الحسابات من تاريخ إنشائها
create or replace function public.admin_save_settings(p_token uuid, p_settings jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k text; v text; d int;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  for k, v in select * from jsonb_each_text(p_settings) loop
    insert into public.settings (key, value) values (k, v)
    on conflict (key) do update set value = excluded.value;
  end loop;
  if p_settings ? 'points_expire_days' then
    d := coalesce(nullif(p_settings->>'points_expire_days','')::int, 15);
    update public.customers
      set points_expires_at = created_at + (d || ' days')::interval
      where points > 0;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- 3) تعبئة لمرة واحدة: تثبيت صلاحية الحسابات الحالية على تاريخ إنشائها
update public.customers
set points_expires_at = created_at + (
  coalesce((select nullif(value,'')::int from public.settings where key='points_expire_days'), 15) || ' days'
)::interval
where points > 0;

grant execute on function public._award_points(uuid, integer, uuid, text) to anon;
grant execute on function public.admin_save_settings(uuid, jsonb) to anon;

select 1;