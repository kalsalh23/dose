// الهيرو المتنقل: يتنقل بين الإعلانات كل 7 ثوانٍ — كود الخصم والزر ثابتان بمكانهما
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

const startMarker = '      {/* الهيرو */}';
const endMarker = '      {/* البحث */}';
const start = s.indexOf(startMarker);
const end = s.indexOf(endMarker);
if (start < 0 || end < 0 || end <= start) { console.error('hero bounds not found'); process.exit(1); }

const L = [];
L.push("      {/* الهيرو — يتنقل بين الإعلانات كل 7 ثوانٍ */}");
L.push("      <div className='relative overflow-hidden rounded-[1.8rem] p-5 text-white shadow-xl shadow-[#26301C]/40'>");
L.push("        {ads.map((a, i) => (");
L.push("          <img key={a.id} src={a.image_url} alt='' className={`absolute inset-0 size-full object-cover transition-opacity duration-1000 ${heroIdx === i ? 'opacity-100' : 'opacity-0'}`} />");
L.push('        ))}');
L.push("        {ads.length === 0 && <img src='/img/v60.jpg' alt='' className='absolute inset-0 size-full object-cover' />}");
L.push("        <div className='absolute inset-0 bg-gradient-to-bl from-[#26301C]/80 via-[#3A4531]/60 to-[#414D36]/75' />");
L.push("        <div className='pointer-events-none absolute -bottom-16 -left-10 size-44 rounded-full bg-white/5 blur-2xl' />");
L.push("        <div className='relative'>");
L.push('          {currentAd ? (');
L.push('            <>');
L.push("              <span className='rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-[#C9D3A8]'>عرض حصري</span>");
L.push("              <h2 className='mt-2.5 text-[22px] font-black leading-snug'>{currentAd.title}</h2>");
L.push("              <p className='mt-1.5 text-[11px] font-medium text-white/80'>{currentAd.description_ar}</p>");
L.push('            </>');
L.push('          ) : (');
L.push('            <>');
L.push("              <span className='rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-[#C9D3A8]'>قهوة مختصة في كل رشفة</span>");
L.push("              <h2 className='mt-2.5 text-[22px] font-black leading-snug'>قهوتك على ذوقك،<br />وحلويات تُدللها</h2>");
L.push("              <p className='mt-1.5 text-[11px] font-medium text-white/75'>اطلب من القهوة والحلويات من المنيو واستمتع بجمع النقاط</p>");
L.push('            </>');
L.push('          )}');
L.push("          <div className='mt-4 flex items-end justify-between gap-2'>");
L.push('            {promoCode && promoDisc ? (');
L.push("              <div className='rounded-xl border-2 border-dashed border-[#C9D3A8]/80 bg-[#26301C]/70 px-2.5 py-1.5 text-center backdrop-blur-sm'>");
L.push("              <p className='text-[8.5px] font-bold text-[#C9D3A8]'>كود خصم {promoDisc}%</p>");
L.push("              <p className='font-mono text-[13px] font-black tracking-widest' dir='ltr'>{promoCode}</p>");
L.push('              </div>');
L.push('            ) : <span />}');
L.push("            <button onClick={scrollToMenu}");
L.push("            className='flex items-center gap-1.5 rounded-full bg-[#C9D3A8] px-4 py-2.5 text-[13px] font-black text-[#26301C] shadow-lg transition active:scale-95'>");
L.push('            اطلب الآن <Icon name="plus" size={14} strokeWidth={3} />');
L.push('          </button>');
L.push('          </div>');
L.push('        </div>');
L.push('      </div>');
L.push('');
L.push('      {/* البحث */}');

s = s.slice(0, start) + L.join('\n') + '\n' + s.slice(end);

/* 1) حالة heroIdx + مؤقت 7 ثوانٍ في Home */
const oldState = "  const menuItems = searching || showAll ? shown : shown.slice(0, 4);";
if (!s.includes(oldState)) fail('menuItems state');
s = s.replace(oldState, `  const menuItems = searching || showAll ? shown : shown.slice(0, 4);

  // الهيرو المتنقل — إعلان كل 7 ثوانٍ
  const [heroIdx, setHeroIdx] = useState(0);
  useEffect(() => {
    if (ads.length <= 1) return;
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % ads.length), 7000);
    return () => clearInterval(t);
  }, [ads.length]);
  const currentAd = ads[heroIdx];`);

/* 2) تمرير ads وonOpenAd لـ Home */
s = s.replace(
  "          <Route path='/' element={<Home catalog={catalog} openProduct={setProduct} />} />",
  "          <Route path='/' element={<Home catalog={catalog} openProduct={setProduct} ads={ads} onOpenAd={(a) => setAdOpen(a)} />} />"
);
s = s.replace(
  '<Route path="/" element={<Home catalog={catalog} openProduct={setProduct} />} />',
  '<Route path="/" element={<Home catalog={catalog} openProduct={setProduct} ads={ads} onOpenAd={(a) => setAdOpen(a)} />} />'
);

/* 3) استقبال ads وonOpenAd في توقيع Home */
s = s.replace(
  'function Home({ catalog, openProduct }: { catalog: Catalog | null; openProduct: (p: Product) => void }) {',
  'function Home({ catalog, openProduct, ads, onOpenAd }: { catalog: Catalog | null; openProduct: (p: Product) => void; ads: Ad[]; onOpenAd: (a: Ad) => void }) {'
);

writeFileSync(f, s);
console.log('rotating hero added: 7s per ad, promo chip + button fixed');
