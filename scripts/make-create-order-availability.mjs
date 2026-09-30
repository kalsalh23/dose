import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
let t = readFileSync(join(here, 'fix-promo-scope-order.sql'), 'utf8');
const old = `    if prod is null then raise exception 'invalid_product'; end if;
    if v_qty < 1 or v_qty > 50 then raise exception 'invalid_qty'; end if;`;
const nw = `    if prod is null then raise exception 'invalid_product'; end if;
    if prod.is_available = false then raise exception 'product_unavailable'; end if;
    if v_qty < 1 or v_qty > 50 then raise exception 'invalid_qty'; end if;`;
if (!t.includes(old)) { console.log('ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(old, nw);
// رأس توضيحي
t = '-- create_order: يرفض الطلب على منتج غير متوفر (نفاد كمية)\n' + t;
writeFileSync(join(here, 'fix-create-order-availability.sql'), t);
console.log('written', t.length);
