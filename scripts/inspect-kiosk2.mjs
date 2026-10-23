import { readFileSync } from 'node:fs';
const t = readFileSync('src/kiosk/KioskApp.tsx', 'utf8');
let i = -1;
console.log('--- signup refs ---');
while ((i = t.indexOf('signup', i + 1)) > 0) console.log(JSON.stringify(t.slice(i - 70, i + 70).replace(/\n/g, '|')));
const j = t.indexOf("step === 'pin'");
console.log('--- pin step render ---');
console.log(j < 0 ? 'NO pin step' : t.slice(j - 150, j + 800));
// type Step
const s = t.indexOf('type Step');
console.log('--- Step type ---');
console.log(t.slice(s, s + 120));
// لا أملك حساب
const n = t.indexOf('لا أملك حساب');
console.log('--- no-account btn ---');
console.log(t.slice(n - 200, n + 120));
