import { readFileSync } from 'node:fs';
const s = readFileSync('src/admin/AdminApp.tsx', 'utf8');
const i = s.indexOf('function AdsTab');
const j = s.indexOf('حفظ ونشر', i);
const seg = s.slice(i, j);
const fields = [...seg.matchAll(/<Field label="([^"]+)"/g)].map((m) => m[1]);
const selects = [...seg.matchAll(/<select className={inputCls} value=\{edit\.([a-z_]+)\}/g)].map((m) => m[1]);
console.log('fields:', JSON.stringify(fields));
console.log('select binds:', JSON.stringify(selects));
