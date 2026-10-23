import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
let i = -1;
let n = 0;
while ((i = s.indexOf('نقطة</p>', i + 1)) > 0) {
  n++;
  const line = s.slice(0, i).split('\n').length;
  console.log('occurrence', n, 'at line', line, ':', JSON.stringify(s.slice(i - 120, i + 12)));
}
