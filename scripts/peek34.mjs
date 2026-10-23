import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
let i = -1;
while ((i = s.indexOf('الأكثر طلبًا — بطاقات أفقية', i + 1)) > 0) {
  const line = s.slice(0, i).split('\n').length;
  console.log('line', line, ':', JSON.stringify(s.slice(i - 60, i + 60)));
}
