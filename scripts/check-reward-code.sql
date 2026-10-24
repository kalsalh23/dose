drop function if exists public.check_reward_code(text);
create or replace function public.check_reward_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.reward_redemptions; pc text; pd int; psc text; ptg text; v_days int;
begin
  select * into r from public.reward_redemptions where code = upper(btrim(p_code));
  if FOUND then
    if r.status <> 'unused' then return jsonb_build_object('valid', false, 'reason', 'الرمز مستخدم سابقًا'); end if;
    if r.expires_at is not null and r.expires_at < now() then
      v_days := coalesce((select redemption_days from public.rewards where id = r.reward_id), 7);
      return jsonb_build_object('valid', false, 'reason', 'انتهت صلاحية الرمز (' || v_days || ' أيام)');
    end if;
    return jsonb_build_object('valid', true, 'type', 'reward', 'reward_name', r.reward_name, 'code', r.code, 'expires_at', r.expires_at);
  end if;
  pc := public._get_setting('promo_code', '');
  pd := coalesce(nullif(public._get_setting('promo_discount', ''), '')::int, 0);
  psc := public._get_setting('promo_scope', 'all');
  ptg := public._get_setting('promo_target', '');
  if btrim(p_code) = btrim(pc) and btrim(pc) <> '' then
    return jsonb_build_object('valid', true, 'type', 'promo', 'discount_percent', pd, 'code', btrim(pc), 'scope', psc, 'target', ptg);
  end if;
  return jsonb_build_object('valid', false, 'reason', 'الرمز غير موجود');
end
$$;
grant execute on function public.check_reward_code(text) to anon;
select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='check_reward_code';