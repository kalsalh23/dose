import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
console.log('has الأكثر طلبًا marker:', s.includes('      {/* الأكثر طلبًا — بطاقات أفقية */}'));
const i = s.indexOf('      {/* الأكثر طلبًا — بطاقات أفقية */}');
console.log(JSON.stringify(s.slice(i - 120, i + 60)));
