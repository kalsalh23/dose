// لوحة الإدارة: إشعار فوري عند طلب جديد + تمييز الطلبات المعلقة بلون حتى معالجتها
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/admin/AdminApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* 1) طلب صلاحية الإشعارات بعد الدخول */
const oldRoot = `  const logout = () => { localStorage.removeItem(ADMIN_KEY); setToken(null); };

  if (!token) return <AdminLogin onLogged={(t) => { localStorage.setItem(ADMIN_KEY, t); setToken(t); }} />;`;
if (!s.includes(oldRoot)) fail('root login');
const newRoot = `  const logout = () => { localStorage.removeItem(ADMIN_KEY); setToken(null); };

  useEffect(() => {
    if (token && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [token]);

  if (!token) return <AdminLogin onLogged={(t) => { localStorage.setItem(ADMIN_KEY, t); setToken(t); }} />;`;
s = s.replace(oldRoot, newRoot);

/* 2) OrdersTab: مراقبة الطلبات الجديدة + تمييز المعلقة */
const oldOrdersHead = `function OrdersTab({ token }: { token: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const load = useCallback(() => { arpc<any[]>('admin_list_orders', { p_token: token, p_limit: 200 }).then(setOrders).catch(() => {}); }, [token]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  const { busy, wrap } = useAdminAction();`;
if (!s.includes(oldOrdersHead)) fail('orders head');
const newOrdersHead = `function OrdersTab({ token }: { token: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const seenRef = useRef<Set<number>>(new Set(JSON.parse(localStorage.getItem('dose_seen_orders') || '[]')));
  const firstLoad = useRef(true);
  const load = useCallback(async () => {
    try {
      const rows = await arpc<any[]>('admin_list_orders', { p_token: token, p_limit: 200 });
      if (!Array.isArray(rows)) return;
      // اكتشاف الطلبات الجديدة (بعد أول تحميل)
      if (!firstLoad.current) {
        for (const o of rows) {
          if (!seenRef.current.has(o.order_number) && o.status === 'pending') {
            try {
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification('🔔 طلب جديد #' + o.order_number, {
                  body: o.customer_name + ' — ' + eur(o.total_cents) + ' (' + (o.fulfillment_type === 'delivery' ? 'توصيل' : 'استلام') + ')',
                  icon: '/logo.jpg', tag: 'order-' + o.id,
                });
              }
            } catch {}
          }
        }
      }
      rows.forEach((o) => seenRef.current.add(o.order_number));
      firstLoad.current = false;
      localStorage.setItem('dose_seen_orders', JSON.stringify([...seenRef.current].slice(-500)));
      setOrders(rows);
    } catch {}
  }, [token]);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);
  const { busy, wrap } = useAdminAction();`;
s = s.replace(oldOrdersHead, newOrdersHead);

// استيراد useRef
if (!s.includes('useRef')) {
  s = s.replace("import { useCallback, useEffect, useState } from 'react';", "import { useCallback, useEffect, useRef, useState } from 'react';");
}

/* 3) تمييز الطلبات المعلقة (pending) بلون مميز حتى معالجتها */
const oldCard = `        <Card key={o.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-sm font-black text-coffee-900">#{o.order_number}</span>`;
if (!s.includes(oldCard)) fail('order card');
const newCard = `        <Card key={o.id} className={o.status === 'pending' ? '!ring-2 !ring-amber-400 !bg-amber-50/60 animate-pulse-slow' : ''}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-sm font-black text-coffee-900">#{o.order_number}</span>
              {o.status === 'pending' && <span className="ms-2 rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-black text-amber-950">جديد — بانتظار المعالجة</span>}`;
s = s.replace(oldCard, newCard);

writeFileSync(f, s);
console.log('admin notifications + pending highlight added');
