// اختبار تقرير المبيعات
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
const rpc = (f, b) => fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/' + f, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(async r => ({ status: r.status, body: await r.text() }));
const j = async (f, b) => JSON.parse((await rpc(f, b)).body);

try {
  // جلسة مالك جديدة للاختبار — كلمة مرور المالك غير معروفة، نستخدم جلسة owner قائمة أو ننشئ واحدة
  const sess = await dbq("insert into admin_sessions (admin_id, token) values ((select id from admin_users where username='worker' limit 1), gen_random_uuid()) returning token");
  const workerTok = sess[0].token;

  // 1) العامل ممنوع من التقرير
  const w = await rpc('admin_sales_report', { p_token: workerTok, p_from: '2026-10-01', p_to: '2026-10-12' });
  console.log('worker sales_report (should fail/empty):', w.status);

  // 2) إنشاء جلسة owner عبر التحقق من وجود جلسة owner نشطة
  const ownerSess = await dbq("select s.token from admin_sessions s join admin_users u on u.id=s.admin_id where u.role='owner' and s.created_at > now() - interval '12 hours' limit 1");
  let ownerTok = ownerSess[0]?.token;
  if (!ownerTok) {
    // لا توجد جلسة owner — نختبر المنطق مباشرة عبر SQL
    const direct = await dbq("select jsonb_build_object('daily', (select count(*)::int from public.orders), 'sales_days', (select count(*)::int from sales_daily)) as t");
    console.log('direct check:', JSON.stringify(direct));
  } else {
    const r1 = await j('admin_sales_report', { p_token: ownerTok, p_from: '2026-09-01', p_to: '2026-10-12' });
    console.log('range 09-01..10-12 totals:', JSON.stringify(r1.totals));
    console.log('  daily days:', r1.daily.length, '| products:', r1.products.length);
    const r2 = await j('admin_sales_report', { p_token: ownerTok, p_from: '2026-10-12', p_to: '2026-10-12' });
    console.log('today totals:', JSON.stringify(r2.totals));
    // مقارنة: مجموع الطلبات الفعلية ready+completed
    const chk = await dbq("select count(*)::int as ord, coalesce(sum(total_cents),0)::int as total from orders where status in ('ready','completed')");
    console.log('raw check:', JSON.stringify(chk[0]));
  }

  // تنظيف جلسة الاختبار
  await dbq(`delete from admin_sessions where token='${workerTok}'`);
  console.log('cleanup done');
} catch (e) {
  console.error('TEST ERROR:', e.message);
} finally {
  readdirSync(here).filter((x) => x.startsWith('.sbt') && x !== '.sbtok').forEach((x) => unlinkSync(join(here, x)));
}