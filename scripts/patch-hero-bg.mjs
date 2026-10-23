// خلفية صورة للهيرو مع تدرج داكن يحافظ على وضوح النص
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

const old = `      <div className="relative overflow-hidden rounded-[1.8rem] bg-gradient-to-bl from-[#414D36] to-[#26301C] p-5 text-white shadow-xl shadow-[#26301C]/40">
        <div className="pointer-events-none absolute -bottom-16 -left-10 size-44 rounded-full bg-white/5 blur-2xl" />`;
if (!s.includes(old)) { console.error('hero block not found'); process.exit(1); }
const nw = `      <div className="relative overflow-hidden rounded-[1.8rem] p-5 text-white shadow-xl shadow-[#26301C]/40">
        <img src="/img/v60.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-bl from-[#414D36]/95 via-[#3A4531]/80 to-[#26301C]/90" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 size-44 rounded-full bg-white/5 blur-2xl" />`;
s = s.replace(old, nw);
writeFileSync(f, s);
console.log('hero background image added');
