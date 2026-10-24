import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/customer/CustomerApp.tsx';
let t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const old = `        {contactRow('pin', 'موقع المحل', '35.132845 , 36.752617', 'https://www.google.com/maps?q=35.132845,36.752617')}`;
if (!t.includes(old)) { console.error('CONTACT ROW NOT FOUND'); process.exit(1); }
const nw = `        {contactRow('pin', 'موقع المحل',
          (catalog?.settings?.shop_lat ?? '35.132845') + ' , ' + (catalog?.settings?.shop_lng ?? '36.752617'),
          'https://www.google.com/maps?q=' + (catalog?.settings?.shop_lat ?? '35.132845') + ',' + (catalog?.settings?.shop_lng ?? '36.752617'))}`;
t = t.replace(old, nw);
writeFileSync(f, t);
console.log('contacts location now dynamic from settings');
