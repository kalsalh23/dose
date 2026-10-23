import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/admin/AdminApp.tsx';
let t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// 1) import getCurrentLocation
const impOld = `import { eur, fmtDateTime, shopStatus } from '../lib/utils';`;
if (!t.includes(impOld)) { console.error('IMPORT ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(impOld, `import { eur, fmtDateTime, shopStatus, getCurrentLocation } from '../lib/utils';`);

// 2) التبويب
const tabOld = `  { id: 'hours', label: 'توقيت دوامي', icon: 'clock' },`;
if (!t.includes(tabOld)) { console.error('TAB ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(tabOld, tabOld + `\n  { id: 'location', label: 'موقعي', icon: 'pin' },`);

const tidOld = `type TabId = 'dashboard' | 'orders' | 'products' | 'customers' | 'rewards' | 'ads' | 'notify' | 'hours' | 'settings' | 'promo';`;
if (!t.includes(tidOld)) { console.error('TABID ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(tidOld, `type TabId = 'dashboard' | 'orders' | 'products' | 'customers' | 'rewards' | 'ads' | 'notify' | 'hours' | 'location' | 'settings' | 'promo';`);

const rendOld = `        {tab === 'hours' && <HoursTab token={token} />}`;
if (!t.includes(rendOld)) { console.error('RENDER ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(rendOld, rendOld + `\n        {tab === 'location' && <LocationTab token={token} />}`);

// 3) المكوّن — قبل «الإعدادات»
const before = `/* ============================ الإعدادات ============================ */`;
if (!t.includes(before)) { console.error('SETTINGS ANCHOR NOT FOUND'); process.exit(1); }
const comp = `/* ============================ موقعي — موقع المحل وإشعار الاقتراب ============================ */
function LocationTab({ token }: { token: string }) {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('500');
  const [msg, setMsg] = useState('');
  const [locErr, setLocErr] = useState('');
  const [busyGps, setBusyGps] = useState(false);
  const load = useCallback(() => { arpc<Record<string, string>>('admin_get_settings', { p_token: token }).then((s) => { setLat(s.shop_lat ?? ''); setLng(s.shop_lng ?? ''); setRadius(s.geo_radius ?? '500'); }).catch(() => {}); }, [token]);
  useEffect(() => { load(); }, [load]);
  const { busy, wrap } = useAdminAction();
  const gps = () => {
    setBusyGps(true); setLocErr('');
    getCurrentLocation()
      .then((loc) => { setLat(String(loc.lat)); setLng(String(loc.lng)); setBusyGps(false); })
      .catch((e: any) => { setLocErr(e.message || 'تعذر تحديد الموقع'); setBusyGps(false); });
  };
  const saved = lat !== '' && lng !== '';

  return (
    <div className="mx-auto max-w-md">
      <h2 className="mb-1 text-base font-extrabold text-coffee-900">موقعي</h2>
      <p className="mb-3 text-[11px] font-bold text-neutral-500">حدّد موقع المحل — يظهر للزبائن ويُستخدم لإرسال إشعار تلقائي عند اقترابهم من المحل</p>
      <Card className="space-y-4">
        {saved ? (
          <div className="rounded-2xl bg-[#EEF2DC] p-4 text-center">
            <p className="text-[10px] font-black text-[#7C8665]">الموقع المحفوظ حاليًا</p>
            <p className="mt-0.5 font-mono text-sm font-black text-coffee-900" dir="ltr">{lat}, {lng}</p>
            <a href={'https://www.google.com/maps?q=' + lat + ',' + lng} target="_blank" rel="noreferrer"
              className="mt-2 inline-block rounded-full bg-white px-4 py-1.5 text-[11px] font-black text-[#26301C] shadow-sm">فتح في خرائط Google ↗</a>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#FFF7E6] p-4 text-center text-xs font-black text-[#A05B47]">لم يُحدَّد موقع المحل بعد</div>
        )}
        <button disabled={busyGps} onClick={gps}
          className="w-full rounded-2xl bg-[#26301C] py-3.5 text-sm font-black text-[#E9EDD6] shadow-lg transition active:scale-[.98] disabled:opacity-50">
          {busyGps ? 'جارٍ تحديد موقعك…' : '📍 تحديد موقع المحل الآن (GPS)'}
        </button>
        {locErr && <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-extrabold text-red-600">{locErr}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="خط العرض (Latitude)"><input className={inputCls} dir="ltr" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="35.1327334" /></Field>
          <Field label="خط الطول (Longitude)"><input className={inputCls} dir="ltr" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="36.7526210" /></Field>
        </div>
        <Field label="نطاق إشعار الاقتراب (بالمتر)">
          <input type="number" className={inputCls} dir="ltr" value={radius} onChange={(e) => setRadius(e.target.value)} />
        </Field>
        {msg && <p className="rounded-xl bg-green-50 px-3 py-2 text-center text-xs font-extrabold text-green-700">{msg}</p>}
        <button disabled={busy || !lat.trim() || !lng.trim()} onClick={() => wrap(async () => {
          await arpc('admin_save_settings', { p_token: token, p_settings: { shop_lat: lat.trim(), shop_lng: lng.trim(), geo_radius: String(Number(radius) || 500) } });
          setMsg('حُفظ موقع المحل ✓ — الإشعار التلقائي سارٍ');
          setTimeout(() => setMsg(''), 5000);
        })} className={\`\${btnCls} w-full\`} style={{ borderRadius: 16, height: 46 }}>
          {busy ? 'جارٍ الحفظ…' : 'حفظ الموقع'}
        </button>
        <p className="rounded-xl bg-[#EEF2DC] px-3 py-2 text-[10.5px] font-bold leading-relaxed text-[#77825E]">
          عندما يفتح زبون التطبيق قريبًا من المحل ضمن النطاق المحدد، يصل إشعار «Dose Cafe قريب منك!» تلقائيًا — داخليًا وعلى شاشة هاتفه — مرة كل 3 ساعات كحد أقصى. لا تُخزَّن مواقع الزبائن إطلاقًا.
        </p>
      </Card>
    </div>
  );
}

`;
t = t.replace(before, comp + before);
writeFileSync(f, t);
console.log('LocationTab added');
