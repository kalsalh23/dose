import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));

// توليد نسخة create_order من النسخة الحية مع إصلاح FOUND + حماية expires_at
let t = readFileSync(join(here, 'fix-create-order-availability.sql'), 'utf8');
const old1 = `    select * into rc from public.reward_redemptions where code = upper(btrim(p_reward_code));
    if rc is not null then
      if rc.status <> 'unused' then raise exception 'code_used'; end if;
      if rc.expires_at < now() then raise exception 'code_expired'; end if;`;
const new1 = `    select * into rc from public.reward_redemptions where code = upper(btrim(p_reward_code));
    if FOUND then
      if rc.status <> 'unused' then raise exception 'code_used'; end if;
      if rc.expires_at is not null and rc.expires_at < now() then raise exception 'code_expired'; end if;`;
if (!t.includes(old1)) { console.error('CREATE_ORDER ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(old1, new1);

// إلحاقه بسكربت الإصلاح
const base = readFileSync(join(here, 'fix-composite-null.sql'), 'utf8');
writeFileSync(join(here, 'fix-composite-null.sql'), base + t);
console.log('fix-composite-null.sql ready:', base.length + t.length, 'chars');
