import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const count = (str) => s.split(str).length - 1;
console.log('hero badge (قهوة مختصة في كل رشفة):', count('قهوة مختصة في كل رشفة'));
console.log('function Home:', count('function Home'));
console.log('استكشف المنيو:', count('استكشف المنيو'));
console.log('PromoBanner renders:', count('<PromoBanner'));
console.log('OfferBanners renders:', count('<OfferBanners'));
// مواضع الهيرو
let i = -1;
while ((i = s.indexOf('قهوة مختصة في كل رشفة', i + 1)) > 0) {
  const lineNum = s.slice(0, i).split('\n').length;
  console.log('hero at line', lineNum, ':', JSON.stringify(s.slice(i - 80, i + 30)));
}
