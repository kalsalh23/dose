import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));

let t = readFileSync(join(here, 'fix-create-order-availability.sql'), 'utf8');

// 1) متغير علم المكافأة
const declOld = `  award_now boolean; rc public.reward_redemptions; v_free boolean := false;`;
if (!t.includes(declOld)) { console.error('DECL ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(declOld, `  award_now boolean; rc public.reward_redemptions; v_free boolean := false; v_reward boolean := false;`);

// 2) الفحص الأول: FOUND + تعيين العلم
const chkOld = `    select * into rc from public.reward_redemptions where code = upper(btrim(p_reward_code));
    if rc is not null then
      if rc.status <> 'unused' then raise exception 'code_used'; end if;
      if rc.expires_at < now() then raise exception 'code_expired'; end if;`;
if (!t.includes(chkOld)) { console.error('CHECK ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(chkOld, `    select * into rc from public.reward_redemptions where code = upper(btrim(p_reward_code));
    if FOUND then
      if rc.status <> 'unused' then raise exception 'code_used'; end if;
      if rc.expires_at is not null and rc.expires_at < now() then raise exception 'code_expired'; end if;
      v_reward := true;`);

// 3) الفرع المجاني
const freeOld = `  if rc is not null then
    v_total := 0; v_free := true;
  elsif v_promo_pct > 0 then`;
if (!t.includes(freeOld)) { console.error('FREE ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(freeOld, `  if v_reward then
    v_total := 0; v_free := true;
  elsif v_promo_pct > 0 then`);

// 4) استهلاك الرمز والإشعار
const usedOld = `  if rc is not null then
    update public.reward_redemptions set status = 'used', used_at = now() where code = upper(btrim(p_reward_code)) and status = 'unused';`;
if (!t.includes(usedOld)) { console.error('USED ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(usedOld, `  if v_reward then
    update public.reward_redemptions set status = 'used', used_at = now() where code = upper(btrim(p_reward_code)) and status = 'unused';`);

// تأكد ألا يبقى أي فحص مركّب معطوب
if (t.includes('rc is not null')) { console.error('STILL HAS rc IS NOT NULL'); process.exit(1); }

// إلحاقه بسكربت الإصلاح (يستبدل نسخة create_order السابقة داخله إن وُجدت ببساطة نضيف ملفًا مستقلًا)
writeFileSync(join(here, 'fix-reward-order2.sql'), t);
console.log('fix-reward-order2.sql ready:', t.length);
