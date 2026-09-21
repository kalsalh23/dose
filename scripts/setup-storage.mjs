// إنشاء حاوية تخزين الصور وسياساتها — set SB_TOKEN=xxx && node scripts/setup-storage.mjs
const REF = 'mqstsxuscqbxnyejhixk';
const token = process.env.SB_TOKEN;
if (!token) { console.error('Missing SB_TOKEN'); process.exit(1); }

const sql = `
-- حاوية الصور العامة (قراءة عامة، رفع عبر anon فقط من لوحة الإدارة)
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update set public = true;

drop policy if exists "public read images" on storage.objects;
create policy "public read images" on storage.objects
  for select using (bucket_id = 'images');

drop policy if exists "anon upload images" on storage.objects;
create policy "anon upload images" on storage.objects
  for insert to anon with check (bucket_id = 'images');

select id, public from storage.buckets where id = 'images';
`;

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
console.log('Status:', res.status);
console.log((await res.text()).slice(0, 500));
