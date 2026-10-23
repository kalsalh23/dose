// مراقبة موقع الزبون أثناء تصفح التطبيق → إشعار الاقتراب من المحل
import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/customer/CustomerApp.tsx';
let t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

const anchor = `  /* تفعيل الإشعارات تلقائيًا بعد الدخول (إن كانت مسموحة مسبقًا) */
  useEffect(() => {
    if (!session?.token) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      enablePushNotifications(session).then(() => setPushMsg('مفعّلة')).catch(() => {});
    }
  }, [session?.token]);`;
if (!t.includes(anchor)) { console.error('ANCHOR NOT FOUND'); process.exit(1); }

const add = anchor + `

  /* إشعار الاقتراب من المحل: فحص موقع الزبون كل 90 ثانية أثناء التصفح — بلا تخزين للإحداثيات */
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; });
  useEffect(() => {
    if (!session?.token) return;
    let stopped = false;
    const check = async () => {
      try {
        const loc = await getCurrentLocation();
        if (stopped) return;
        const r = await rpc<any>('check_geo_proximity', { p_token: session.token, p_lat: loc.lat, p_lng: loc.lng });
        if (r?.notified) refreshRef.current();
      } catch { /* صامت — الموقع غير متاح أو مرفوض */ }
    };
    const t0 = setTimeout(check, 15000);
    const iv = setInterval(check, 90000);
    return () => { stopped = true; clearTimeout(t0); clearInterval(iv); };
  }, [session?.token]);`;
t = t.replace(anchor, add);
writeFileSync(f, t);
console.log('geo watcher added');
