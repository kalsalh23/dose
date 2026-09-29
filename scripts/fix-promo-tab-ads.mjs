// 1) إصلاح جلب الكتالوج في PromoTab (استخدام sb.rpc)  2) إعادة إعلان ملء الشاشة
import { readFileSync, writeFileSync } from 'node:fs';

/* ===== إصلاح PromoTab ===== */
const af = 'src/admin/AdminApp.tsx';
let a = readFileSync(af, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

const oldFetch = "  useEffect(() => { fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/get_catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.json()).then(setCatalog).catch(() => {}); }, []);";
if (!a.includes(oldFetch)) fail('catalog fetch');
a = a.replace(oldFetch, "  useEffect(() => { sb.rpc('get_catalog').then(({ data }) => setCatalog(data as any)).catch(() => {}); }, []);");
writeFileSync(af, a);
console.log('PromoTab catalog fetch fixed');

/* ===== إعادة إعلان ملء الشاشة ===== */
const token = process.env.SB_TOKEN;
if (!token) { console.error('Missing SB_TOKEN'); process.exit(1); }
const sql = `insert into public.advertisements (image_url, title, description_ar, old_price_cents, new_price_cents, discount_percent, is_active, full_screen, show_in_hero)
select '/img/latte.jpg', 'عرض الصباح', 'لاتيه + كوكيز بسعر خاص', 45000, 38000, 15, true, true, true
where not exists (select 1 from public.advertisements where title = 'عرض الصباح');
select id, title, is_active, full_screen, show_in_hero from public.advertisements order by id;`;
fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }),
}).then(async x => console.log('ad restored:', x.status, (await x.text()).slice(0, 250)));
