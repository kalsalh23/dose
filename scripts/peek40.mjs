import { readFileSync, writeFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
// أعرض أسطر الشرط والهيرو والترحيب في الجذر
let i = -1;
while ((i = s.indexOf('fsAd', i + 1)) > 0) {
  const line = s.slice(0, i).split('\n').length;
  console.log('line', line, ':', JSON.stringify(s.slice(i - 60, i + 80)));
}
