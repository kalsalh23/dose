// استبدال SplashAd (ملء الشاشة فوري) بإعلان وسط الشاشة أنيق يظهر بعد دقيقتين من التصفح
import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/customer/CustomerApp.tsx';
let t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

const startMark = t.indexOf('/* ============================ إعلان ملء الشاشة');
const endMark = t.indexOf('/* ============================ الشاشة الترحيبية');
if (startMark < 0 || endMark < 0 || endMark < startMark) { console.error('MARKS NOT FOUND', startMark, endMark); process.exit(1); }

const NEW = `/* ============================ إعلان وسط الشاشة — يظهر بعد دقيقتين من التصفح ============================ */
function MidAd({ ad, cur, onClose }: { ad: Ad; cur: string; onClose: () => void }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setP(Math.min(1, (Date.now() - start) / 10000)), 80);
    const end = setTimeout(onClose, 10000);
    return () => { clearInterval(t); clearTimeout(end); };
  }, []);
  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/60 p-5 backdrop-blur-sm anim-fade" onClick={onClose}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-white shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <img src={ad.image_url} alt={ad.title} className="h-56 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25" />
          <span className="absolute right-4 top-4 rounded-full bg-[#C9D3A8] px-3.5 py-1.5 text-[11px] font-black text-[#26301C] shadow-lg">عرض حصري ✨</span>
          <button onClick={onClose} className="absolute left-4 top-4 grid size-9 place-items-center rounded-full bg-black/45 text-white transition active:scale-90" aria-label="إغلاق">
            <Icon name="x" size={16} />
          </button>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
            <div className="h-full bg-[#EAC98F]" style={{ width: p * 100 + '%', transition: 'width .1s linear' }} />
          </div>
        </div>
        <div className="p-5 text-center">
          <h2 className="text-xl font-black text-[#26301C]">{ad.title}</h2>
          {ad.description_ar && <p className="mt-1 text-xs font-bold text-[#7C8665]">{ad.description_ar}</p>}
          {(ad.old_price_cents != null || ad.new_price_cents != null) && (
            <div className="mt-3 flex items-baseline justify-center gap-3">
              {ad.old_price_cents != null && <span className="text-sm font-bold text-neutral-400 line-through">{eur(ad.old_price_cents, cur)}</span>}
              {ad.new_price_cents != null && <span className="text-3xl font-black text-[#26301C]">{eur(ad.new_price_cents, cur)}</span>}
            </div>
          )}
          <button onClick={onClose}
            className="mt-4 w-full rounded-full bg-gradient-to-l from-[#C9D3A8] to-[#A9B87F] py-3.5 text-base font-black text-[#26301C] shadow-lg shadow-[#8a6a48]/30 transition active:scale-[.98]">
            اطلب الآن
          </button>
          <p className="mt-2 text-[10px] font-bold text-neutral-400">يُغلق تلقائيًا بعد 10 ثوانٍ</p>
        </div>
      </div>
    </div>
  );
}

`;
t = t.slice(0, startMark) + NEW + t.slice(endMark);

// مؤقّت الدقيقتين + شرط الظهور الجديد
if (!t.includes('midAdDue')) {
  t = t.replace(
    `  const [welcomeDone, setWelcomeDone] = useState(false);
  const [splashDone, setSplashDone] = useState(false);`,
    `  const [welcomeDone, setWelcomeDone] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [midAdDue, setMidAdDue] = useState(false);
  /* الإعلان الوسطي: بعد دقيقتين من بدء التصفح */
  useEffect(() => {
    if (!welcomeDone) return;
    const t = setTimeout(() => setMidAdDue(true), 120000);
    return () => clearTimeout(t);
  }, [welcomeDone]);`
  );
  t = t.replace(
    `{welcomeDone && fsAd && !splashDone && <SplashAd ad={fsAd} cur={cur} onClose={() => setSplashDone(true)} />}`,
    `{welcomeDone && fsAd && !splashDone && midAdDue && <MidAd ad={fsAd} cur={cur} onClose={() => setSplashDone(true)} />}`
  );
}

// رسالة إغلاق مخصصة من اللوحة
t = t.replace(
  `      {closedOpen && <ClosedModal open={catalog?.settings?.work_open ?? ''} onClose={() => setClosedOpen(false)} />}`,
  `      {closedOpen && <ClosedModal open={catalog?.settings?.work_open ?? ''} note={catalog?.settings?.closed_message ?? ''} onClose={() => setClosedOpen(false)} />}`
);

const oldModal = `function ClosedModal({ open, onClose }: { open: string; onClose: () => void }) {`;
const newModal = `function ClosedModal({ open, note, onClose }: { open: string; note: string; onClose: () => void }) {`;
if (!t.includes(oldModal)) { console.error('CLOSED MODAL SIG NOT FOUND'); process.exit(1); }
t = t.replace(oldModal, newModal);

const oldBody = `        <p className="mt-2 text-sm font-bold leading-relaxed text-[#7C8665]">
          خلاص وصفنا اليوم… تراني فتحنا بساعات جديدة ☕
        </p>`;
const newBody = `        {note ? (
          <p className="mt-2 whitespace-pre-line text-sm font-bold leading-relaxed text-[#7C8665]">{note}</p>
        ) : (
          <p className="mt-2 text-sm font-bold leading-relaxed text-[#7C8665]">
            خلاص وصفنا اليوم… تراني فتحنا بساعات جديدة ☕
          </p>
        )}`;
if (!t.includes(oldBody)) { console.error('CLOSED MODAL BODY NOT FOUND'); process.exit(1); }
t = t.replace(oldBody, newBody);

writeFileSync(f, t);
console.log('MidAd + delay + closed note patched');
