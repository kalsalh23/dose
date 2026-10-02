import { readFileSync, writeFileSync } from 'node:fs';
const fail = (m) => { console.error('MISSING: ' + m); process.exit(1); };

// 1) types.ts
const tf = 'src/lib/types.ts';
let ty = readFileSync(tf, 'utf8').replace(/\r\n/g, '\n');
const prodOld = `export interface Product {
  id: number; category_id: number; category: string; name_ar: string; name_en: string;
  description_ar: string; price_cents: number; points: number; image_url: string; sort_order: number; options?: string;
  is_available?: boolean;
}`;
if (!ty.includes(prodOld)) fail('product type');
ty = ty.replace(prodOld, prodOld.replace('is_available?: boolean;', 'is_available?: boolean;\n  sale_price_cents?: number | null;'));
const popOld = `export interface PopularProduct { id: number; name_ar: string; name_en: string; price_cents: number; points: number; image_url: string; sold_qty?: number; order_count?: number }`;
if (!ty.includes(popOld)) fail('popular type');
ty = ty.replace(popOld, `export interface PopularProduct { id: number; name_ar: string; name_en: string; price_cents: number; sale_price_cents?: number | null; points: number; image_url: string; sold_qty?: number; order_count?: number }`);
const adOld = `  old_price_cents: number | null; new_price_cents: number | null; discount_percent: number | null; full_screen: boolean; show_in_hero?: boolean;`;
if (!ty.includes(adOld)) fail('ad type');
ty = ty.replace(adOld, adOld + `\n  category_slug?: string | null;`);
writeFileSync(tf, ty);
console.log('types updated');

// 2) الكشك: سعر فعلي + شارة عرض
const kf = 'src/kiosk/KioskApp.tsx';
let k = readFileSync(kf, 'utf8').replace(/\r\n/g, '\n');
// مساعدات
const helperAnchor = `  const products = (catalog?.products ?? []).filter((p) => p.category === cat);`;
if (!k.includes(helperAnchor)) fail('kiosk helper anchor');
k = k.replace(helperAnchor, helperAnchor + `
  const effPrice = (p: { price_cents: number; sale_price_cents?: number | null }) =>
    p.sale_price_cents != null && p.sale_price_cents < p.price_cents ? p.sale_price_cents : p.price_cents;
  const hasOffer = (p: { price_cents: number; sale_price_cents?: number | null }) =>
    p.sale_price_cents != null && p.sale_price_cents < p.price_cents;`);
writeFileSync(kf, k);
console.log('kiosk helpers added (card markup next after inspecting grid)');
