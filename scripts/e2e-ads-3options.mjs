// اختبار خيارات ظهور الإعلان الثلاثة
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

const save = async (tok, o) => j('admin_save_ad', { p_token: tok, p_ad: o });
const idByTitle = async (t) => (await dbq("select id, full_screen, show_in_hero, popup_after_2min from advertisements where title='" + t + "'"))[0];

let ownerTok = null;
const created = [];
try {
  const s = await dbq("insert into admin_sessions (admin_id, token) values ((select id from admin_users where username='admin'), gen_random_uuid()) returning token");
  ownerTok = s[0].token;

  // الخيار 1: هيرو فقط
  await save(ownerTok, { id: 0, image_url: '/t1.jpg', category_slug: 'fresh', description_ar: '', ends_at: '', is_active: true, show_in_hero: true, popup_after_2min: false, full_screen: false });
  created.push('عروض مشروبات فريش');
  // الخيار 2: منبثق فقط
  await save(ownerTok, { id: 0, image_url: '/t2.jpg', category_slug: 'matcha_tea', description_ar: '', ends_at: '', is_active: true, show_in_hero: false, popup_after_2min: true, full_screen: true });
  created.push('عروض ماتشا وشاي');
  // الخيار 3: هيرو + منبثق معًا
  await save(ownerTok, { id: 0, image_url: '/t3.jpg', category_slug: 'mojito', description_ar: '', ends_at: '', is_active: true, show_in_hero: true, popup_after_2min: true, full_screen: true });
  created.push('عروض موهيتو');
  // الخيار 1 آخر: هيرو فقط (فئة الحلويات)
  await save(ownerTok, { id: 0, image_url: '/t4.jpg', category_slug: 'dessert', description_ar: '', ends_at: '', is_active: true, show_in_hero: true, popup_after_2min: false, full_screen: false });
  created.push('عروض حلويات');

  for (const t of created) {
    const r = await idByTitle(t);
    console.log(t.padEnd(24), '→ hero:', r.show_in_hero, '| popup:', r.popup_after_2min, '| full_screen:', r.full_screen);
  }

  // محاكاة منطق التطبيق
  const cat = await j('get_catalog', {});
  const adsList = cat.body.ads;
  const hero = adsList.filter((a) => a.show_in_hero !== false).map((a) => a.title);
  const popup = adsList.find((a) => a.popup_after_2min) ?? adsList.find((a) => a.full_screen) ?? null;
  console.log('---');
  console.log('hero ads:', JSON.stringify(hero));
  console.log('popup ad:', popup ? popup.title : 'none');

  // التوقعات
  const heroHas = (t) => hero.includes(t);
  console.log('---');
  console.log('hero-only in hero:', heroHas('عروض حلويات') ? 'PASS' : 'FAIL');
  console.log('popup-only NOT in hero:', !heroHas('عروض ماتشا وشاي') ? 'PASS' : 'FAIL');
  console.log('both in hero:', heroHas('عروض موهيتو') ? 'PASS' : 'FAIL');
  console.log('both is popup:', popup?.title === 'عروض موهيتو' ? 'PASS (أول منبثق)' : 'NOTE popup=' + popup?.title);
  console.log('original ad not in hero:', !heroHas('عروض مشروبات ساخنة') ? 'PASS' : 'FAIL');

  // طباعة كل الإعلانات للحالة النهائية
  console.log('---');
  const all = await dbq('select id, title, show_in_hero, popup_after_2min, is_active from advertisements order by id');
  for (const a of all) console.log(a.id, a.title, '| hero:', a.show_in_hero, '| popup:', a.popup_after_2min, '| active:', a.is_active);
} catch (e) {
  console.error('TEST ERROR:', e.message);
} finally {
  try {
    await dbq("delete from advertisements where image_url in ('/t1.jpg','/t2.jpg','/t3.jpg','/t4.jpg'); delete from admin_sessions where token='" + ownerTok + "';");
    console.log('cleanup done (test ads removed)');
  } catch (e) { console.error('cleanup error:', e.message); }
  readdirSync(here).filter((x) => x.startsWith('.sbt') && x !== '.sbtok').forEach((x) => unlinkSync(join(here, x)));
}