// لوحة الإدارة: مراقبة مستمرة للطلبات (كل 8 ثوانٍ على كل التبويبات) + صوت + إشعار + تنبيه داخلي
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/admin/AdminApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* 1) حالة التنبيه + الصوت + الحلقة المستمرة في الجذر */
const anchor = `  useEffect(() => {
    if (token && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [token]);

  if (!token) return <AdminLogin onLogged={(t) => { localStorage.setItem(ADMIN_KEY, t); setToken(t); }} />;`;
if (!s.includes(anchor)) fail('root anchor');

const addition = `  useEffect(() => {
    if (token && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [token]);

  /* المراقبة المستمرة — تعمل على كل التبويبات ولا تتوقف */
  const seenRef = useRef<Set<number>>(new Set(JSON.parse(localStorage.getItem('dose_seen_orders') || '[]')));
  const firstScan = useRef(true);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  const beep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = 920; g.gain.value = 0.25;
      o.start();
      setTimeout(() => { o.frequency.value = 1180; }, 140);
      setTimeout(() => { o.stop(); ctx.close(); }, 320);
    } catch {}
  };

  useEffect(() => {
    if (!token) return;
    let stopped = false;
    const check = async () => {
      try {
        const rows = await rpc<any[]>('admin_list_orders', { p_token: token, p_limit: 50 });
        if (!Array.isArray(rows) || stopped) return;
        const fresh = rows.filter((o) => o.status === 'pending' && !seenRef.current.has(o.order_number));
        if (fresh.length > 0 && !firstScan.current) {
          beep();
          const o = fresh[0];
          setAlertMsg('🔔 طلب جديد #' + o.order_number + ' — ' + o.customer_name + ' (' + eur(o.total_cents) + ')');
          setTimeout(() => setAlertMsg(null), 7000);
          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('🔔 طلب جديد #' + o.order_number, {
                body: o.customer_name + ' — ' + eur(o.total_cents) + ' (' + (o.fulfillment_type === 'delivery' ? 'توصيل' : 'استلام') + ')',
                icon: '/logo.jpg', tag: 'order-' + o.id,
              });
            }
          } catch {}
        }
        rows.forEach((o) => seenRef.current.add(o.order_number));
        firstScan.current = false;
        localStorage.setItem('dose_seen_orders', JSON.stringify([...seenRef.current].slice(-500)));
      } catch {}
    };
    check();
    const t = setInterval(check, 8000);
    return () => { stopped = true; clearInterval(t); };
  }, [token]);

  if (!token) return <AdminLogin onLogged={(t) => { localStorage.setItem(ADMIN_KEY, t); setToken(t); }} />;`;
s = s.replace(anchor, addition);

/* 2) تنبيه داخلي ظاهر فوق كل التبويبات */
const oldMain = `      <main className="mx-auto max-w-6xl p-4">`;
if (!s.includes(oldMain)) fail('main tag');
s = s.replace(oldMain, `      {alertMsg && (
        <div className="sticky top-[112px] z-50 mx-auto mt-3 w-fit max-w-[92vw] rounded-full bg-amber-400 px-5 py-2.5 text-center text-xs font-black text-amber-950 shadow-xl anim-pop">
          {alertMsg}
        </div>
      )}
      <main className="mx-auto max-w-6xl p-4">`);

/* 3) استيراد useRef */
if (!s.includes('useRef')) {
  s = s.replace("import { useCallback, useEffect, useState } from 'react';", "import { useCallback, useEffect, useRef, useState } from 'react';");
}

writeFileSync(f, s);
console.log('continuous monitoring added to admin');
