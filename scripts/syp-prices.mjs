// تحويل الأسعار لليرة السورية + الإعلان الحصري — set SB_TOKEN=xxx && node scripts/syp-prices.mjs
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REF = 'mqstsxuscqbxnyejhixk';
const token = process.env.SB_TOKEN;
if (!token) { console.error('Missing SB_TOKEN'); process.exit(1); }

const sql = `
-- أسعار المنتجات بالليرة السورية (2026)
update public.products p set price_cents = v.price
from (values
  ('إسبريسو',15000),('ماكياتو',20000),('أمريكانو',20000),('كابتشينو',25000),
  ('لاتيه',25000),('موكا',30000),('كراميل ماكياتو',30000),
  ('آيس لاتيه',30000),('آيس موكا',30000),
  ('كيك الشوكولاتة',35000),('كيك الفانيليا',30000),('كوكيز',20000),
  ('شوت إسبريسو إضافي',10000),('كراميل إضافي',5000),('حليب إضافي',5000)
) as v(name_ar, price)
where p.name_ar = v.name_ar;

-- عملة المنصة
insert into public.settings (key, value) values ('currency_symbol','ل.س')
on conflict (key) do update set value = excluded.value;

-- أسعار الإعلانات بالليرة + الإعلان الحصري ملء الشاشة
update public.advertisements set old_price_cents = 45000, new_price_cents = 38000, discount_percent = 15, full_screen = true
where title = 'عرض الصباح';
update public.advertisements set old_price_cents = 30000, new_price_cents = 26000, discount_percent = 13, full_screen = false
where title = 'عرض المشروبات الباردة';

select name_ar, price_cents from public.products order by id limit 5;
select title, new_price_cents, full_screen from public.advertisements;
`;

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
console.log('Status:', res.status);
console.log((await res.text()).slice(0, 1500));
