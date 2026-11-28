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
      set points_expires_at = now() + (d || ' days')::interval
      where points > 0;
  end if;
  return jsonb_build_object('ok', true);
end $$;
