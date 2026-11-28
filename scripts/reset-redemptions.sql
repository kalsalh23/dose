-- تصفير أكواد الاستبدال: حذف كل أكواد reward_redemptions للبدء من جديد
create or replace function public.admin_reset_redemptions(p_token uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;
  select count(*)::int into v_count from public.reward_redemptions;
  delete from public.reward_redemptions;
  return v_count;
end $$;
grant execute on function public.admin_reset_redemptions(uuid) to anon;

select 1;