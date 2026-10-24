import { readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter(f => f.startsWith('.sbt'));
const dbq = async (sql) => {
  for (const f of files) {
    const v = readFileSync(join(here, f), 'utf8');
    try {
      const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
        method: 'POST', headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql }),
      });
      if (r.status === 200 || r.status === 201) return JSON.parse(await r.text());
    } catch {}
  }
  throw new Error('no working token');
};

const sql = `
drop function if exists public.admin_save_reward(uuid, jsonb);
create or replace function public.admin_save_reward(p_token uuid, p_reward jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id int := (p_reward->>'id')::int;
  v_expires timestamptz;
  v_days int;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;

  -- تاريخ صلاحية المكافأة (اختياري)
  if p_reward->>'expires_at' is not null and btrim(p_reward->>'expires_at') <> '' then
    v_expires := (p_reward->>'expires_at')::timestamptz;
  else
    v_expires := null;
  end if;

  -- عدد أيام الاستبدال (Optional, default 7)
  if p_reward->>'redemption_days' is not null and btrim(p_reward->>'redemption_days') <> '' then
    v_days := greatest(1, (p_reward->>'redemption_days')::int);
  else
    v_days := 7;
  end if;

  if v_id > 0 then
    update public.rewards set
      name_ar = p_reward->>'name_ar',
      name_en = coalesce(p_reward->>'name_en',''),
      image_url = coalesce(p_reward->>'image_url',''),
      points_cost = greatest(1,(p_reward->>'points_cost')::int),
      is_active = coalesce((p_reward->>'is_active')::boolean, true),
      sort_order = coalesce((p_reward->>'sort_order')::int, 0),
      expires_at = v_expires,
      redemption_days = v_days
    where id = v_id;
  else
    insert into public.rewards (name_ar, name_en, image_url, points_cost, is_active, sort_order, expires_at, redemption_days)
    values (p_reward->>'name_ar', coalesce(p_reward->>'name_en',''), coalesce(p_reward->>'image_url',''),
            greatest(1,(p_reward->>'points_cost')::int), coalesce((p_reward->>'is_active')::boolean,true),
            coalesce((p_reward->>'sort_order')::int,0), v_expires, v_days);
    v_id := lastval();
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
grant execute on function public.admin_save_reward(uuid, jsonb) to anon;
select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_save_reward';
`;
console.log('FN UPDATED:', JSON.stringify(await dbq(sql)));
readdirSync(here).filter(x => x.startsWith('.sbt')).forEach(x => unlinkSync(join(here, x)));
console.log('# tokens cleaned');