// اختبار خيار إعلان منبثق بعد دقيقتين + الهيرو
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
  if (r.status !== 200 && r.status !== 201) throw new Error(`${r.status} ${t.slice(0, 300)}`);
  return JSON.parse(t);
};
const K = readFileSync(join(here, '..', 'src', 'lib', 'supabase.ts'), 'utf8').match(/'eyJ[A-Za-z0-9_.\-]+'/)[0].slice(1, -1);
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const j = async (f, b) => { const r = await fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/' + f, { method: 'POST', headers: H, body: JSON.stringify(b) }); return { status: r.status, body: await r.json() }; };

let ownerTok = null;
try {
  const s = await dbq("insert into admin_sessions (admin_id, token) values ((select id from admin_users where username='one@gmail.com'), gen_random_uuid()) returning token");
  ownerTok = s[0].token;

  // 1) إنشاء إعلان: منبثق بعد دقيقتين + هيرو معًا
  const a1 = await j('admin_save_ad', { p_token: ownerTok, p_ad: { id: 0, image_url: '/img/test.jpg', category_slug: 'mojito', description_ar: 'اختبار', ends_at: '', is_active: true, popup_after_2min: true, show_in_hero: true } });
  console.log('1) create popup+hero:', a1.status, JSON.stringify(a1.body));

  const rows = await dbq("select id, title, full_screen, show_in_hero, popup_after_2min from advertisements where title like 'عروض موهيتو%'");
  console.log('   saved row:', JSON.stringify(rows[rows.length - 1]));

  // 2) get_catalog يكشف الخيار
  const cat = await j('get_catalog', {});
  const c1 = cat.body?.ads?.[0];
  console.log('2) catalog ad flags:', JSON.stringify({ full_screen: c1?.full_screen, show_in_hero: c1?.show_in_hero, popup_after_2min: c1?.popup_after_2min }));

  // 3) تعديل الإعلان الجديد: منبثق فقط (بدون هيرو)
  const id = rows[rows.length - 1].id;
  const a2 = await j('admin_save_ad', { p_token: ownerTok, p_ad: { id: id, image_url: '/img/test.jpg', category_slug: 'mojito', description_ar: 'اختبار', ends_at: '', is_active: true, popup_after_2min: true, show_in_hero: false } });
  console.log('3) update to popup-only:', a2.status);
  const rows2 = await dbq(`select id, full_screen, show_in_hero, popup_after_2min from advertisements where id=${id}`);
  console.log('   updated row:', JSON.stringify(rows2[0]));

  // 4) إنشاء إعلان هيرو فقط
  const a3 = await j('admin_save_ad', { p_token: ownerTok, p_ad: { id: 0, image_url: '/img/test2.jpg', category_slug: 'fresh', description_ar: 'اختبار هيرو', ends_at: '', is_active: true, popup_after_2min: false, show_in_hero: true } });
  console.log('4) create hero-only:', a3.status);
  const rows3 = await dbq("select id, full_screen, show_in_hero, popup_after_2min from advertisements where title like 'عروض مشروبات فريش%' order by id desc limit 1");
  console.log('   hero-only row:', JSON.stringify(rows3[0]));

  // 5) العامل ممنوع من حفظ الإعلانات
  const ws = await dbq("insert into admin_sessions (admin_id, token) values ((select id from admin_users where username='worker'), gen_random_uuid()) returning token");
  const a4 = await j('admin_save_ad', { p_token: ws[0].token, p_ad: { id: 0, image_url: '/x.jpg', category_slug: 'mojito', description_ar: 'x', is_active: true } });
  console.log('5) worker save ad (should fail):', a4.status);
  await dbq(`delete from admin_sessions where token='${ws[0].token}'`);

  // تنظيف الإعلانات الاختبارية
  await dbq("delete from advertisements where title like 'عروض موهيتو%' and image_url='/img/test.jpg'; delete from advertisements where title like 'عروض مشروبات فريش%' and image_url='/img/test2.jpg';");
  console.log('cleanup done');
} catch (e) {
  console.error('TEST ERROR:', e.message);
} finally {
  if (ownerTok) { try { await dbq(`delete from admin_sessions where token='${ownerTok}'`); } catch {} }
  readdirSync(here).filter((x) => x.startsWith('.sbt') && x !== '.sbtok').forEach((x) => unlinkSync(join(here, x)));
}