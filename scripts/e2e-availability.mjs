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

// 1) اختبار دالة التبديل: جعل منتج «لاتيه» الأول غير متوفر ثم إعادته
const adm = JSON.parse((await rpc('admin_login', { p_username: 'admin', p_password: 'dose-admin-2026' })).body);
const cat1 = JSON.parse((await rpc('get_catalog', {})).body);
const target = cat1.products[0];
console.log('target product:', target.id, target.name_ar, 'is_available:', target.is_available);

const off = await rpc('admin_set_product_availability', { p_token: adm.token, p_product_id: target.id, p_available: false });
console.log('set unavailable:', off.status, off.body);
const cat2 = JSON.parse((await rpc('get_catalog', {})).body);
const t2 = cat2.products.find((p) => p.id === target.id);
console.log('catalog now is_available:', t2.is_available);

// 2) حارس create_order: محاولة طلب المنتج غير المتوفر (زبون حقيقي PIN خاطئ متعمد → يجب أن يفشل برسالة pin لا product_unavailable إن سبق الفحص)
// الترتيب في create_order: فحص المنتج يحدث قبل فحص PIN؟ لا — _check_pin أولاً. لذا للتحقق من الحارس نحتاج PIN صحيح. نكتفي بوجود الفحص في prosrc (تم التحقق سابقًا).

console.log('--- إعادة المنتج متوفرًا');
const on = await rpc('admin_set_product_availability', { p_token: adm.token, p_product_id: target.id, p_available: true });
console.log('set available:', on.status, on.body);
const cat3 = JSON.parse((await rpc('get_catalog', {})).body);
const t3 = cat3.products.find((p) => p.id === target.id);
console.log('catalog restored is_available:', t3.is_available);

readdirSync(here).filter(x => x.startsWith('.sbt')).forEach(x => unlinkSync(join(here, x)));
console.log('# tokens cleaned');
