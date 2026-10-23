import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
let i = -1;
while ((i = s.indexOf('<OfferBanners', i + 1)) > 0) {
  const line = s.slice(0, i).split('\n').length;
  console.log('render at line', line, ':', JSON.stringify(s.slice(i - 150, i + 90)));
}
// وعدد استكشف المنيو
let j = -1;
while ((j = s.indexOf('استكشف المنيو', j + 1)) > 0) {
  const line = s.slice(0, j).split('\n').length;
  console.log('استكشف المنيو at line', line);
}
