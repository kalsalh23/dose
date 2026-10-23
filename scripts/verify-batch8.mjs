import { readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const token = readFileSync(join(here, '.sbtok'), 'utf8');
const dbq = async (sql) => {
  const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (r.status !== 200 && r.status !== 201) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return JSON.parse(await r.text());
};
const chk = await dbq(`select
  (select count(*)::int from information_schema.tables where table_schema='public' and table_name='additions') as additions_tbl,
  (select count(*)::int from information_schema.columns where table_schema='public' and table_name='order_items' and column_name='additions') as oi_add,
  (select count(*)::int from information_schema.columns where table_schema='public' and table_name='orders' and column_name='customer_name') as ord_name,
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_order' and proargnames::text like '%p_customer_name%') as ord_11args,
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_set_order_status' and prosrc like '%out_for_delivery%') as ofd,
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='redeem_reward' and prosrc like '%10 days%') as ten_days,
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_delete_reward' and prosrc like '%set reward_id = null%') as del_reward,
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_catalog' and prosrc like '%additions%') as cat_add,
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_list_additions') as list_add`);
console.log(JSON.stringify(chk));
readdirSync(here).filter(x => x.startsWith('.sbtok')).forEach(x => unlinkSync(join(here, x)));
console.log('# token cleaned');
