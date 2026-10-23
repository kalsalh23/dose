import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
let t = readFileSync(join(here, 'fix-create-order-availability.sql'), 'utf8');

// إزالة سطر التعليق الأول (يتكرر)
t = t.replace(/^-- create_order: يرفض الطلب على منتج غير متوفر \(نفاد كمية\)\n/, '');

// إجمالي الطلب بالسعر الفعلي
const totalOld = `    v_total := v_total + prod.price_cents * v_qty;`;
if (!t.includes(totalOld)) { console.error('TOTAL ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(totalOld, `    v_total := v_total + coalesce(prod.sale_price_cents, prod.price_cents) * v_qty;`);

// المبلغ المشمول بالخصم بالسعر الفعلي (موضعان)
const subOld = `        if ptg <> '' and prod.id = ptg::int then
          v_promo_subtotal := v_promo_subtotal + prod.price_cents * v_qty;
        end if;
      elsif psc = 'category' and prod.category_id = ptg_cat then
        v_promo_subtotal := v_promo_subtotal + prod.price_cents * v_qty;
      end if;`;
if (!t.includes(subOld)) { console.error('SUBTOTAL ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(subOld, `        if ptg <> '' and prod.id = ptg::int then
          v_promo_subtotal := v_promo_subtotal + coalesce(prod.sale_price_cents, prod.price_cents) * v_qty;
        end if;
      elsif psc = 'category' and prod.category_id = ptg_cat then
        v_promo_subtotal := v_promo_subtotal + coalesce(prod.sale_price_cents, prod.price_cents) * v_qty;
      end if;`);

// بند الطلب يخزّن السعر الفعلي
const itemOld = `    values (o.id, prod.id, prod.name_ar, prod.name_en, prod.price_cents, (it->>'qty')::int, prod.points, coalesce(it->>'options',''));`;
if (!t.includes(itemOld)) { console.error('ITEM ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(itemOld, `    values (o.id, prod.id, prod.name_ar, prod.name_en, coalesce(prod.sale_price_cents, prod.price_cents), (it->>'qty')::int, prod.points, coalesce(it->>'options',''));`);

// إلحاقه بسكربت الإعلانات والعروض
const base = readFileSync(join(here, 'category-ads-sale.sql'), 'utf8');
writeFileSync(join(here, 'category-ads-sale.sql'), base + t);
console.log('create_order (effective price) appended, total file:', base.length + t.length);
