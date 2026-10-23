-- إصلاح الطلبات التي صارت مكتملة خلال فترة الخلل (بلا نقاط)
do $$
declare r record;
begin
  for r in
    select id, customer_id, total_points, order_number
    from public.orders
    where created_at >= '2026-10-13 12:37:00+00'
      and points_awarded = false
      and status in ('ready','completed')
  loop
    perform public._award_points(r.customer_id, r.total_points, r.id, 'order#' || r.order_number);
    update public.orders set points_awarded = true where id = r.id;
    if not exists (select 1 from public.orders where id = r.id and sales_recorded) then
      perform public._record_sales(r.id, true);
      update public.orders set sales_recorded = true where id = r.id;
    end if;
    update public.orders set completed_at = coalesce(completed_at, now()) where id = r.id;
    raise notice 'fixed order %', r.order_number;
  end loop;
end $$;