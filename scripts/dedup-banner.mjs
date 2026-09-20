// إزالة تكرار البانر من Home (يبقى في إطار التطبيق تحت الهيدر فقط)
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'src/customer/CustomerApp.tsx';
let s = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// 1) حذف استخدام OfferBanners داخل Home (مع سطر التعليق الخاص به)
const usage = '      {/* بانر العروض — متصل بالشريط العلوي */}\n      <OfferBanners ads={catalog?.ads ?? []} cur={cur} onOpen={onOpenAd} />\n\n';
if (!s.includes(usage)) { console.error('Home usage not found'); process.exit(1); }
s = s.replace(usage, '');

// 2) إرجاع توقيع Home بلا onOpenAd
s = s.replace(
  'function Home({ catalog, openProduct, onOpenAd }: { catalog: Catalog | null; openProduct: (p: Product) => void; onOpenAd: (a: Ad) => void })',
  'function Home({ catalog, openProduct }: { catalog: Catalog | null; openProduct: (p: Product) => void })'
);

// 3) إزالة الخاصية من المسار
s = s.replace(' onOpenAd={(a) => setAdOpen(a)}', '');

writeFileSync(file, s);
console.log('dedup done | <OfferBanners count:', s.split('<OfferBanners').length - 1);
