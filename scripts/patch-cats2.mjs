// استبدال الفئات ببطاقات صور + إضافة بطاقة كود الخصم
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

const start = s.indexOf('function FeaturedCategories');
const end = s.indexOf('/* ============================ الرئيسية ============================ */');
if (start < 0 || end < 0 || end <= start) { console.error('bounds not found', start, end); process.exit(1); }

const L = [];
L.push("function FeaturedCategories({ catalog, cat, setCat }: { catalog: Catalog | null; cat: string; setCat: (s: string) => void }) {");
L.push("  const items = [{ slug: 'all', name_ar: 'الكل' }, ...(catalog?.categories ?? [])];");
L.push("  return (");
L.push('    <section className="mt-6">');
L.push('      <h2 className="mb-3 text-[17px] font-black text-[#26301C]">فئات مميزة</h2>');
L.push('      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">');
L.push('        {items.map((c) => {');
L.push("          const active = cat === c.slug;");
L.push('          return (');
L.push('            <button key={c.slug} onClick={() => setCat(c.slug)}');
L.push("              className={`relative h-24 w-32 flex-none overflow-hidden rounded-[1.3rem] shadow-md transition active:scale-95 anim-rise ${active ? 'ring-[3px] ring-[#5C6B3C]' : 'ring-1 ring-[#D5DEB4]'}`}>");
L.push("              {c.slug === 'all'");
L.push('                ? <span className="grid size-full place-items-center bg-gradient-to-br from-[#414D36] to-[#26301C] text-[#C9D3A8]"><Icon name="package" size={24} /></span>');
L.push("                : <img src={CAT_IMAGES[c.slug] ?? '/img/latte.jpg'} alt={c.name_ar} className='size-full object-cover' loading='lazy' />}");
L.push('              <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />');
L.push('              <span className="absolute inset-x-0 bottom-0 pb-2 text-center text-[12px] font-black text-white drop-shadow">{c.name_ar}</span>');
L.push('            </button>');
L.push('          );');
L.push('        })}');
L.push('      </div>');
L.push('    </section>');
L.push('}');
L.push('');
L.push('/* بطاقة كود الخصم المنشور */');
L.push('function PromoBanner({ settings }: { settings: Record<string, string> }) {');
L.push("  const code = settings?.promo_code;");
L.push('  const disc = settings?.promo_discount;');
L.push('  if (!code || !disc) return null;');
L.push('  return (');
L.push('    <div className="mt-4 flex items-center justify-between gap-3 rounded-[1.4rem] border-2 border-dashed border-[#8A6A48] bg-[#F1DCB0] px-4 py-3.5">');
L.push('      <div>');
L.push('        <p className="text-[10px] font-black text-[#7C8665]">🎁 كود خصم حصري</p>');
L.push("        <p className='font-mono text-xl font-black tracking-[.2em] text-[#26301C]' dir='ltr'>{code}</p>");
L.push('        <p className="text-[10.5px] font-bold text-[#7C8665]">استخدمه في الكشك واحصل على خصم {disc}%</p>');
L.push('      </div>');
L.push('      <span className="rounded-full bg-[#26301C] px-3 py-1.5 text-[10px] font-black text-[#C9D3A8]">خصم {disc}%</span>');
L.push('    </div>');
L.push('  );');
L.push('}');
L.push('');

s = s.slice(0, start) + L.join('\n') + '\n' + s.slice(end);

// بطاقة الكود بعد الفئات في الرئيسية
const anchor = `      <FeaturedCategories catalog={catalog} cat={cat} setCat={(c) => { setCat(c); setQ(''); }} />`;
if (!s.includes(anchor)) { console.error('home cats anchor missing'); process.exit(1); }
s = s.replace(anchor, anchor + `

      <PromoBanner settings={catalog?.settings ?? {}} />`);

writeFileSync(f, s);
console.log('categories tiles + promo banner added');
