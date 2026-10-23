import { readFileSync } from 'node:fs';
const t = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
let i = -1;
console.log('--- fmtDateTime usages ---');
while ((i = t.indexOf('fmtDateTime(', i + 1)) > 0) {
  if (t.slice(i - 15, i).includes('Num')) continue;
  console.log(JSON.stringify(t.slice(i - 90, i + 60).replace(/\n/g, '|')));
}
const j = t.indexOf('function SignupPage');
console.log('--- SignupPage ---');
console.log(t.slice(j, j + 2300));
