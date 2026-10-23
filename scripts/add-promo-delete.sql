-- حذف كود الخصم المنشور (إخفاؤه من التطبيق)
create or replace function public.admin_delete_promo(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  delete from public.settings where key in ('promo_code','promo_discount');
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.admin_delete_promo(uuid) to anon;
