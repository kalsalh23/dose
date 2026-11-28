-- حذف أكواد الاستبدال المنتهية صلاحيتها تلقائيًا عند عرض القائمة
drop function if exists public.admin_list_redemptions(uuid);
create or replace function public.admin_list_redemptions(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $function$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;
  -- حذف الأكواد المنتهية (التي لها تاريخ صلاحية في الماضي)
  delete from public.reward_redemptions where expires_at is not null and expires_at <= now();
  return coalesce((
    select jsonb_agg(x order by x.created_at desc) from (
      select r.code, r.reward_name, r.points_cost, r.status, r.created_at, r.used_at, r.expires_at,
             c.full_name as customer_name, c.phone as customer_phone
      from public.reward_redemptions r join public.customers c on c.id = r.customer_id
    ) x
  ), '[]'::jsonb);
end $function$;
grant execute on function public.admin_list_redemptions(uuid) to anon;

select 1;