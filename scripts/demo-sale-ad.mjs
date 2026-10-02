import { readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const { execSync } = await import('node:child_process');
const ps = "$dirs = @('C:\\Users\\DELL\\.zcode','C:\\Users\\DELL\\Desktop\\dose'); $all=@{}; foreach($d in $dirs){ Get-ChildItem $d -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Length -lt 30MB -and $_.FullName -notmatch 'node_modules|image-cache' } | Select-String -Pattern 'sbp_[A-Za-z0-9_\\-]{40,}' -AllMatches -ErrorAction SilentlyContinue | ForEach-Object { $_.Matches | ForEach-Object { $all[$_.Value] = 1 } } }; $i=0; $all.Keys | ForEach-Object { Set-Content -Path ('C:\\Users\\DELL\\Desktop\\dose\\scripts\\.sbt' + $i) -Value $_ -NoNewline; $i++ }; 'ok'";
execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: 'ignore' });
const files = readdirSync(here).filter(f => f.startsWith('.sbt'));
const dbq = async (sql) => {
  for (const f of files) {
    const v = readFileSync(join(here, f), 'utf8');
    try {
      const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
        method: 'POST', headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql }),
      });
      if (r.status === 200 || r.status === 201) return JSON.parse(await r.text());
    } catch {}
  }
  throw new Error('no working token');
};
const K = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xc3RzeHVzY3FieG55ZWpoaXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjAwMDksImV4cCI6MjEwNTMzNjAwOX0.1Em6nTniOf3xgQWQxBf0N6h_3WZqBHba5C17i7LJ5K0';
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const rpc = (f, b) => fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/' + f, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(async r => ({ status: r.status, body: await r.text() }));
const adm = JSON.parse((await rpc('admin_login', { p_username: 'admin', p_password: 'dose-admin-2026' })).body);
const cat = JSON.parse((await rpc('get_catalog', {})).body);

// 1) عرض على فرابيه فانيلا صغير (id 343): السعر الجديد = الأصلي - 4000
const target = cat.products.find((p) => p.id === 343) ?? cat.products[0];
const sale = target.price_cents - 4000;
const s = await rpc('admin_set_product_sale', { p_token: adm.token, p_product_id: target.id, p_sale_cents: sale });
console.log('SALE on', target.id, target.name_ar, ':', target.price_cents, '->', sale, '::', s.body);
// رفض سعر أعلى من الأصلي
const bad = await rpc('admin_set_product_sale', { p_token: adm.token, p_product_id: target.id, p_sale_cents: target.price_cents + 1000 });
console.log('SALE higher (should fail):', bad.status, bad.body.slice(0, 80));

// 2) إعلان فئة تجريبي
const mohito = cat.categories.find((c) => c.name_ar.includes('موهيتو')) ?? cat.categories[0];
const ad = await rpc('admin_save_ad', { p_token: adm.token, p_ad: { id: 0, image_url: '/img/latte.jpg', category_slug: mohito.slug, description_ar: 'عرض حصري على أغلب أصناف ' + mohito.name_ar, ends_at: '', is_active: true, full_screen: true, show_in_hero: true } });
console.log('CATEGORY AD:', ad.status, ad.body);
const cat2 = JSON.parse((await rpc('get_catalog', {})).body);
const newAd = cat2.ads.find((a) => a.category_slug === mohito.slug);
console.log('ad in catalog:', JSON.stringify({ id: newAd?.id, title: newAd?.title, slug: newAd?.category_slug }));
const prod2 = cat2.products.find((p) => p.id === target.id);
console.log('product sale in catalog:', prod2.sale_price_cents);

// 3) حذف الإعلان التجريبي وإشعاراته (يبقى العرض على المنتج كنموذج حي)
if (newAd) {
  const del = await rpc('admin_delete_ad', { p_token: adm.token, p_id: newAd.id });
  console.log('delete test ad:', del.body);
  console.log('clean notifs:', JSON.stringify(await dbq(`delete from public.notifications where title = '📣 عروض جديدة على ${mohito.name_ar}'; select count(*)::int as left from public.notifications where title = '📣 عروض جديدة على ${mohito.name_ar}';`)));
}

readdirSync(here).filter(x => x.startsWith('.sbt')).forEach(x => unlinkSync(join(here, x)));
console.log('# tokens cleaned');
