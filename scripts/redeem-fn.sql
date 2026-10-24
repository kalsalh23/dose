drop function if exists public.redeem_reward(uuid, integer);
create or replace function public.redeem_reward(p_token uuid, p_reward_id integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  vc public.customers; r public.rewards; new_code text; i integer := 0;
  exp timestamptz; v_days integer;
begin
  select cust.* into vc from public.customers cust
    join public.customer_sessions s on s.customer_id = cust.id where s.token = p_token;
  if vc is null then raise exception 'unauthorized'; end if;
  select * into r from public.rewards where id = p_reward_id and is_active;
  if r is null then raise exception 'invalid_reward'; end if;
  if vc.points < r.points_cost then raise exception 'insufficient_points'; end if;

  v_days := coalesce(r.redemption_days, 7);
  if v_days < 1 then v_days := 1; end if;
  exp := now() + make_interval(days => v_days);

  loop
    i := i + 1;
    new_code := upper(substr(replace(md5(random()::text || clock_timestamp()::text), '-', ''), 1, 6));
    begin
      insert into public.reward_redemptions (code, customer_id, reward_id, reward_name, points_cost, expires_at)
      values (new_code, vc.id, r.id, r.name_ar, r.points_cost, exp);
      exit;
    exception when unique_violation then
      if i > 5 then raise exception 'code_generation_failed'; end if;
    end;
  end loop;

  update public.customers set points = points - r.points_cost where id = vc.id;
  insert into public.points_transactions (customer_id, reward_id, delta, reason)
  values (vc.id, r.id, -r.points_cost, 'redemption:' || new_code);

  perform public._notify(vc.id, 'reward redeemed',
    r.name_ar || ' code ' || new_code || ' valid ' || v_days || ' days', 'reward');

  begin
    perform net.http_post(
      url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer anon'),
      body := jsonb_build_object('customer_id', vc.id, 'title', 'reward redeemed',
        'body', r.name_ar || ' code ' || new_code || ' valid ' || v_days || ' days')
    );
  exception when others then null;
  end;

  return jsonb_build_object('code', new_code, 'reward_name', r.name_ar,
    'points_cost', r.points_cost, 'status', 'unused', 'expires_at', exp,
    'redemption_days', v_days,
    'remaining_points', vc.points - r.points_cost);
end
$$;
grant execute on function public.redeem_reward(uuid, integer) to anon;