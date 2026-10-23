-- ============================================================
-- نظام الأدوار: مالك (owner) + عامل (worker)
-- العامل يرى واجهة الطلبات فقط
-- ============================================================

-- 1) عمود الدور
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'owner';
ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_role_check CHECK (role in ('owner','worker'));

-- المالك الحالي = owner
UPDATE public.admin_users SET role = 'owner' WHERE username = 'admin' AND role <> 'owner';

-- 2) إنشاء حساب العامل (worker / worker1234)
INSERT INTO public.admin_users (username, password_hash, role)
VALUES ('worker', encode(extensions.digest('dose:worker1234', 'sha256'), 'hex'), 'worker')
ON CONFLICT (username) DO UPDATE SET role = 'worker', password_hash = encode(extensions.digest('dose:worker1234', 'sha256'), 'hex');

-- 3) دالة فحص الملكية
CREATE OR REPLACE FUNCTION public._is_owner(p_token uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select u.role = 'owner'
    from public.admin_sessions s join public.admin_users u on u.id = s.admin_id
    where s.token = p_token and s.created_at > now() - interval '12 hours'), false);
$function$;

-- 4) admin_login يُرجع الدور أيضًا
CREATE OR REPLACE FUNCTION public.admin_login(p_username text, p_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.admin_users; tok uuid;
begin
  select * into a from public.admin_users where username = btrim(p_username);
  if a is null or a.password_hash <> encode(extensions.digest('dose:' || p_password, 'sha256'), 'hex') then
    raise exception 'bad_credentials';
  end if;
  insert into public.admin_sessions (admin_id) values (a.id) returning token into tok;
  return jsonb_build_object('token', tok, 'username', a.username, 'role', a.role);
end $function$;

-- 5) حذف الدالة القديمة (3 وسائط) لتفادي التعارض
DROP FUNCTION IF EXISTS public.admin_set_order_status(uuid, uuid, text);

-- 6) إصلاح قيد الحالة — إضافة out_for_delivery
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY['pending','confirmed','preparing','ready','out_for_delivery','completed','cancelled']));

-- 7) حذف المنتج نهائيًا مع الحفاظ على سجل الطلبات
CREATE OR REPLACE FUNCTION public.admin_delete_product(p_token uuid, p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;
  -- فك ارتباط سجل الطلبات (يبقى الصنف واسمه وسعره داخل الطلبات السابقة)
  update public.order_items set product_id = null where product_id = p_id;
  -- الإضافات المرتبطة تُحذف تلقائيًا (ON DELETE CASCADE)
  delete from public.products where id = p_id;
  return jsonb_build_object('ok', true);
end $function$;
