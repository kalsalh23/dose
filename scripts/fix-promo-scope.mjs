import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* تعريف promoCode/promoDisc في نطاق CustomerApp الجذري */
const anchor = "  const waNumber = catalog?.settings?.whatsapp_number ?? '963936107119';";
if (!s.includes(anchor)) fail('waNumber anchor');
if (s.includes('  const promoCode = catalog?.settings?.promo_code;\n  const waNumber')) { console.log('already defined'); process.exit(0); }
s = s.replace(anchor, "  const promoCode = catalog?.settings?.promo_code;\n  const promoDisc = catalog?.settings?.promo_discount;\n" + anchor);

writeFileSync(f, s);
console.log('root promo vars defined');
