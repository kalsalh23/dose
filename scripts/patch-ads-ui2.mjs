import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/admin/AdminApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* 1) شارة مكان الظهور في بطاقة القائمة */
const oldTitle = `                <p className="text-sm font-extrabold text-coffee-900">{a.title} {a.full_screen && <span className="ms-1 rounded-full bg-gold/20 px-2 py-0.5 text-[9px] font-black text-gold-deep">ملء الشاشة</span>}</p>`;
if (!s.includes(oldTitle)) fail('ads card title');
const newTitle = `                <p className="text-sm font-extrabold text-coffee-900">{a.title}
                  <span className={\`ms-2 rounded-full px-2 py-0.5 text-[9px] font-black \${a.full_screen ? 'bg-[#414D36] text-[#C9D3A8]' : 'bg-[#D5DEB4] text-[#414D36]'}\`}>
                    {a.full_screen ? 'ملء الشاشة' : 'ضمن الهيرو'}
                  </span>
                </p>`;
s = s.replace(oldTitle, newTitle);

/* 2) سطر مدة الظهور تحت الوصف */
const oldDesc = `                <p className="mt-0.5 text-xs text-neutral-500">{a.description_ar}</p>`;
if (!s.includes(oldDesc)) fail('ads desc');
s = s.replace(oldDesc, oldDesc + `
                <p className="mt-0.5 text-[10px] font-bold text-neutral-400">
                  {a.full_screen ? '🖥️ يظهر بملء الشاشة عند الدخول' : '📱 يظهر ضمن الهيرو المتنقل'}
                  {a.ends_at ? ' · حتى ' + new Date(a.ends_at).toLocaleDateString('ar-SY', { day: 'numeric', month: 'short' }) : ' · بلا نهاية'}
                </p>`);

writeFileSync(f, s);
console.log('ads card badges added');
