import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/customer/CustomerApp.tsx';
let t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const old = `import { eur, fmtDateTime, deviceId, getCurrentLocation, urlBase64ToUint8Array, shopStatus, fmtDateNum } from '../lib/utils';`;
if (!t.includes(old)) { console.error('IMPORT ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(old, `import { eur, fmtDateTime, fmtDateTimeNum, deviceId, getCurrentLocation, urlBase64ToUint8Array, shopStatus, fmtDateNum } from '../lib/utils';`);
// تأكد ألا توجد استخدامات أخرى لاستيرادات ناقصة
const uses = (t.match(/fmtDateTimeNum\(/g) || []).length;
writeFileSync(f, t);
console.log('import fixed; fmtDateTimeNum uses in file:', uses);
