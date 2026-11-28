-- ============================================================
-- المصروفات: جدول + RPCs لإدخال/عرض/حذف مصاريف المحل
-- يُنفَّذ عبر pooler الاتصال المباشر أو SQL Editor.
-- ============================================================

create table if not exists public.shop_expenses (
  id uuid primary key default gen_random_uuid(),
  amount_cents integer not null check (amount_cents > 0),
  name_ar text not null default '',
  spent_at date not null default ((now() at time zone 'Asia/Damascus')::date),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists shop_expenses_spent_at_idx on public.shop_expenses (spent_at);

-- إضافة مصروف
create or replace function public.admin_add_expense(p_token uuid, p_amount_cents integer, p_name text, p_date date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_date date;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'invalid amount'; end if;
  v_date := coalesce(p_date, (now() at time zone 'Asia/Damascus')::date);
  insert into public.shop_expenses (amount_cents, name_ar, spent_at, created_by)
  values (p_amount_cents, coalesce(p_name, ''), v_date, p_token)
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;
grant execute on function public.admin_add_expense(uuid, integer, text, date) to anon;

-- قائمة المصاريف ضمن فترة
create or replace function public.admin_list_expenses(p_token uuid, p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_from date; v_to date;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;
  v_from := least(p_from, p_to);
  v_to := greatest(p_from, p_to);
  return coalesce((
    select jsonb_agg(x order by x.spent_at desc, x.created_at desc)
    from (
      select id, amount_cents, name_ar, spent_at, created_at
      from public.shop_expenses
      where spent_at between v_from and v_to
    ) x
  ), '[]'::jsonb);
end $$;
grant execute on function public.admin_list_expenses(uuid, date, date) to anon;

-- حذف مصروف
create or replace function public.admin_delete_expense(p_token uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;
  delete from public.shop_expenses where id = p_id;
end $$;
grant execute on function public.admin_delete_expense(uuid, uuid) to anon;

select 1;