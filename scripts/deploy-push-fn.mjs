// نشر Edge Function + الأسرار على Supabase
import { readFile } from 'node:fs/promises';

const REF = 'mqstsxuscqbxnyejhixk';
const token = process.env.SB_TOKEN;
if (!token) { console.error('Missing SB_TOKEN'); process.exit(1); }

const PRIV = 'EnOtLPe5imqe0uyJum7rq5oGKgkR48O--HIiPvjyueQ';
const PUB = 'BCDKL0U34tZgWEGIygt6PLe6tpX_7kOn4bkavZYoO6OAPdEBC0kjDpLxuDouKqWNqjgsC5h9V2gNJ08POBsRLmo';

// 1) الأسرار
const sec = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify([
    { name: 'VAPID_PUBLIC_KEY', value: PUB },
    { name: 'VAPID_PRIVATE_KEY', value: PRIV },
  ]),
});
console.log('secrets:', sec.status, (await sec.text()).slice(0, 150));

// 2) نشر الدالة (multipart بالصيغة المعتمدة)
const code = await readFile('supabase/functions/push/index.ts', 'utf8');
const form = new FormData();
form.append('metadata', new Blob([JSON.stringify({ name: 'push', entrypoint_path: 'index.ts', verify_jwt: false })], { type: 'application/json' }));
form.append('file1', new File([code], 'index.ts', { type: 'text/plain' }));
const dep = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/deploy?slug=push`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
console.log('deploy:', dep.status, (await dep.text()).slice(0, 300));
