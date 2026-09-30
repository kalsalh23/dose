-- إصلاح: إشعار لوحة التحكم يُرسل داخليًا (جدول notifications) وخارجيًا (Web Push) معًا
-- كان يكتفي بالداخلي فقط. يدعم الجمهور: كل العملاء أو عميل محدد.
do $$
declare sig record;
begin
  for sig in
    select p.oid::regprocedure::text as s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_send_notification'
  loop
    execute 'drop function if exists ' || sig.s;
  end loop;
end $$;

create or replace function public.admin_send_notification(p_token uuid, p_title text, p_body text default '', p_customer_id uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_cnt int := 0;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if btrim(p_title) = '' then raise exception 'invalid_title'; end if;

  insert into public.notifications (customer_id, title, body, kind)
  select coalesce(p_customer_id, c.id), btrim(p_title), coalesce(p_body, ''), 'admin'
  from public.customers c
  where c.is_active and (p_customer_id is null or c.id = p_customer_id);
  get diagnostics v_cnt = row_count;

  -- إشعار خارجي فوري للأجهزة (كل الزبائن أو العميل المحدد)
  begin
    perform net.http_post(
      url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer anon'),
      body := case
        when p_customer_id is null
          then jsonb_build_object('all', true, 'title', btrim(p_title), 'body', coalesce(p_body, ''))
          else jsonb_build_object('customer_id', p_customer_id, 'title', btrim(p_title), 'body', coalesce(p_body, ''))
      end);
  exception when others then null;
  end;

  return v_cnt;
end $$;
grant execute on function public.admin_send_notification(uuid, text, text, uuid) to anon;
