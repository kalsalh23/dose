import { readFileSync } from 'node:fs';
const t = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const i = t.indexOf('function SignupPage');
const s = t.slice(i, i + 5000);
const k = s.indexOf('avatarUrl');
console.log(s.slice(s.indexOf('return ('), s.indexOf('return (') + 2600));
