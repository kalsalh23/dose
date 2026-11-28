-- إصلاح _award_points: صلاحية النقاط تُحسب من وقت المنح (now) لا من تاريخ إنشاء الحساب
create or replace function public._award_points(p_customer uuid, p_delta integer, p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare d int;
begin
  select coalesce(nullif(value,'')::int, 15) into d from public.settings where key='points_expire_days';
  if d is null then d := 15; end if;
  update public.customers
  set points = points + p_delta,
      points_expires_at = case
        when p_delta > 0 then now() + (d || ' days')::interval
        else points_expires_at
      end
  where id = p_customer;
  insert into public.points_transactions (customer_id, order_id, delta, reason)
  values (p_customer, p_order, p_delta, p_reason);
end $$;
grant execute on function public._award_points(uuid, integer, uuid, text) to anon;

select 1;