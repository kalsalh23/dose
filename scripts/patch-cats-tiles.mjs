// إعادة تصميم الفئات — استبدال الدالة بالكامل عبر مواضع المؤشرات
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

const start = s.indexOf('function FeaturedCategories');
const end = s.indexOf('/* بطاقة كود الخصم المنشور */');
if (start < 0 || end < 0 || end <= start) { console.error('FeaturedCategories bounds not found', start, end); process.exit(1); }

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

s = s.slice(0, start) + L.join('\n') + '\n' + s.slice(end);
writeFileSync(f, s);
console.log('categories restyled to image tiles');
