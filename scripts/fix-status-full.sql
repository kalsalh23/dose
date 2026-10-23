-- ============================================================
-- الدالة الكاملة لتغيير حالة الطلب:
-- ETA + النقاط + المبيعات + الإشعارات (مُصحَّحة بالكامل)
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_set_order_status(uuid, uuid, text, integer);

CREATE OR REPLACE FUNCTION public.admin_set_order_status(p_token uuid, p_order_id uuid, p_status text, p_eta_minutes integer DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  o public.orders; bal integer;
  titles jsonb := jsonb_build_object(
    'confirmed','✅ تم تأكيد طلبك','preparing','👨‍🍳 طلبك قيد التحضير',
    'ready','✅ اكتمل طلبك','out_for_delivery','🛵 طلبك في الطريق إليك!','completed','✅ تم إكمال طلبك','cancelled','❌ تم إلغاء طلبك');
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if p_status not in ('pending','confirmed','preparing','ready','out_for_delivery','completed','cancelled') then raise exception 'invalid_status'; end if;
  select * into o from public.orders where id = p_order_id;
  if o is null then raise exception 'not_found'; end if;
  if o.status = p_status then return jsonb_build_object('ok', true, 'estimated_delivery_at', o.estimated_delivery_at, 'eta_minutes', o.eta_minutes, 'points_awarded', o.points_awarded); end if;

  -- تحديث الحالة + الوقت المقدر عند «قيد التحضير»
  if p_status = 'preparing' and p_eta_minutes is not null and p_eta_minutes > 0 then
    update public.orders
      set status = p_status,
          estimated_delivery_at = now() + (p_eta_minutes || ' minutes')::interval,
          eta_minutes = p_eta_minutes
      where id = o.id returning * into o;
  else
    update public.orders set status = p_status where id = o.id returning * into o;
  end if;

  -- ============================ إنهاء الطلب: «مكتمل» أو «تم التسليم» ============================
  if p_status in ('ready','completed') then
    -- وقت الإكمال
    if o.completed_at is null then
      update public.orders set completed_at = now() where id = o.id returning * into o;
    end if;

    -- تسجيل المبيعات مرة واحدة فقط
    if not o.sales_recorded then
      perform public._record_sales(o.id, true);
      update public.orders set sales_recorded = true where id = o.id;
    end if;

    -- منح النقاط مرة واحدة فقط
    if not o.points_awarded then
      perform public._award_points(o.customer_id, o.total_points, o.id, 'order#' || o.order_number);
      update public.orders set points_awarded = true where id = o.id;
      select points into bal from public.customers where id = o.customer_id;
      if o.total_points > 0 then
        perform public._notify(o.customer_id, titles->>p_status,
          '⭐ حصلت على ' || o.total_points || ' نقطة — رصيدك الحالي: ' || bal || ' نقطة', 'order');
        begin
          perform net.http_post(
            url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
            headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
            body := jsonb_build_object('customer_id', o.customer_id, 'title', titles->>p_status,
              'body', '⭐ حصلت على ' || o.total_points || ' نقطة — رصيدك الحالي: ' || bal || ' نقطة'));
        exception when others then null;
        end;
      elsif titles ? p_status then
        perform public._notify(o.customer_id, titles->>p_status, 'طلب رقم #' || o.order_number, 'order');
        begin
          perform net.http_post(
            url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
            headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
            body := jsonb_build_object('customer_id', o.customer_id, 'title', titles->>p_status, 'body', 'طلب رقم #' || o.order_number));
        exception when others then null;
        end;
      end if;
    elsif titles ? p_status then
      perform public._notify(o.customer_id, titles->>p_status, 'طلب رقم #' || o.order_number, 'order');
      begin
        perform net.http_post(
          url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
          body := jsonb_build_object('customer_id', o.customer_id, 'title', titles->>p_status, 'body', 'طلب رقم #' || o.order_number));
      exception when others then null;
      end;
    end if;

  -- ============================ الإلغاء: خصم النقاط والمبيعات ============================
  elsif p_status = 'cancelled' then
    if o.sales_recorded then
      perform public._record_sales(o.id, false);
      update public.orders set sales_recorded = false where id = o.id;
    end if;
    if o.points_awarded then
      perform public._award_points(o.customer_id, -o.total_points, o.id, 'cancel#' || o.order_number);
      update public.orders set points_awarded = false where id = o.id;
      perform public._notify(o.customer_id, '❌ تم إلغاء طلبك', 'طلب رقم #' || o.order_number || ' — خُصمت ' || o.total_points || ' نقطة', 'order');
      begin
        perform net.http_post(
          url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
          body := jsonb_build_object('customer_id', o.customer_id, 'title', '❌ تم إلغاء طلبك', 'body', 'طلب رقم #' || o.order_number || ' — خُصمت ' || o.total_points || ' نقطة'));
      exception when others then null;
      end;
    elsif titles ? p_status then
      perform public._notify(o.customer_id, titles->>p_status, 'طلب رقم #' || o.order_number, 'order');
      begin
        perform net.http_post(
          url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
          body := jsonb_build_object('customer_id', o.customer_id, 'title', titles->>p_status, 'body', 'طلب رقم #' || o.order_number));
      exception when others then null;
      end;
    end if;

  -- ============================ بقية الحالات: إشعار فقط ============================
  elsif titles ? p_status then
    perform public._notify(o.customer_id, titles->>p_status, 'طلب رقم #' || o.order_number, 'order');
    begin
      perform net.http_post(
        url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
        body := jsonb_build_object('customer_id', o.customer_id, 'title', titles->>p_status, 'body', 'طلب رقم #' || o.order_number));
    exception when others then null;
    end;
  end if;

  return jsonb_build_object('ok', true, 'estimated_delivery_at', o.estimated_delivery_at, 'eta_minutes', o.eta_minutes, 'points_awarded', o.points_awarded);
end $function$;