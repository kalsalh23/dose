// إعادة بناء SplashAd كاملًا: المكوّن + الحالة + الاستدعاء بعد شاشة الترحيب
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* 1) الحالة في الجذر */
const oldState = "  const [welcomeDone, setWelcomeDone] = useState(false);";
if (!s.includes(oldState)) fail('welcome state');
s = s.replace(oldState, `  const [welcomeDone, setWelcomeDone] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const fsAd = useMemo(() => (catalog?.ads ?? []).find((a) => a.full_screen), [catalog]);`);

/* 2) المكوّن قبل شاشة الترحيب */
const anchorWelcome = '/* ============================ الشاشة الترحيبية';
if (!s.includes(anchorWelcome)) fail('welcome anchor');
const splashComp = `/* ============================ إعلان ملء الشاشة — 5 ثوانٍ ============================ */
function SplashAd({ ad, cur, onClose }: { ad: Ad; cur: string; onClose: () => void }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setP(Math.min(1, (Date.now() - start) / 5000)), 80);
    const end = setTimeout(onClose, 5000);
    return () => { clearInterval(t); clearTimeout(end); };
  }, []);
  return (
    <div className="fixed inset-0 z-[200] bg-[#26301C] anim-fade">
      <img src={ad.image_url} alt={ad.title} className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/50" />

      <div className="absolute inset-x-4 top-4 flex gap-1.5">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: p * 100 + '%', transition: 'width .1s linear' }} />
        </div>
      </div>
      <button onClick={onClose} className="absolute left-4 top-8 rounded-full bg-white/15 px-4 py-2 text-xs font-extrabold text-white backdrop-blur transition active:scale-95">
        تخطي
      </button>
      <span className="absolute right-4 top-8 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-black text-[#26301C] shadow-lg">
        عرض حصري
      </span>

      <div className="absolute inset-x-0 bottom-0 p-6 pb-10 text-white">
        <h2 className="text-[26px] font-black leading-tight drop-shadow-lg">{ad.title}</h2>
        <p className="mt-1.5 text-sm font-medium text-white/85">{ad.description_ar}</p>
        <div className="mt-3 flex items-baseline gap-3">
          {ad.old_price_cents != null && <span className="text-base font-bold text-white/60 line-through">{eur(ad.old_price_cents, cur)}</span>}
          {ad.new_price_cents != null && <span className="text-3xl font-black text-[#C9D3A8] drop-shadow">{eur(ad.new_price_cents, cur)}</span>}
        </div>
        <button onClick={onClose}
          className="mt-5 w-full rounded-full bg-white py-4 text-base font-black text-[#26301C] shadow-xl transition active:scale-[.97]">
          اطلب الآن
        </button>
      </div>
    </div>
  );
}

`;
s = s.replace(anchorWelcome, splashComp + anchorWelcome);

/* 3) الاستدعاء: بعد انتهاء شاشة الترحيب */
const oldWelcomeRender = `      {!welcomeDone && <WelcomeScreen onClose={() => setWelcomeDone(true)} />}`;
if (!s.includes(oldWelcomeRender)) fail('welcome render');
s = s.replace(oldWelcomeRender, `      {!welcomeDone && <WelcomeScreen onClose={() => setWelcomeDone(true)} />}
      {welcomeDone && fsAd && !splashDone && <SplashAd ad={fsAd} cur={cur} onClose={() => setSplashDone(true)} />}`);

writeFileSync(f, s);
console.log('SplashAd rebuilt: component + state + render after welcome');
