import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
console.log('has الرئيسية marker:', s.includes('/* ============================ الرئيسية'));
const i = s.indexOf('function Home');
console.log('function Home at:', i);
console.log('context:', JSON.stringify(s.slice(i - 120, i + 40)));
const j = s.indexOf('/* ============================ صفحة المنتج');
console.log('product marker at:', j);
if (j < 0) {
  const k = s.indexOf('function ProductSheet');
  console.log('ProductSheet at:', k);
  console.log('context:', JSON.stringify(s.slice(k - 120, k + 40)));
}
