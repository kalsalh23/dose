import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/customer/CustomerApp.tsx';
let t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const old = `  const [p, setP] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setP(Math.min(1, (Date.now() - start) / 10000)), 80);
    const end = setTimeout(onClose, 10000);
    return () => { clearInterval(t); clearTimeout(end); };
  }, []);`;
if (!t.includes(old)) { console.error('MIDAD TIMER ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(old, `  const [p, setP] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setP(Math.min(1, (Date.now() - start) / 30000)), 80);
    const end = setTimeout(onClose, 30000);
    return () => { clearInterval(t); clearTimeout(end); };
  }, []);`);
const txtOld = `<p className="mt-2 text-[10px] font-bold text-neutral-400">يُغلق تلقائيًا بعد 10 ثوانٍ</p>`;
if (!t.includes(txtOld)) { console.error('TEXT ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(txtOld, `<p className="mt-2 text-[10px] font-bold text-neutral-400">يُغلق تلقائيًا بعد 30 ثانية</p>`);
writeFileSync(f, t);
console.log('MidAd duration -> 30s');
