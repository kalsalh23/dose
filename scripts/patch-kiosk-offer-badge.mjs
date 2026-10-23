import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/kiosk/KioskApp.tsx';
let k = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const anchor = `                    <div className="relative min-h-0 flex-1 overflow-hidden" style={{ background: '#D5DEB4' }}>
                      <img src={p.image_url} alt={p.name_ar} className="size-full object-cover" loading="lazy" />`;
if (!k.includes(anchor)) { console.error('KIOSK CARD ANCHOR NOT FOUND'); process.exit(1); }
k = k.replace(anchor, anchor + `
                      {hasOffer(p) && (
                        <span className="absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white" style={{ background: '#C4482E' }}>عرض</span>
                      )}`);
writeFileSync(f, k);
console.log('kiosk offer badge added');
