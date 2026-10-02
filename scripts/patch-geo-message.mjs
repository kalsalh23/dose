import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/admin/AdminApp.tsx';
let t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// 1) حالة geo_message + التحميل
const stOld = `  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('500');
  const [msg, setMsg] = useState('');
  const [locErr, setLocErr] = useState('');
  const [busyGps, setBusyGps] = useState(false);
  const load = useCallback(() => { arpc<Record<string, string>>('admin_get_settings', { p_token: token }).then((s) => { setLat(s.shop_lat ?? ''); setLng(s.shop_lng ?? ''); setRadius(s.geo_radius ?? '500'); }).catch(() => {}); }, [token]);`;
if (!t.includes(stOld)) { console.error('STATE ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(stOld, `  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('500');
  const [geoMsg, setGeoMsg] = useState('');
  const [msg, setMsg] = useState('');
  const [locErr, setLocErr] = useState('');
  const [busyGps, setBusyGps] = useState(false);
  const load = useCallback(() => { arpc<Record<string, string>>('admin_get_settings', { p_token: token }).then((s) => { setLat(s.shop_lat ?? ''); setLng(s.shop_lng ?? ''); setRadius(s.geo_radius ?? '500'); setGeoMsg(s.geo_message ?? ''); }).catch(() => {}); }, [token]);`);

// 2) حقل الرسالة + الحفظ
const fldOld = `        <Field label="نطاق إشعار الاقتراب (بالمتر)">
          <input type="number" className={inputCls} dir="ltr" value={radius} onChange={(e) => setRadius(e.target.value)} />
        </Field>`;
if (!t.includes(fldOld)) { console.error('RADIUS ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(fldOld, fldOld + `
        <Field label="رسالة الاقتراب (اختياري — بأسلوبك، والرمز {مسافة} يُستبدل بعدد الأمتار)">
          <textarea className={\`\${inputCls} h-24 py-2\`} value={geoMsg} onChange={(e) => setGeoMsg(e.target.value)}
            placeholder="خطوات قليلة تفصلك عن راحتك… فنجانك يتحضّر على ذوقك والحلويات طازجة تنتظرك ☕🥐 تعال دلّل حالك اليوم ✨" />
        </Field>`);

const svOld = `          await arpc('admin_save_settings', { p_token: token, p_settings: { shop_lat: lat.trim(), shop_lng: lng.trim(), geo_radius: String(Number(radius) || 500) } });
          setMsg('حُفظ موقع المحل ✓ — الإشعار التلقائي سارٍ');`;
if (!t.includes(svOld)) { console.error('SAVE ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(svOld, `          await arpc('admin_save_settings', { p_token: token, p_settings: { shop_lat: lat.trim(), shop_lng: lng.trim(), geo_radius: String(Number(radius) || 500), geo_message: geoMsg } });
          setMsg('حُفظ موقع المحل والرسالة ✓ — الإشعار التلقائي سارٍ');`);

writeFileSync(f, t);
console.log('geo message field added to LocationTab');
