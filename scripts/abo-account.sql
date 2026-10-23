-- Migration: customer_update_name RPC + worker account rename
-- Run against live Supabase project

/* 1) دالة تغيير اسم الملف الشخصي للزبون — تُحدّث الداتا بالاسم الجديد */
create or replace function public.customer_update_name(p_token uuid, p_full_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select customer_id into cid from public.customer_sessions where token = p_token;
  if cid is null then raise exception 'unauthorized'; end if;
  if p_full_name is null or length(btrim(p_full_name)) < 2 then raise exception 'invalid_name'; end if;
  update public.customers set full_name = left(btrim(p_full_name), 80) where id = cid;
  return jsonb_build_object('ok', true, 'full_name', left(btrim(p_full_name), 80));
end $$;

/* 2) حساب لوحة التحكم الخاصة بالطلبات فقط (العامل) — محفوظ في القاعدة وليس في الكود */
update public.admin_users
set username = 'abo@gmail.com',
    password_hash = encode(extensions.digest('dose:' || '123123', 'sha256'), 'hex')
where id = 1 and role = 'worker';
