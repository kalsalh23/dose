import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
let s = readFileSync(join(here, 'live-admin-set-order-status.txt'), 'utf8');

// 1) متغير was_completed في التصريحات
const declOld = `declare
  o public.orders; bal integer;`;
if (!s.includes(declOld)) { console.error('DECL ANCHOR NOT FOUND'); process.exit(1); }
s = s.replace(declOld, `declare
  o public.orders; bal integer; was_completed boolean;`);

// 2) التقاط الحالة قبل التغيير + تحديد وقت الإنهاء + تسجيل المبيعات
const updOld = `  update public.orders set status = p_status where id = o.id returning * into o;`;
if (!s.includes(updOld)) { console.error('UPDATE ANCHOR NOT FOUND'); process.exit(1); }
s = s.replace(updOld, updOld + `

  was_completed := o.completed_at is not null;
  if p_status in ('completed','cancelled') and o.completed_at is null then
    update public.orders set completed_at = now() where id = o.id returning * into o;
  end if;
  if p_status = 'completed' and not was_completed then
    perform public._record_sales(o.id, true);
  elsif p_status = 'cancelled' and was_completed then
    perform public._record_sales(o.id, false);
  end if;`);

// 3) غلاف الدالة الكامل
const fn = `drop function if exists public.admin_set_order_status(uuid, uuid, text);
create or replace function public.admin_set_order_status(p_token uuid, p_order_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
${s}
$$;
grant execute on function public.admin_set_order_status(uuid, uuid, text) to anon;
`;
writeFileSync(join(here, 'sales-status-fn.sql'), fn);
console.log('sales-status-fn.sql ready:', fn.length);
