// تنزيل صور تصنيفات المنيو الجديد
import { writeFile, mkdir } from 'node:fs/promises';

const IMG = 'https://images.unsplash.com/';
const qs = '?q=80&w=900&auto=format&fit=crop';

const SLOTS = {
  'v60':        ['photo-1544787219-7f47ccb76574', 'photo-1511920170033-f8396924c348'],
  'hotchoc':    ['photo-1542990253-a781e04c0082', 'photo-1607260550644-61fffbc2a2c2'],
  'tea':        ['photo-1597318181409-cf64d0b5d8a2', 'photo-1556679343-c7306c1976bc'],
  'icetea':     ['photo-1556679343-c7306c1976bc', 'photo-1497534446932-c925b458314e'],
  'matcha':     ['photo-1515823064-d6e0c04616a7', 'photo-1536256263959-770b48d82b0a'],
  'shake':      ['photo-1572490122747-3968b75cc699', 'photo-1578314675249-a6910f80cc4e'],
  'frappe':     ['photo-1577805947697-89e18249d767', 'photo-1461023058943-07fcbe16d735'],
  'juice':      ['photo-1613478223719-2ab802602423', 'photo-1600271886742-f049cd451bba'],
  'mojito':     ['photo-1551538827-9c037cb4f32a', 'photo-1596803244897-52a9ad69a09e'],
  'smoothie':   ['photo-1553530666-ba11a7da3888', 'photo-1626799664887-b7667024c69e'],
};

async function grab(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 10000) return null;
    return buf;
  } catch { return null; }
}

await mkdir('public/img', { recursive: true });
const failed = [];
for (const [name, ids] of Object.entries(SLOTS)) {
  let done = false;
  for (const id of ids) {
    const buf = await grab(`${IMG}${id}${qs}`);
    if (buf) { await writeFile(`public/img/${name}.jpg`, buf); console.log('OK', name, Math.round(buf.length / 1024) + 'KB'); done = true; break; }
  }
  if (!done) { failed.push(name); console.log('FAIL', name); }
}
if (failed.length) process.exit(2);
console.log('DONE');
