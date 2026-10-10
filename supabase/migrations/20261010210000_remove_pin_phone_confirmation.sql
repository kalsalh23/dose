-- ============================================================================
-- إزالة PIN من النظام والاعتماد على رقم الهاتف لتأكيد الهوية
-- التاريخ: 2026-10-10
-- ============================================================================
-- 1) allow null: لم يعد PIN إلزاميًا عند إنشاء الحساب
--    (كان قيد NOT NULL يمنع إنشاء حساب بدون PIN بخطأ 23502)
-- 2) customer_login: يُتحقق من PIN فقط عند تمريره صراحةً،
--    فيستطيع العملاء القدامى دخول برقم الهاتف فقط مع بقاء PIN مخزّنًا
-- ملاحظة: create_order يدعم p_confirm_phone مسبقًا ويقارن أرقام الهاتف،
--    وتحقق الهاتف له الأولوية على PIN.
-- ============================================================================

alter table public.customers alter column pin_hash drop not null;

create or replace function public.customer_login(p_phone text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.customers; tok uuid;
begin
  select * into c from public.customers where phone = btrim(p_phone);
  if c is null then raise exception 'wrong_pin'; end if;
  -- PIN اختياري: يُتحقق فقط عند تمريره صراحةً (توافقًا مع الحسابات القديمة)
  if c.pin_hash is not null and p_pin is not null and btrim(p_pin) <> '' then
    perform public._check_pin(c, p_pin);
  elsif c.is_active is distinct from true then
    raise exception 'account_disabled';
  end if;
  insert into public.customer_sessions (customer_id) values (c.id) returning token into tok;
  return jsonb_build_object('token', tok, 'customer', jsonb_build_object(
    'id', c.id, 'full_name', c.full_name, 'phone', c.phone, 'points', c.points, 'orders_count', c.orders_count));
end $$;
