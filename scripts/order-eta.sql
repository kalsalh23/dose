-- تحديث وقت التوصيل المقدر لطلب قيد التحضير
CREATE OR REPLACE FUNCTION public.admin_set_order_eta(p_token uuid, p_order_id uuid, p_eta_minutes integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; v_eta timestamp with time zone;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  select * into o from public.orders where id = p_order_id;
  if o is null then raise exception 'not_found'; end if;
  if p_eta_minutes is not null and p_eta_minutes > 0 then
    v_eta := now() + (p_eta_minutes || ' minutes')::interval;
    update public.orders set estimated_delivery_at = v_eta where id = o.id returning * into o;
  else
    update public.orders set estimated_delivery_at = null where id = o.id returning * into o;
  end if;
  return jsonb_build_object('ok', true, 'estimated_delivery_at', o.estimated_delivery_at);
end $function$;