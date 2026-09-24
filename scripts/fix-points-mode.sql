-- 1) فرض منح النقاط عند الإكمال فقط
update public.settings set value = 'on_complete' where key = 'points_award_mode';

-- 2) الإكمال يرسل إشعارًا فوريًا يحمل النقاط والرصيد
create or replace function public.admin_set_order_status(p_token uuid, p_order_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o public.orders; bal integer;
  titles jsonb := jsonb_build_object(
    'confirmed','✅ تم تأكيد طلبك','preparing','👨‍🍳 طلبك قيد التحضير',
    'ready','☕ طلبك جاهز','completed','✅ تم إكمال طلبك','cancelled','❌ تم إلغاء طلبك');
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if p_status not in ('pending','confirmed','preparing','ready','completed','cancelled') then raise exception 'invalid_status'; end if;
  select * into o from public.orders where id = p_order_id;
  if o is null then raise exception 'not_found'; end if;
  if o.status = p_status then return jsonb_build_object('ok', true); end if;

  update public.orders set status = p_status where id = o.id returning * into o;

  if p_status = 'completed' and not o.points_awarded then
    perform public._award_points(o.customer_id, o.total_points, o.id, 'order#' || o.order_number);
    update public.orders set points_awarded = true where id = o.id;
    select points into bal from public.customers where id = o.customer_id;
    perform public._notify(o.customer_id, '✅ تم إكمال طلبك',
      '⭐ حصلت على ' || o.total_points || ' نقطة — رصيدك الحالي: ' || bal || ' نقطة', 'order');
    begin
      perform net.http_post(
        url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
        body := jsonb_build_object('customer_id', o.customer_id, 'title', '✅ تم إكمال طلبك',
          'body', '⭐ حصلت على ' || o.total_points || ' نقطة — رصيدك الحالي: ' || bal || ' نقطة'));
    exception when others then null;
    end;
  elsif p_status = 'cancelled' and o.points_awarded then
    perform public._award_points(o.customer_id, -o.total_points, o.id, 'cancel#' || o.order_number);
    update public.orders set points_awarded = false where id = o.id;
    perform public._notify(o.customer_id, '❌ تم إلغاء طلبك', 'طلب رقم #' || o.order_number, 'order');
    begin
      perform net.http_post(
        url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer anon'),
        body := jsonb_build_object('customer_id', o.customer_id, 'title', '❌ تم إلغاء طلبك', 'body', 'طلب رقم #' || o.order_number));
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

  return jsonb_build_object('ok', true);
end $$;

select key, value from public.settings;
