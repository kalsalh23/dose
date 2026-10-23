// جعل الأفاتار + الاسم في الهيدر رابطًا إلى صفحة الحساب
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

const old = `<div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-[#EAC98F] text-base font-black text-[#221B12] shadow-md">
                  {session.customer.full_name.trim().charAt(0)}
                </span>
                <div className="leading-tight">
                  <p className="text-[10px] font-bold text-[#94826A]">أهلًا بك</p>
                  <p className="text-[15px] font-black text-[#221B12]">{session.customer.full_name.split(' ')[0]}</p>
                </div>
              </div>`;

const nw = `<Link to="/account" className="flex items-center gap-3" aria-label="حسابي">
                <span className="grid size-11 place-items-center rounded-full bg-[#EAC98F] text-base font-black text-[#221B12] shadow-md">
                  {session.customer.full_name.trim().charAt(0)}
                </span>
                <div className="leading-tight">
                  <p className="text-[10px] font-bold text-[#94826A]">أهلًا بك</p>
                  <p className="text-[15px] font-black text-[#221B12]">{session.customer.full_name.split(' ')[0]}</p>
                </div>
              </Link>`;

if (!s.includes(old)) { console.error('avatar block not found'); process.exit(1); }
s = s.replace(old, nw);
writeFileSync(f, s);
console.log('avatar is now a Link to /account');
