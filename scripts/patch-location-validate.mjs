import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/admin/AdminApp.tsx';
let t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING: ' + m); process.exit(1); };

// 1) زر GPS: تحقق من صحة القيم قبل قبولها
const gpsOld = `  const gps = () => {
    setBusyGps(true); setLocErr('');
    getCurrentLocation()
      .then((loc) => { setLat(String(loc.lat)); setLng(String(loc.lng)); setBusyGps(false); })
      .catch((e: any) => { setLocErr(e.message || 'تعذر تحديد الموقع'); setBusyGps(false); });
  };`;
if (!t.includes(gpsOld)) fail('gps anchor');
t = t.replace(gpsOld, `  const gps = () => {
    setBusyGps(true); setLocErr('');
    getCurrentLocation()
      .then((loc) => {
        const la = Number(loc.lat), ln = Number(loc.lng);
        if (!Number.isFinite(la) || !Number.isFinite(ln) || la < -90 || la > 90 || ln < -180 || ln > 180) {
          setLocErr('جاءت قيمة الموقع من الجهاز غير سليمة — أدخل الإحداثيات يدويًا'); setBusyGps(false); return;
        }
        setLat(la.toFixed(7)); setLng(ln.toFixed(7)); setBusyGps(false);
      })
      .catch((e: any) => { setLocErr(e.message || 'تعذر تحديد الموقع'); setBusyGps(false); });
  };`);

// 2) الحفظ: رفض الإحداثيات غير الصالحة
const saveOld = `        <button disabled={busy || !lat.trim() || !lng.trim()} onClick={() => wrap(async () => {
          await arpc('admin_save_settings', { p_token: token, p_settings: { shop_lat: lat.trim(), shop_lng: lng.trim(), geo_radius: String(Number(radius) || 500), geo_message: geoMsg } });
          setMsg('حُفظ موقع المحل والرسالة ✓ — الإشعار التلقائي سارٍ');
          setTimeout(() => setMsg(''), 5000);
        })}`;
if (!t.includes(saveOld)) fail('save anchor');
t = t.replace(saveOld, `        <button disabled={busy || !lat.trim() || !lng.trim()} onClick={() => wrap(async () => {
          const la = Number(lat), ln = Number(lng);
          if (!Number.isFinite(la) || !Number.isFinite(ln) || la < -90 || la > 90 || ln < -180 || ln > 180) {
            setLocErr('قيمة غير صالحة — خط العرض بين -90 و90 وخط الطول بين -180 و180 (مثال: 35.133024)'); return;
          }
          await arpc('admin_save_settings', { p_token: token, p_settings: { shop_lat: la.toFixed(7), shop_lng: ln.toFixed(7), geo_radius: String(Number(radius) || 500), geo_message: geoMsg } });
          setMsg('حُفظ موقع المحل والرسالة ✓ — الإشعار التلقائي سارٍ');
          setTimeout(() => setMsg(''), 5000);
        })}`);

writeFileSync(f, t);
console.log('LocationTab validation added');
