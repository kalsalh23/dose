import { readFileSync, writeFileSync } from 'node:fs';
const f = 'scripts/ad-display-modes.sql';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const old = `returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;

  if (p_ad->>'id')::int > 0 then`;
if (!s.includes(old)) { console.error('declare anchor missing'); process.exit(1); }
s = s.replace(old, `returns jsonb language plpgsql security definer set search_path = public as $$
declare new_id int;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;

  if (p_ad->>'id')::int > 0 then`);
writeFileSync(f, s);
console.log('declare added');
