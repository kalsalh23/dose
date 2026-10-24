drop function if exists public.admin_list_redemptions(uuid);
create or replace function public.admin_list_redemptions(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $function$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
    select r.code, r.reward_name, r.points_cost, r.status, r.created_at, r.used_at, r.expires_at,
           c.full_name as customer_name, c.phone as customer_phone
    from public.reward_redemptions r join public.customers c on c.id = r.customer_id
  ) x where public._valid_admin(p_token) and public._is_owner(p_token);
$function$;
grant execute on function public.admin_list_redemptions(uuid) to anon;