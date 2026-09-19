// تنزيل صور المنتجات (Unsplash) ومكتبة supabase-js محليًا
// الاستخدام: node scripts/fetch-assets.mjs
import { writeFile, mkdir } from 'node:fs/promises';

const IMG = 'https://images.unsplash.com/';
const qs = '?q=80&w=900&auto=format&fit=crop';

// قائمة مرشحين لكل منتج — يُستخدم أول رابط يعمل
const SLOTS = {
  'americano':         ['photo-1551030173-122aabc4489c', 'photo-1514432324607-a09d9b4aefdd', 'photo-1459755486867-b55449bb39ff'],
  'latte':             ['photo-1561047029-3000c68339ca', 'photo-1534778101976-62847782c213', 'photo-1541167760496-1628856ab772', 'photo-1519676867240-f03562e64548'],
  'cappuccino':        ['photo-1572442388796-11668a67e53d', 'photo-1509042239860-f550ce710b93', 'photo-1553909489-cd47e0907980'],
  'mocha':             ['photo-1578314675249-a6910f80cc4e', 'photo-1577805947697-89e18249d767', 'photo-1542990253-a781e04c0082'],
  'espresso':          ['photo-1510707577719-ae7c14805e3a', 'photo-1585494156145-1c60a4fe952b', 'photo-1521305916504-4a1121188589'],
  'macchiato':         ['photo-1610889556528-9a770e32642f', 'photo-1553909489-cd47e0907980', 'photo-1522992319-0365e5f11656'],
  'caramel-macchiato': ['photo-1485808191679-5f86510681a2', 'photo-1461023058943-07fcbe16d735', 'photo-1577595166653-c4b06b30fa1a'],
  'iced-latte':        ['photo-1461023058943-07fcbe16d735', 'photo-1517701550927-30cf4ba1dba5', 'photo-1524350876685-274059332603'],
  'iced-mocha':        ['photo-1517701550927-30cf4ba1dba5', 'photo-1577595166653-c4b06b30fa1a', 'photo-1558122104-355edad709f6'],
  'chocolate-cake':    ['photo-1578985545062-69928b1d9587', 'photo-1605807646983-377bc5a76493', 'photo-1624353365286-3f8d62daad51'],
  'vanilla-cake':      ['photo-1565958011703-44f9829ba187', 'photo-1587314168485-3236d6710814', 'photo-1481391319762-47dff72954d9'],
  'cookies':           ['photo-1499636136210-6f4ee915583e', 'photo-1558961363-fa8fdf82db35', 'photo-1590080875029-253d58c52328'],
  'bg-beans':          ['photo-1447933601403-0c6688de566e', 'photo-1495474472287-4d71bcdd2085', 'photo-1442512595331-e89e73853f31'],
};

async function grab(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 15000) return null;
    return buf;
  } catch { return null; }
}

await mkdir('assets/img', { recursive: true });
await mkdir('vendor', { recursive: true });

const failed = [];
for (const [name, ids] of Object.entries(SLOTS)) {
  if (name === 'bg-beans') continue;
  let done = false;
  for (const id of ids) {
    const buf = await grab(`${IMG}${id}${qs}`);
    if (buf) {
      await writeFile(`assets/img/${name}.jpg`, buf);
      console.log(`OK  ${name}.jpg  (${Math.round(buf.length / 1024)} KB)  <- ${id}`);
      done = true;
      break;
    }
  }
  if (!done) { failed.push(name); console.log(`FAIL ${name}`); }
}

// خلفية الفاصل بعرض أكبر
{
  let done = false;
  for (const id of SLOTS['bg-beans']) {
    const buf = await grab(`${IMG}${id}?q=75&w=1600&auto=format&fit=crop`);
    if (buf) {
      await writeFile('assets/img/bg-beans.jpg', buf);
      console.log(`OK  bg-beans.jpg (${Math.round(buf.length / 1024)} KB) <- ${id}`);
      done = true;
      break;
    }
  }
  if (!done) { failed.push('bg-beans'); console.log('FAIL bg-beans'); }
}

// مكتبة supabase-js محليًا
{
  const res = await fetch('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js');
  if (res.ok) {
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile('vendor/supabase.js', buf);
    console.log(`OK  vendor/supabase.js (${Math.round(buf.length / 1024)} KB)`);
  } else {
    failed.push('supabase.js');
    console.log('FAIL supabase.js');
  }
}

if (failed.length) { console.log('FAILED SLOTS:', failed.join(', ')); process.exit(2); }
console.log('ALL DONE');
