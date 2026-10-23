// اختبار ميزة القوائم كاملةً
import { readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
let token = null;
for (const f of readdirSync(here).filter((x) => x.startsWith('.sbt'))) {
  const v = readFileSync(join(here, f), 'utf8');
  const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'select 1' }),
  });
  if (r.status === 200 || r.status === 201) { token = v; break; }
}
if (!token) { console.error('NO TOKEN'); process.exit(1); }
const dbq = async (sql) => {
  const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  if (r.status !== 200 && r.status !== 201) throw new Error(`${r.status} ${t.slice(0, 400)}`);
  return JSON.parse(t);
};
const K = readFileSync(join(here, '..', 'src', 'lib', 'supabase.ts'), 'utf8').match(/'eyJ[A-Za-z0-9_.\-]+'/)[0].slice(1, -1);
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const j = async (f, b) => { const r = await fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/' + f, { method: 'POST', headers: H, body: JSON.stringify(b) }); return { status: r.status, body: await r.json() }; };

let ownerTok = null;
try {
  const s = await dbq("insert into admin_sessions (admin_id, token) values ((select id from admin_users where username='admin'), gen_random_uuid()) returning token");
  ownerTok = s[0].token;

  // 1) المالك ينشئ قائمة بمنتجات
  const c1 = await j('admin_save_menu', { p_token: ownerTok, p_menu: { id: 0, title: 'قائمة الاختبار', subtitle: 'وصف مختصر', image_url: '', emoji: '☕', is_active: true, sort_order: 0, product_ids: [279, 284, 6, 99999] } });
  console.log('1) create menu:', c1.status, JSON.stringify(c1.body));

  const created = (await dbq("select id, title, subtitle, emoji, is_active from menus where title='قائمة الاختبار'"))[0];
  const items = await dbq(`select product_id, sort_order from menu_items where menu_id=${created.id} order by sort_order`);
  console.log('   menu id:', created.id, '| items:', JSON.stringify(items));

  // 2) القائمة تظهر في كتالوج الزبون
  const cat = await j('get_catalog', {});
  const mine = (cat.body.menus ?? []).find((m) => m.title === 'قائمة الاختبار');
  console.log('2) catalog menu:', mine ? 'FOUND' : 'MISSING', '| items:', mine ? mine.items.map((p) => p.name_ar).join('، ') : '');

  // 3) التعديل: تغيير المنتجات والعنوان
  const u = await j('admin_save_menu', { p_token: ownerTok, p_menu: { id: created.id, title: 'قائمة الاختبار (معدّلة)', subtitle: 'وصف', image_url: '', emoji: '🥐', is_active: true, sort_order: 1, product_ids: [6] } });
  console.log('3) update:', u.status);
  const items2 = await dbq(`select product_id from menu_items where menu_id=${created.id}`);
  console.log('   items after update (should be only #6):', JSON.stringify(items2));

  // 4) قائمة مخفيّة لا تظهر للزبون
  await j('admin_save_menu', { p_token: ownerTok, p_menu: { id: created.id, title: 'مخفية', subtitle: '', image_url: '', emoji: '☕', is_active: false, sort_order: 0, product_ids: [279] } });
  const cat2 = await j('get_catalog', {});
  console.log('4) hidden menu exposed:', (cat2.body.menus ?? []).some((m) => m.id === created.id) ? 'LEAK!' : 'hidden ✓');

  // 5) العامل ممنوع من إدارة القوائم
  const l = await j('admin_login', { p_username: 'one@gmail.com', p_password: '123123' });
  const w = await j('admin_list_menus', { p_token: l.body.token });
  console.log('5) worker list_menus (should fail):', w.status);
  const l2 = await j('admin_login', { p_username: 'one@gmail.com', p_password: '123123' });
  const w2 = await j('admin_list_orders', { p_token: l2.body.token, p_limit: 3 });
  console.log('   worker list_orders (should work):', w2.status, Array.isArray(w2.body) ? w2.body.length + ' orders' : '');

  // تنظيف
  await dbq(`delete from menus where title in ('قائمة الاختبار','قائمة الاختبار (معدّلة)','مخفية'); delete from admin_sessions where token='${ownerTok}';`);
  console.log('cleanup done');
} catch (e) {
  console.error('TEST ERROR:', e.message);
} finally {
  readdirSync(here).filter((x) => x.startsWith('.sbt') && x !== '.sbtok').forEach((x) => unlinkSync(join(here, x)));
}