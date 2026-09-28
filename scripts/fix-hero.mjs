// إصلاح الهيرو: المحتوى فوق الخلفية بشكل صحيح + تعتيم متوازن
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// 1) تعتيم متوازن يُظهر الصورة ويحافظ على النص
const oldOverlay = '        <div className="absolute inset-0 bg-gradient-to-bl from-[#414D36]/95 via-[#3A4531]/80 to-[#26301C]/90" />';
if (!s.includes(oldOverlay)) { console.error('overlay not found'); process.exit(1); }
const newOverlay = '        <div className="absolute inset-0 bg-gradient-to-bl from-[#26301C]/75 via-[#3A4531]/55 to-[#414D36]/70" />';
s = s.replace(oldOverlay, newOverlay);

// 2) المحتوى داخل حاوية relative فوق الخلفية
const oldContent = `        <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-[#C9D3A8]">قهوة مختصة في كل رشفة</span>`;
if (!s.includes(oldContent)) fail('badge');
const newContent = `        <div className="relative">
        <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-[#C9D3A8]">قهوة مختصة في كل رشفة</span>`;
s = s.replace(oldContent, newContent);

// 3) إغلاق الحاوية بعد صف الزر والكود
const oldEnd = `          <button onClick={scrollToMenu}
            className='flex items-center gap-1.5 rounded-full bg-[#C9D3A8] px-4 py-2.5 text-[13px] font-black text-[#26301C] shadow-lg transition active:scale-95'>
            اطلب الآن <Icon name="plus" size={14} strokeWidth={3} />
          </button>
        </div>
      </div>`;
if (!s.includes(oldEnd)) fail('hero end');
const newEnd = `          <button onClick={scrollToMenu}
            className='flex items-center gap-1.5 rounded-full bg-[#C9D3A8] px-4 py-2.5 text-[13px] font-black text-[#26301C] shadow-lg transition active:scale-95'>
            اطلب الآن <Icon name="plus" size={14} strokeWidth={3} />
          </button>
        </div>
        </div>
      </div>`;
s = s.replace(oldEnd, newEnd);

writeFileSync(f, s);
console.log('hero fixed: content above overlay + balanced transparency');
