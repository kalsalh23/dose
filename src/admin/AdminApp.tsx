import { useCallback, useEffect, useRef, useState } from 'react';
import { rpc, sb } from '../lib/supabase';
import { eur, fmtDateTimeNum, shopStatus } from '../lib/utils';
import { Icon, type IconName } from '../components/Icons';

/* ============================================================
   لوحة الإدارة — /admin
   الطلبات · المنتجات · المكافآت · العملاء · الإعلانات · الإشعارات · الإعدادات
   ============================================================ */

const ADMIN_KEY = 'dose_admin_token_v1';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** استدعاء RPC إداري — إن انتهت الجلسة (null) خروج تلقائي لشاشة الدخول */
async function arpc<T = any>(fn: string, args: Record<string, any> = {}): Promise<T> {
  const d = await rpc<T>(fn, args);
  if (d === null) {
    localStorage.removeItem(ADMIN_KEY);
    setTimeout(() => location.reload(), 600);
    throw new Error('انتهت صلاحية الجلسة — سجّل الدخول من جديد');
  }
  return d;
}
const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'dashboard', label: 'الرئيسية', icon: 'chart' },
  { id: 'sales', label: 'المبيعات', icon: 'store' },
  { id: 'orders', label: 'الطلبات', icon: 'clipboard' },
  { id: 'products', label: 'المنتجات', icon: 'package' },
  { id: 'extras', label: 'إضافات', icon: 'plus' },
  { id: 'customers', label: 'العملاء', icon: 'users' },
  { id: 'rewards', label: 'المكافآت', icon: 'gift' },
  { id: 'ads', label: 'الإعلانات', icon: 'megaphone' },
  { id: 'notify', label: 'إشعار', icon: 'bell' },
  { id: 'hours', label: 'توقيت دوامي', icon: 'clock' },
  { id: 'promo', label: 'كود الخصم', icon: 'gift' },
  { id: 'settings', label: 'الإعدادات', icon: 'settings' },
];
type TabId = 'dashboard' | 'sales' | 'extras' | 'orders' | 'products' | 'customers' | 'rewards' | 'ads' | 'notify' | 'hours' | 'settings' | 'promo';

export default function AdminApp() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(ADMIN_KEY));
  const [tab, setTab] = useState<TabId>('dashboard');

  const logout = () => { localStorage.removeItem(ADMIN_KEY); setToken(null); };

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        if (typeof Notification === 'undefined' || !('PushManager' in window)) return;
        const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
        if (perm !== 'granted') return;
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUB) });
        }
        await rpc('save_admin_push_subscription', { p_token: token, p_sub: JSON.stringify(sub) });
      } catch {}
    })();
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

  if (!token) return <AdminLogin onLogged={(t) => { localStorage.setItem(ADMIN_KEY, t); setToken(t); }} />;

  return (
    <div className="min-h-full bg-[#F0F4E4]">
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 bg-coffee-950 px-5 py-3 text-cream shadow-lg">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Dose" className="size-10 rounded-xl border-2 border-gold/50 object-cover" />
          <div className="leading-tight">
            <p className="font-serif text-base font-bold">Dose — لوحة الإدارة</p>
            <p className="text-[9px] font-bold uppercase tracking-[.2em] text-gold/80">Admin Dashboard</p>
          </div>
        </div>
        <button onClick={logout} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold transition hover:bg-white/20">تسجيل الخروج</button>
      </header>

      <nav className="no-scrollbar sticky top-[68px] z-30 flex gap-2 overflow-x-auto border-b border-beige bg-white/90 px-4 py-2.5 backdrop-blur">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex flex-none items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold transition ${tab === t.id ? 'bg-coffee-900 text-cream shadow' : 'bg-[#E3E9C8] text-neutral-500 hover:text-neutral-800'}`}>
            <Icon name={t.icon} size={14} /> {t.label}
          </button>
        ))}
      </nav>

      {alertMsg && (
        <div className="sticky top-[112px] z-50 mx-auto mt-3 w-fit max-w-[92vw] rounded-full bg-amber-400 px-5 py-2.5 text-center text-xs font-black text-amber-950 shadow-xl anim-pop">
          {alertMsg}
        </div>
      )}
      <main className="mx-auto max-w-6xl p-4">
        {tab === 'dashboard' && <Dashboard token={token} />}
        {tab === 'sales' && <SalesTab token={token} />}
        {tab === 'orders' && <OrdersTab token={token} />}
        {tab === 'products' && <ProductsTab token={token} />}
        {tab === 'extras' && <ExtrasTab token={token} />}
        {tab === 'customers' && <CustomersTab token={token} />}
        {tab === 'rewards' && <RewardsTab token={token} />}
        {tab === 'ads' && <AdsTab token={token} />}
        {tab === 'notify' && <NotifyTab token={token} />}
        {tab === 'hours' && <HoursTab token={token} />}
        {tab === 'settings' && <SettingsTab token={token} />}
        {tab === 'promo' && <PromoTab token={token} />}
      </main>
    </div>
  );
}

/* ============================ الدخول ============================ */
function AdminLogin({ onLogged }: { onLogged: (t: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    setBusy(true); setErr('');
    try {
      const r = await arpc<{ token: string }>('admin_login', { p_username: username, p_password: password });
      onLogged(r.token);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };
  return (
    <div className="grid min-h-full place-items-center bg-gradient-to-b from-[#F6E7C8] to-[#F3DEBA] p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl anim-pop">
        <div className="text-center"><img src="/logo.jpg" alt="Dose" className="mx-auto size-16 rounded-2xl object-cover shadow" /></div>
        <h2 className="mt-4 text-center text-lg font-black text-coffee-900">لوحة الإدارة — Dose</h2>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="اسم المستخدم" dir="ltr"
          className="mt-5 h-12 w-full rounded-2xl border-2 border-beige bg-[#FAF5EA] px-4 text-center font-bold outline-none focus:border-gold" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="كلمة المرور" dir="ltr"
          className="mt-3 h-12 w-full rounded-2xl border-2 border-beige bg-[#FAF5EA] px-4 text-center font-bold outline-none focus:border-gold" />
        {err && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-600">{err}</p>}
        <button onClick={submit} disabled={busy}
          className="mt-5 w-full rounded-2xl bg-gradient-to-l from-gold to-gold-deep py-3.5 text-base font-extrabold text-white shadow-lg active:scale-[.98] disabled:opacity-50">
          {busy ? 'جارٍ الدخول…' : 'دخول'}
        </button>
      </div>
    </div>
  );
}

/* ============================ عناصر مشتركة ============================ */
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-beige ${className}`}>{children}</div>
);
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block"><span className="mb-1 block text-xs font-bold text-neutral-500">{label}</span>{children}</label>
);
const inputCls = 'h-11 w-full rounded-xl border-2 border-beige bg-[#FAF5EA] px-3 text-sm font-bold outline-none focus:border-gold';
const btnCls = 'rounded-xl bg-coffee-900 px-4 py-2.5 text-xs font-extrabold text-cream transition active:scale-95 disabled:opacity-40';

const useAdminAction = () => {
  const [busy, setBusy] = useState(false);
  const wrap = async (fn: () => Promise<void>) => {
    if (busy) return; setBusy(true);
    try { await fn(); } catch (e: any) { alert(e.message); } finally { setBusy(false); }
  };
  return { busy, wrap };
};

/* حقل رفع صورة من الجهاز إلى Supabase Storage */
function ImageUploadField({ value, onChange, folder }: { value: string; onChange: (url: string) => void; folder: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const upload = async (file: File) => {
    setBusy(true); setErr('');
    try {
      if (!file.type.startsWith('image/')) throw new Error('اختر ملف صورة صحيحًا');
      if (file.size > 5 * 1024 * 1024) throw new Error('حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace('jpeg', 'jpg');
      const path = folder + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const { error } = await sb.storage.from('images').upload(path, file, { contentType: file.type });
      if (error) throw error;
      onChange(sb.storage.from('images').getPublicUrl(path).data.publicUrl);
    } catch (e: any) {
      setErr(e.message || 'فشل رفع الصورة');
    }
    setBusy(false);
  };
  return (
    <div>
      <div className="flex items-center gap-3">
        {value
          ? <img src={value} alt="" className="size-16 rounded-2xl object-cover shadow ring-1 ring-fresh-100" />
          : <span className="grid size-16 place-items-center rounded-2xl bg-[#E3E9C8] text-neutral-400"><Icon name="package" size={20} /></span>}
        <label className="cursor-pointer rounded-xl bg-coffee-900 px-4 py-2.5 text-[11px] font-extrabold text-cream transition active:scale-95">
          {busy ? 'جارٍ الرفع…' : value ? 'تغيير الصورة' : 'رفع صورة من الجهاز'}
          <input type="file" accept="image/*" className="hidden" disabled={busy}
            onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); e.target.value = ''; }} />
        </label>
        {value && <span className="text-[10px] font-extrabold text-green-600">جاهزة للعرض</span>}
      </div>
      {err && <p className="mt-1.5 text-[11px] font-bold text-red-600">{err}</p>}
    </div>
  );
}

/* ============================ الرئيسية ============================ */
function Dashboard({ token }: { token: string }) {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    const load = () => arpc<any>('admin_stats', { p_token: token }).then(setStats).catch(() => {});
    load(); const t = setInterval(load, 20000); return () => clearInterval(t);
  }, [token]);
  const cards: { label: string; value: any; icon: IconName; color: string }[] = [
    { label: 'العملاء', value: stats?.customers ?? '—', icon: 'users', color: 'bg-blue-50 text-blue-700' },
    { label: 'إجمالي الطلبات', value: stats?.orders ?? '—', icon: 'receipt', color: 'bg-amber-50 text-amber-700' },
    { label: 'طلبات حالية', value: stats?.active_orders ?? '—', icon: 'clock', color: 'bg-orange-50 text-orange-700' },
    { label: 'طلبات مكتملة', value: stats?.completed_orders ?? '—', icon: 'check', color: 'bg-emerald-50 text-emerald-700' },
    { label: 'المبيعات', value: stats != null ? eur(stats.sales_cents, 'ل.س') : '—', icon: 'chart', color: 'bg-green-50 text-green-700' },
    { label: 'نقاط معلقة', value: stats?.points_outstanding ?? '—', icon: 'star', color: 'bg-yellow-50 text-yellow-700' },
    { label: 'استبدالات', value: stats?.redemptions ?? '—', icon: 'gift', color: 'bg-purple-50 text-purple-700' },
    { label: 'منتجات نشطة', value: stats?.products ?? '—', icon: 'package', color: 'bg-rose-50 text-rose-700' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 anim-rise md:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="text-center">
          <span className={`mx-auto grid size-11 place-items-center rounded-2xl ${c.color}`}><Icon name={c.icon} size={20} /></span>
          <p className="mt-2 text-2xl font-black text-coffee-900">{c.value}</p>
          <p className="text-[11px] font-bold text-neutral-500">{c.label}</p>
        </Card>
      ))}
    </div>
  );
}

/* ============================ الطلبات ============================ */
function OrdersTab({ token }: { token: string }) {
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
  const { busy, wrap } = useAdminAction();

  const setStatus = (id: string, status: string) => wrap(async () => {
    await arpc('admin_set_order_status', { p_token: token, p_order_id: id, p_status: status });
    load();
  });

  const STATUSES = ['pending', 'preparing', 'ready', 'out_for_delivery', 'completed'];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-coffee-900">الطلبات ({orders.length})</h2>
        <button onClick={load} className={btnCls}>تحديث</button>
      </div>
      {orders.map((o) => (
        <Card key={o.id} className={o.status === 'pending' ? '!ring-2 !ring-amber-400 !bg-amber-50/60 animate-pulse-slow' : ''}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-sm font-black text-coffee-900">#{o.order_number}</span>
              {o.status === 'pending' && <span className="ms-2 rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-black text-amber-950">جديد — بانتظار المعالجة</span>}
              <span className={`ms-2 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${statusChip(o.status)}`}>{statusLabel(o.status)}</span>
              {o.points_awarded && <span className="ms-1 rounded-full bg-green-50 px-2 py-1 text-[10px] font-extrabold text-green-700">⭐ منحت</span>}
              {['pending', 'preparing', 'ready', 'out_for_delivery'].includes(o.status) && (
                <span className="ms-1 rounded-full bg-[#EEF2DC] px-2 py-1 text-[10px] font-extrabold text-[#5C6B3C]">⏱️ {o.fulfillment_type === 'delivery' ? 'يوصل خلال 15-20 دقيقة' : 'جاهز خلال 5-10 دقائق'}</span>
              )}
            </div>
            <span className="text-[11px] font-bold text-neutral-400">{fmtDateTimeNum(o.created_at)} · {o.source === 'kiosk' ? 'كشك المحل' : o.source === 'customer' ? 'تطبيق العميل' : 'إداري'}</span>
          </div>
          <div className="mt-3 grid gap-3 text-xs md:grid-cols-4">
            <div><p className="font-bold text-neutral-400">العميل</p><p className="mt-0.5 font-extrabold text-coffee-900">{o.customer_name}</p><p dir="ltr" className="text-neutral-500">{o.customer_phone}</p></div>
            <div><p className="font-bold text-neutral-400">نوع الطلب</p><p className="mt-0.5 font-extrabold text-coffee-900">{o.fulfillment_type === 'delivery' ? '🚚 توصيل' : '🏪 استلام'}</p></div>
            <div><p className="font-bold text-neutral-400">الإجمالي / النقاط</p><p className="mt-0.5 font-extrabold text-gold-deep">{eur(o.total_cents, 'ل.س')} · ⭐{o.total_points}</p></div>
            <div className="flex flex-col gap-1.5">
              {o.delivery_map_url && (
                <a href={o.delivery_map_url} target="_blank" rel="noopener" className="rounded-xl bg-blue-50 px-3 py-2 text-center text-[11px] font-extrabold text-blue-700 hover:bg-blue-100">📍 فتح موقع العميل على الخريطة</a>
              )}
              <select value={o.status} disabled={busy} onChange={(e) => setStatus(o.id, e.target.value)}
                className="h-9 rounded-xl border-2 border-beige bg-[#FAF5EA] px-2 text-xs font-extrabold outline-none">
                {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-dashed border-beige pt-2.5">
            {o.items.map((it: any, i: number) => (
              <span key={i} className="rounded-full bg-[#E3E9C8] px-3 py-1 text-[11px] font-bold text-neutral-600">{it.name_ar} × {it.qty}</span>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

const statusLabel = (s: string) => ({ pending: 'قيد المراجعة', confirmed: 'مؤكد', preparing: 'قيد التحضير', ready: 'جاهز', out_for_delivery: 'جاري التوصيل', completed: 'تم التسليم', cancelled: 'ملغي' } as any)[s] ?? s;
const statusChip = (s: string) => ({ pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-blue-100 text-blue-800', preparing: 'bg-orange-100 text-orange-800', ready: 'bg-emerald-100 text-emerald-800', out_for_delivery: 'bg-indigo-100 text-indigo-800', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' } as any)[s] ?? 'bg-neutral-100';

/* ============================ المبيعات ============================ */
function SalesTab({ token }: { token: string }) {
  const [data, setData] = useState<any>(null);
  const load = useCallback(() => { arpc<any>('admin_sales_summary', { p_token: token }).then(setData).catch(() => {}); }, [token]);
  useEffect(() => { load(); }, [load]);
  const fmt = (v: any) => Number(v?.total ?? 0).toLocaleString('en-US') + ' ل.س';
  const cards = [
    { label: 'مبيعات اليوم', emoji: '📅', d: data?.today, grad: 'from-[#414D36] to-[#26301C]' },
    { label: 'آخر 7 أيام', emoji: '🗓️', d: data?.week, grad: 'from-[#5C6B3C] to-[#414D36]' },
    { label: 'هذا الشهر', emoji: '📆', d: data?.month, grad: 'from-[#7A5A22] to-[#5C4318]' },
  ];
  const daily = (data?.daily ?? []) as { day: string; total_cents: number; orders_count: number }[];
  const max = Math.max(1, ...daily.map((d) => d.total_cents));
  return (
    <div className="space-y-4">
      <h2 className="text-base font-extrabold text-coffee-900">المبيعات</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-3xl bg-gradient-to-bl ${c.grad} p-5 text-white shadow-lg shadow-[#26301C]/25`}>
            <p className="flex items-center gap-2 text-[11px] font-black text-[#C9D3A8]"><span>{c.emoji}</span> {c.label}</p>
            <p className="mt-2 text-3xl font-black tracking-tight">{fmt(c.d)}</p>
            <p className="mt-1 text-[11px] font-bold text-white/70">{Number(c.d?.count ?? 0).toLocaleString('en-US')} طلب مكتمل</p>
          </div>
        ))}
      </div>
      <Card className="p-5">
        <p className="mb-4 text-xs font-extrabold text-coffee-900">مبيعات آخر 14 يومًا</p>
        {daily.length === 0 ? (
          <p className="py-8 text-center text-xs font-bold text-neutral-400">لا توجد مبيعات مسجلة بعد</p>
        ) : (
          <div className="flex items-end gap-1.5 overflow-x-auto pb-1" dir="ltr">
            {daily.map((d) => (
              <div key={d.day} className="flex min-w-[34px] flex-1 flex-col items-center gap-1.5">
                <span className="text-[8.5px] font-black text-neutral-500">{d.total_cents > 0 ? (d.total_cents / 1000).toLocaleString('en-US') + 'k' : ''}</span>
                <div className="w-full rounded-t-lg bg-gradient-to-t from-[#5C6B3C] to-[#A9B87F] transition-all"
                  style={{ height: `${d.total_cents > 0 ? 10 + Math.round((d.total_cents / max) * 90) : 3}px` }} />
                <span className="text-[8px] font-bold text-neutral-400">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <p className="rounded-xl bg-[#EEF2DC] px-3 py-2 text-[10.5px] font-bold leading-relaxed text-[#77825E]">
        الطلبات المكتملة تُحذف تلقائيًا بعد يوم من تسليمها للزبون — لكن مبالغها تبقى محسوبة هنا بشكل دائم. إذا أُلغي طلب مكتمل لاحقًا يُخصم من مبيعات يومه.
      </p>
    </div>
  );
}

/* ============================ المنتجات ============================ */
const EMPTY_PRODUCT = { id: 0, category_slug: 'hot', name_ar: '', name_en: '', description_ar: '', price_cents: 0, points: 0, image_url: '', options: '', is_active: true, is_available: true, sort_order: 0 };
function ProductsTab({ token }: { token: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const [offerId, setOfferId] = useState<number | null>(null);
  const [offerVal, setOfferVal] = useState('');
  const load = useCallback(() => { arpc<any[]>('admin_list_products', { p_token: token }).then(setProducts).catch(() => {}); }, [token]);
  useEffect(() => { load(); }, [load]);
  const { busy, wrap } = useAdminAction();

  const save = () => wrap(async () => {
    await arpc('admin_save_product', { p_token: token, p_product: edit });
    setEdit(null); load();
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-coffee-900">المنتجات ({products.length})</h2>
        <button onClick={() => setEdit({ ...EMPTY_PRODUCT })} className={btnCls}>+ منتج جديد</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {products.map((p) => (
          <Card key={p.id} className={`flex gap-3 ${p.is_active ? '' : 'opacity-50'}`}>
            <img src={p.image_url} alt="" className="size-20 rounded-2xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-coffee-900">{p.name_ar} <span className="text-[10px] font-bold text-neutral-400">{p.name_en}</span></p>
              <p className="mt-0.5 text-xs text-neutral-500">{p.description_ar}</p>
              <p className="mt-1 text-xs font-extrabold text-gold-deep">
                {p.sale_price_cents != null ? (
                  <>
                    <span className="me-1 rounded-full bg-[#C4482E] px-2 py-0.5 text-[9px] font-black text-white">عرض</span>
                    {eur(p.sale_price_cents, 'ل.س')} <span className="font-bold text-neutral-400 line-through">{eur(p.price_cents, 'ل.س')}</span>
                  </>
                ) : eur(p.price_cents, 'ل.س')}
                {' '}· ⭐ {p.points}
              </p>
              <p className="text-[10px] font-bold text-neutral-400">تصنيف: {p.category_slug}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => setEdit({ ...EMPTY_PRODUCT, ...p, category_slug: p.category_slug })} className="rounded-lg bg-[#E3E9C8] px-3 py-1.5 text-[11px] font-extrabold text-neutral-700">تعديل</button>
                <button disabled={busy} onClick={() => wrap(async () => { await arpc('admin_set_product_availability', { p_token: token, p_product_id: p.id, p_available: p.is_available === false }); load(); })}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold ${p.is_available === false ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                  {p.is_available === false ? 'غير متوفر' : 'متوفر'}
                </button>
                <button disabled={busy} onClick={() => { setOfferId(offerId === p.id ? null : p.id); setOfferVal(p.sale_price_cents != null ? String(p.sale_price_cents) : ''); }}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold ${p.sale_price_cents != null ? 'bg-[#C4482E] text-white' : 'bg-[#F1DCB0] text-[#7A5A22]'}`}>
                  عرض
                </button>
                {p.is_active && (
                  <button disabled={busy} onClick={() => wrap(async () => { await arpc('admin_delete_product', { p_token: token, p_id: p.id }); load(); })}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-extrabold text-red-600">تعطيل</button>
                )}
              </div>
              {offerId === p.id && (
                <div className="mt-2 rounded-xl bg-[#FFF9EC] p-3 ring-1 ring-[#EAD3A0]">
                  <p className="text-[10px] font-black text-[#7A5A22]">السعر الجديد (ل.س) — القديم يُمشَّط ويظهر شارة «عرض» للزبون</p>
                  <div className="mt-2 flex gap-2">
                    <input type="number" className={inputCls} value={offerVal} onChange={(e) => setOfferVal(e.target.value)} placeholder="مثال: 12000" />
                    <button disabled={busy || !offerVal} onClick={() => wrap(async () => { await arpc('admin_set_product_sale', { p_token: token, p_product_id: p.id, p_sale_cents: Number(offerVal) }); setOfferId(null); load(); })}
                      className="flex-none rounded-lg bg-[#414D36] px-3 py-1.5 text-[11px] font-extrabold text-[#C9D3A8]">حفظ</button>
                    {p.sale_price_cents != null && (
                      <button disabled={busy} onClick={() => wrap(async () => { await arpc('admin_set_product_sale', { p_token: token, p_product_id: p.id, p_sale_cents: null }); setOfferId(null); load(); })}
                        className="flex-none rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-extrabold text-red-600">إزالة العرض</button>
                    )}
                    <button onClick={() => setOfferId(null)} className="flex-none rounded-lg bg-neutral-100 px-3 py-1.5 text-[11px] font-extrabold text-neutral-600">إلغاء</button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {edit && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4 backdrop-blur-sm anim-fade">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl anim-pop">
            <h3 className="text-base font-extrabold text-coffee-900">{edit.id ? 'تعديل منتج' : 'منتج جديد'}</h3>
            <div className="mt-4 space-y-3">
              <Field label="الاسم بالعربية"><input className={inputCls} value={edit.name_ar} onChange={(e) => setEdit({ ...edit, name_ar: e.target.value })} /></Field>
              <Field label="الاسم بالإنجليزية"><input className={inputCls} dir="ltr" value={edit.name_en} onChange={(e) => setEdit({ ...edit, name_en: e.target.value })} /></Field>
              <Field label="الوصف"><textarea className={`${inputCls} h-20 py-2`} value={edit.description_ar} onChange={(e) => setEdit({ ...edit, description_ar: e.target.value })} /></Field>
              <Field label="خيارات الذوق (افصل بفاصلة)"><input className={inputCls} value={edit.options || ''} onChange={(e) => setEdit({ ...edit, options: e.target.value })} placeholder="سكر إضافي، بدون سكر، نعناع" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="السعر (ل.س)"><input type="number" className={inputCls} value={edit.price_cents} onChange={(e) => setEdit({ ...edit, price_cents: +e.target.value })} /></Field>
                <Field label="النقاط"><input type="number" className={inputCls} value={edit.points} onChange={(e) => setEdit({ ...edit, points: +e.target.value })} /></Field>
              </div>
              <Field label="صورة المنتج"><ImageUploadField value={edit.image_url} onChange={(url) => setEdit({ ...edit, image_url: url })} folder="products" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="التصنيف">
                  <select className={inputCls} value={edit.category_slug} onChange={(e) => setEdit({ ...edit, category_slug: e.target.value })}>
                    <option value="hot">القهوة الساخنة</option><option value="cold">المشروبات الباردة</option>
                    <option value="dessert">الحلويات</option><option value="extras">الإضافات</option>
                  </select>
                </Field>
                <Field label="نشط">
                  <select className={inputCls} value={String(edit.is_active)} onChange={(e) => setEdit({ ...edit, is_active: e.target.value === 'true' })}>
                    <option value="true">نعم</option><option value="false">لا</option>
                  </select>
                </Field>
              </div>
              <Field label="التوفر — غير المتوفر يُقفل طلب المنتج في تطبيق الزبون">
                <select className={inputCls} value={String(edit.is_available !== false)} onChange={(e) => setEdit({ ...edit, is_available: e.target.value === 'true' })}>
                  <option value="true">متوفر ✅</option>
                  <option value="false">غير متوفر (نفذت الكمية) 🔴</option>
                </select>
              </Field>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={save} disabled={busy} className="rounded-2xl bg-gradient-to-l from-gold to-gold-deep py-3 text-sm font-extrabold text-white shadow disabled:opacity-50">حفظ</button>
              <button onClick={() => setEdit(null)} className="rounded-2xl bg-neutral-100 py-3 text-sm font-extrabold text-neutral-600">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ العملاء ============================ */
function CustomersTab({ token }: { token: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const load = useCallback(() => { arpc<any[]>('admin_list_customers', { p_token: token }).then(setRows).catch(() => {}); }, [token]);
  useEffect(() => { load(); }, [load]);
  const { busy, wrap } = useAdminAction();
  const filtered = rows.filter((r) => r.full_name.includes(q) || r.phone.includes(q));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-coffee-900">العملاء ({rows.length})</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الهاتف…" className={`${inputCls} max-w-xs`} />
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-right text-xs">
          <thead><tr className="border-b border-beige text-neutral-400">
            <th className="p-3 font-extrabold">الاسم</th><th className="p-3 font-extrabold">الهاتف</th>
            <th className="p-3 font-extrabold">الطلبات</th><th className="p-3 font-extrabold">النقاط</th>
            <th className="p-3 font-extrabold">المكافآت</th><th className="p-3 font-extrabold">الحالة</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-beige/50">
                <td className="p-3 font-extrabold text-coffee-900">{c.full_name}</td>
                <td className="p-3" dir="ltr">{c.phone}</td>
                <td className="p-3">{c.orders_count}</td>
                <td className="p-3 font-black text-gold-deep">⭐ {c.points}</td>
                <td className="p-3">{c.redemptions}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{c.is_active ? 'نشط' : 'موقوف'}</span>
                </td>
                <td className="p-3">
                  <button disabled={busy} onClick={() => wrap(async () => { await arpc('admin_toggle_customer', { p_token: token, p_customer_id: c.id, p_active: !c.is_active }); load(); })}
                    className="rounded-lg bg-[#E3E9C8] px-3 py-1.5 text-[10px] font-extrabold text-neutral-700">{c.is_active ? 'إيقاف' : 'تنشيط'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ============================ المكافآت ============================ */
const EMPTY_REWARD = { id: 0, name_ar: '', name_en: '', image_url: '/img/latte.jpg', points_cost: 50, is_active: true, sort_order: 0 };
/* ============================ الإضافات المدفوعة ============================ */
function ExtrasTab({ token }: { token: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const load = useCallback(() => {
    arpc<any[]>('admin_list_additions', { p_token: token }).then(setItems).catch(() => {});
    sb.rpc('get_catalog').then(({ data }: any) => setProducts(data?.products ?? [])).catch(() => {});
  }, [token]);
  useEffect(() => { load(); }, [load]);
  const { busy, wrap } = useAdminAction();
  const pName = (id: number) => products.find((p) => p.id === id)?.name_ar ?? ('#' + id);
  const toggle = (pid: number) => setEdit((e: any) => {
    const ids: number[] = e.product_ids ?? [];
    return { ...e, product_ids: ids.includes(pid) ? ids.filter((x) => x !== pid) : [...ids, pid] };
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-coffee-900">الإضافات ({items.length})</h2>
        <button onClick={() => setEdit({ id: 0, name_ar: '', price_cents: '', is_active: true, product_ids: [] })} className={btnCls}>+ إضافة جديدة</button>
      </div>
      <p className="text-[11px] font-bold text-neutral-500">الإضافة اختيارية يختارها الزبون مع المنتج وتُضاف قيمتها على سعر المنتج تلقائيًا</p>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((a) => (
          <Card key={a.id} className={a.is_active ? '' : 'opacity-50'}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-extrabold text-coffee-900">{a.name_ar}</p>
              <p className="text-xs font-extrabold text-gold-deep">+ {eur(a.price_cents, 'ل.س')}</p>
            </div>
            <p className="mt-1 text-[10.5px] font-bold text-neutral-400">
              {(a.product_ids ?? []).length === 0 ? 'غير مرتبطة بمنتجات بعد' : 'ترتبط بـ ' + a.product_ids.length + ' منتج: ' + (a.product_ids ?? []).map(pName).slice(0, 4).join('، ') + ((a.product_ids ?? []).length > 4 ? '…' : '')}
            </p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => setEdit({ ...a })} className="rounded-lg bg-[#E3E9C8] px-3 py-1.5 text-[11px] font-extrabold text-neutral-700">تعديل</button>
              <button disabled={busy} onClick={() => wrap(async () => {
                if (!window.confirm('حذف الإضافة «' + a.name_ar + '» نهائيًا؟')) return;
                await arpc('admin_delete_addition', { p_token: token, p_addition_id: a.id });
                load();
              })} className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-extrabold text-red-600">حذف</button>
            </div>
          </Card>
        ))}
        {items.length === 0 && <p className="rounded-2xl bg-[#F6F0E2] p-6 text-center text-xs font-bold text-neutral-400">لا توجد إضافات بعد</p>}
      </div>

      {edit && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4 backdrop-blur-sm anim-fade">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl anim-pop">
            <h3 className="text-base font-extrabold text-coffee-900">{edit.id ? 'تعديل إضافة' : 'إضافة جديدة'}</h3>
            <div className="mt-4 space-y-3">
              <Field label="اسم الإضافة"><input className={inputCls} value={edit.name_ar} onChange={(e) => setEdit({ ...edit, name_ar: e.target.value })} placeholder="مثال: شوت إسبريسو زيادة" /></Field>
              <Field label="سعر الإضافة (ل.س)"><input type="number" className={inputCls} value={edit.price_cents} onChange={(e) => setEdit({ ...edit, price_cents: e.target.value })} placeholder="3000" /></Field>
              <Field label="المنتجات التي تُعرض معها (اختيار متعدد)">
                <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-xl border-2 border-beige p-2">
                  {products.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-neutral-700 hover:bg-[#F6F0E2]">
                      <input type="checkbox" checked={(edit.product_ids ?? []).includes(p.id)} onChange={() => toggle(p.id)} />
                      {p.name_ar}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="نشط">
                <select className={inputCls} value={String(edit.is_active)} onChange={(e) => setEdit({ ...edit, is_active: e.target.value === 'true' })}>
                  <option value="true">نعم</option><option value="false">لا</option>
                </select>
              </Field>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button disabled={busy || !edit.name_ar?.trim()} onClick={() => wrap(async () => {
                await arpc('admin_save_addition', { p_token: token, p_addition: { ...edit, price_cents: Number(edit.price_cents) || 0 } });
                setEdit(null); load();
              })} className="rounded-2xl bg-gradient-to-l from-gold to-gold-deep py-3 text-sm font-extrabold text-white disabled:opacity-50">حفظ</button>
              <button onClick={() => setEdit(null)} className="rounded-2xl bg-neutral-100 py-3 text-sm font-extrabold text-neutral-600">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RewardsTab({ token }: { token: string }) {
  const [rewards, setRewards] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const load = useCallback(() => {
    arpc<any[]>('admin_list_rewards', { p_token: token }).then(setRewards).catch(() => {});
    arpc<any[]>('admin_list_redemptions', { p_token: token }).then(setRedemptions).catch(() => {});
  }, [token]);
  useEffect(() => { load(); }, [load]);
  const { busy, wrap } = useAdminAction();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-coffee-900">المكافآت ({rewards.length})</h2>
        <button onClick={() => setEdit({ ...EMPTY_REWARD })} className={btnCls}>+ مكافأة جديدة</button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {rewards.map((r) => (
          <Card key={r.id} className={r.is_active ? '' : 'opacity-50'}>
            <img src={r.image_url} alt="" className="h-28 w-full rounded-2xl object-cover" />
            <p className="mt-2 text-sm font-extrabold text-coffee-900">{r.name_ar}</p>
            <p className="text-xs font-extrabold text-gold-deep">⭐ {r.points_cost} نقطة</p>
            <p className="text-[11px] text-neutral-400">استبدالات: {r.redemptions_count}</p>
            <div className="mt-2 flex gap-2">
              <button disabled={busy} onClick={() => wrap(async () => {
                if (!window.confirm('حذف نهائي للمكافأة «' + r.name_ar + '»؟ أكواد الزبائن القديمة تبقى صالحة.')) return;
                await arpc('admin_delete_reward', { p_token: token, p_id: r.id });
                load();
              })} className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-extrabold text-red-600">🗑️ حذف نهائي</button>
            </div>
          </Card>
        ))}
      </div>

      <h2 className="pt-2 text-base font-extrabold text-coffee-900">أكواد الاستبدال ({redemptions.length})</h2>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-right text-xs">
          <thead><tr className="border-b border-beige text-neutral-400">
            <th className="p-3 font-extrabold">الكود</th><th className="p-3 font-extrabold">المكافأة</th>
            <th className="p-3 font-extrabold">العميل</th><th className="p-3 font-extrabold">النقاط</th>
            <th className="p-3 font-extrabold">الحالة</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {redemptions.map((r) => (
              <tr key={r.code} className="border-b border-beige/50">
                <td className="p-3 font-mono text-sm font-black tracking-widest text-coffee-900" dir="ltr">{r.code}</td>
                <td className="p-3 font-bold">{r.reward_name}</td>
                <td className="p-3">{r.customer_name}</td>
                <td className="p-3">⭐ {r.points_cost}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${r.status === 'unused' ? 'bg-emerald-100 text-emerald-700' : r.status === 'used' ? 'bg-neutral-100 text-neutral-500' : 'bg-red-50 text-red-500'}`}>
                  {r.status === 'unused' ? 'غير مستخدم' : r.status === 'used' ? 'مستخدم' : 'منتهي'}</span></td>
                <td className="p-3">
                  {r.status === 'unused' && (
                    <button disabled={busy} onClick={() => wrap(async () => { await arpc('admin_set_redemption_status', { p_token: token, p_code: r.code, p_status: 'used' }); load(); })}
                      className="rounded-lg bg-[#E3E9C8] px-3 py-1.5 text-[10px] font-extrabold text-neutral-700">تعليم كمستخدم</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {edit && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4 backdrop-blur-sm anim-fade">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl anim-pop">
            <h3 className="text-base font-extrabold text-coffee-900">{edit.id ? 'تعديل مكافأة' : 'مكافأة جديدة'}</h3>
            <div className="mt-4 space-y-3">
              <Field label="الاسم"><input className={inputCls} value={edit.name_ar} onChange={(e) => setEdit({ ...edit, name_ar: e.target.value })} /></Field>
              <Field label="النقاط المطلوبة"><input type="number" className={inputCls} value={edit.points_cost} onChange={(e) => setEdit({ ...edit, points_cost: +e.target.value })} /></Field>
              <Field label="صورة المكافأة"><ImageUploadField value={edit.image_url} onChange={(url) => setEdit({ ...edit, image_url: url })} folder="rewards" /></Field>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button disabled={busy} onClick={() => wrap(async () => { await arpc('admin_save_reward', { p_token: token, p_reward: edit }); setEdit(null); load(); })}
                className="rounded-2xl bg-gradient-to-l from-gold to-gold-deep py-3 text-sm font-extrabold text-white disabled:opacity-50">حفظ</button>
              <button onClick={() => setEdit(null)} className="rounded-2xl bg-neutral-100 py-3 text-sm font-extrabold text-neutral-600">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ الإعلانات ============================ */
const EMPTY_AD = { id: 0, image_url: '/img/latte.jpg', category_slug: '', description_ar: '', ends_at: '', is_active: true, full_screen: false, show_in_hero: true };
function AdsTab({ token }: { token: string }) {
  const [ads, setAds] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const load = useCallback(() => { arpc<any[]>('admin_list_ads', { p_token: token }).then(setAds).catch(() => {}); }, [token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { sb.rpc('get_catalog').then(({ data }: any) => setCats(data?.categories ?? [])).catch(() => {}); }, []);
  const { busy, wrap } = useAdminAction();
  const catName = (slug: string) => cats.find((c) => c.slug === slug)?.name_ar ?? slug;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-coffee-900">الإعلانات ({ads.length})</h2>
        <button onClick={() => setEdit({ ...EMPTY_AD })} className={btnCls}>+ إعلان جديد</button>
      </div>
      <p className="text-[11px] font-bold text-neutral-500">الإعلان موجّه لفئة كاملة من المنتجات — يظهر في الهيرو/وسط الشاشة، وعروض الأصناف الفردية تُحدَّد من زر «عرض» في تبويب المنتجات</p>
      <div className="grid gap-3 md:grid-cols-2">
        {ads.map((a) => (
          <Card key={a.id} className={a.is_active ? '' : 'opacity-50'}>
            <div className="flex gap-3">
              <img src={a.image_url} alt="" className="size-20 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-coffee-900">{a.title}
                  <span className={`ms-2 rounded-full px-2 py-0.5 text-[9px] font-black ${a.full_screen ? 'bg-[#414D36] text-[#C9D3A8]' : 'bg-[#D5DEB4] text-[#414D36]'}`}>
                    {a.full_screen ? 'إعلان منبثق' : 'ضمن الهيرو'}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">{a.description_ar}</p>
                <p className="mt-0.5 text-[10px] font-bold text-neutral-400">
                  {a.full_screen ? '🖥️ إعلان منبثق — يظهر بعد دقيقتين من التصفح' : '📱 يظهر ضمن الهيرو المتنقل'}
                  {a.ends_at ? ' · حتى ' + new Date(a.ends_at).toLocaleDateString('ar-SY', { day: 'numeric', month: 'short' }) : ' · بلا نهاية'}
                </p>
                {a.category_slug && (
                  <span className="mt-1 inline-block rounded-full bg-[#EEF2DC] px-2.5 py-1 text-[10px] font-black text-[#414D36]">🏷️ فئة: {catName(a.category_slug)}</span>
                )}
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => setEdit({ ...EMPTY_AD, ...a, ends_at: a.ends_at ? a.ends_at.slice(0, 16) : '' })} className="rounded-lg bg-[#E3E9C8] px-3 py-1.5 text-[11px] font-extrabold text-neutral-700">تعديل</button>
              <button disabled={busy} onClick={() => wrap(async () => { await arpc('admin_delete_ad', { p_token: token, p_id: a.id }); load(); })}
                className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-extrabold text-red-600">حذف</button>
            </div>
          </Card>
        ))}
      </div>

      {edit && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4 backdrop-blur-sm anim-fade">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl anim-pop">
            <h3 className="text-base font-extrabold text-coffee-900">{edit.id ? 'تعديل إعلان' : 'إعلان جديد'}</h3>
            <div className="mt-4 space-y-3">
              <Field label="فئة المنتجات المستهدفة — العنوان يُشتق منها تلقائيًا (مثال: عروض الموهيتو)">
                <select className={inputCls} value={edit.category_slug ?? ''} onChange={(e) => setEdit({ ...edit, category_slug: e.target.value })}>
                  <option value="">— اختر الفئة —</option>
                  {cats.map((c) => <option key={c.slug} value={c.slug}>{c.name_ar}</option>)}
                </select>
              </Field>
              <Field label="الوصف"><textarea className={`${inputCls} h-20 py-2`} value={edit.description_ar} onChange={(e) => setEdit({ ...edit, description_ar: e.target.value })} placeholder="مثال: عرض حصري على أغلب أصناف الموهيتو" /></Field>
              <Field label="نهاية العرض (اختياري — يبدأ فور الحفظ)"><input type="datetime-local" className={inputCls} dir="ltr" value={edit.ends_at} onChange={(e) => setEdit({ ...edit, ends_at: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="نشط">
                  <select className={inputCls} value={String(edit.is_active)} onChange={(e) => setEdit({ ...edit, is_active: e.target.value === 'true' })}>
                    <option value="true">نعم</option><option value="false">لا</option>
                  </select>
                </Field>
                <Field label="مكان الظهور">
                  <select className={inputCls} value={edit.full_screen ? 'both' : 'hero'} onChange={(e) => setEdit({ ...edit, full_screen: e.target.value === 'both', show_in_hero: true })}>
                    <option value="hero">ضمن الهيرو فقط (بدون منبثق)</option>
                    <option value="both">إعلان منبثق بعد دقيقتين (بدون الهيرو)</option>
                  </select>
                </Field>
              </div>
              <Field label="صورة الإعلان"><ImageUploadField value={edit.image_url} onChange={(url) => setEdit({ ...edit, image_url: url })} folder="ads" /></Field>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button disabled={busy || !(edit.category_slug ?? '').trim()} onClick={() => wrap(async () => {
                const ad = { ...edit, ends_at: edit.ends_at ? new Date(edit.ends_at).toISOString() : '' };
                await arpc('admin_save_ad', { p_token: token, p_ad: ad });
                setEdit(null); load();
              })}
                className="rounded-2xl bg-gradient-to-l from-gold to-gold-deep py-3 text-sm font-extrabold text-white disabled:opacity-50">حفظ</button>
              <button onClick={() => setEdit(null)} className="rounded-2xl bg-neutral-100 py-3 text-sm font-extrabold text-neutral-600">إلغاء</button>
            </div>
            <p className="mt-3 rounded-xl bg-[#EEF2DC] px-3 py-2 text-[10.5px] font-bold leading-relaxed text-[#77825E]">
              لحسم أسعار أصناف محددة داخل الفئة (سعر مشطوب + شارة «عرض» للزبون) استخدم زر «عرض» في تبويب المنتجات.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ إشعار ============================ */
function NotifyTab({ token }: { token: string }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [scope, setScope] = useState<'all' | 'one'>('all');
  const [customerId, setCustomerId] = useState('');
  const [msg, setMsg] = useState('');
  const { busy, wrap } = useAdminAction();
  return (
    <div className="mx-auto max-w-md">
      <h2 className="mb-3 text-base font-extrabold text-coffee-900">إرسال إشعار</h2>
      <Card className="space-y-3">
        <Field label="العنوان"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: ☕ عرض الجمعة!" /></Field>
        <Field label="النص"><textarea className={`${inputCls} h-24 py-2`} value={body} onChange={(e) => setBody(e.target.value)} placeholder="تفاصيل الإشعار…" /></Field>
        <Field label="الجمهور">
          <select className={inputCls} value={scope} onChange={(e) => setScope(e.target.value as any)}>
            <option value="all">كل العملاء</option><option value="one">عميل محدد (ID)</option>
          </select>
        </Field>
        {scope === 'one' && (
          <Field label="معرّف العميل (Customer ID)">
            <input className={inputCls} dir="ltr" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="uuid…" />
          </Field>
        )}
        {msg && <p className="rounded-xl bg-green-50 px-3 py-2 text-center text-xs font-extrabold text-green-700">{msg}</p>}
        <button disabled={busy || !title} onClick={() => wrap(async () => {
          const n = await arpc<number>('admin_send_notification', { p_token: token, p_title: title, p_body: body, p_customer_id: scope === 'one' ? customerId || null : null });
          setMsg(`تم الإرسال إلى ${n} عميل ✓`); setTitle(''); setBody('');
          setTimeout(() => setMsg(''), 4000);
        })} className={`w-full rounded-2xl py-3 text-sm font-extrabold text-white shadow active:scale-[.98] disabled:opacity-40 ${btnCls}`} style={{ borderRadius: 16 }}>
          {busy ? 'جارٍ الإرسال…' : 'إرسال الإشعار'}
        </button>
      </Card>
    </div>
  );
}

/* ============================ كود الخصم ============================ */
function PromoTab({ token }: { token: string }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [catalog, setCatalog] = useState<any>(null);
  useEffect(() => { sb.rpc('get_catalog').then(({ data }) => setCatalog(data as any)).catch(() => {}); }, []);
  const load = useCallback(() => { arpc<Record<string, string>>('admin_get_settings', { p_token: token }).then(setSettings).catch(() => {}); }, [token]);
  useEffect(() => { load(); }, [load]);
  const { busy, wrap } = useAdminAction();

  return (
    <div className="mx-auto max-w-md">
      <h2 className="mb-1 text-base font-extrabold text-coffee-900">كود الخصم</h2>
      <p className="mb-3 text-[11px] font-bold text-neutral-500">انشر كود خصم يظهر في الشاشة الرئيسية، ويستخدمه الزبون في الكشك للحصول على الخصم</p>
      <Card className="space-y-3">
        {settings.promo_code && settings.promo_discount && (
          <div className="rounded-2xl bg-[#EEF2DC] p-3.5 text-center">
            <p className="text-[10px] font-black text-[#7C8665]">الكود المنشور حاليًا</p>
            <p className="mt-0.5 font-mono text-2xl font-black tracking-[.25em] text-coffee-900" dir="ltr">{settings.promo_code}</p>
            <p className="mt-1 text-[11px] font-extrabold text-[#7C8F52]">خصم {settings.promo_discount}%</p>
          </div>
        )}
        <Field label="الكود (حروف وأرقام)"><input className={inputCls} dir="ltr" value={settings.promo_code ?? ''} onChange={(e) => setSettings({ ...settings, promo_code: e.target.value.toUpperCase() })} placeholder="DOSE50" /></Field>
        <Field label="نسبة الخصم % (1 - 90)"><input type="number" className={inputCls} value={settings.promo_discount ?? ''} onChange={(e) => setSettings({ ...settings, promo_discount: e.target.value })} placeholder="20" /></Field>
        <Field label="نطاق الكود">
          <select className={inputCls} value={settings.promo_scope ?? 'all'} onChange={(e) => setSettings({ ...settings, promo_scope: e.target.value, promo_target: '' })}>
            <option value="all">على الطلب كاملًا</option>
            <option value="product">منتج محدد فقط</option>
            <option value="category">فئة محددة فقط</option>
          </select>
        </Field>
        {settings.promo_scope === 'product' && (
          <Field label="اختر المنتج">
            <select className={inputCls} value={settings.promo_target ?? ''} onChange={(e) => setSettings({ ...settings, promo_target: e.target.value })}>
              <option value="">— اختر —</option>
              {(catalog?.products ?? []).map((p: any) => <option key={p.id} value={String(p.id)}>{p.name_ar}</option>)}
            </select>
          </Field>
        )}
        {settings.promo_scope === 'category' && (
          <Field label="اختر الفئة">
            <select className={inputCls} value={settings.promo_target ?? ''} onChange={(e) => setSettings({ ...settings, promo_target: e.target.value })}>
              <option value="">— اختر —</option>
              {(catalog?.categories ?? []).map((c: any) => <option key={c.id} value={c.slug}>{c.name_ar}</option>)}
            </select>
          </Field>
        )}
        {msg && <p className="rounded-xl bg-green-50 px-3 py-2 text-center text-xs font-extrabold text-green-700">{msg}</p>}
        <button disabled={busy || !(settings.promo_code ?? '').trim()} onClick={() => wrap(async () => {
          const r = await arpc<{ notified: number }>('admin_publish_promo', { p_token: token, p_code: settings.promo_code, p_discount: Number(settings.promo_discount), p_scope: settings.promo_scope ?? 'all', p_target: settings.promo_scope === 'all' ? null : (settings.promo_target ?? null) });
          setMsg('تم نشر الكود — أُرسل إشعار داخلي وفوري إلى ' + (r.notified ?? 'كل') + ' الزبائن ✓');
          load(); setTimeout(() => setMsg(''), 6000);
        })} className={`${btnCls} w-full`} style={{ borderRadius: 16, height: 46 }}>
          {busy ? 'جارٍ النشر…' : 'نشر الكود وإرسال الإشعارات'}
        </button>
        {settings.promo_code && (
          <button disabled={busy} onClick={() => wrap(async () => {
            await arpc('admin_delete_promo', { p_token: token });
            setMsg('حُذف كود الخصم — اختفى من التطبيق'); load();
            setTimeout(() => setMsg(''), 5000);
          })} className="w-full rounded-2xl bg-red-50 py-3 text-sm font-black text-[#C4482E] transition active:scale-[.98] disabled:opacity-40">
            🗑️ حذف كود الخصم
          </button>
        )}
      </Card>
    </div>
  );
}

/* ============================ توقيت دوامي ============================ */
function HoursTab({ token }: { token: string }) {
  const [workOpen, setWorkOpen] = useState('');
  const [workClose, setWorkClose] = useState('');
  const [closedMessage, setClosedMessage] = useState('');
  const [msg, setMsg] = useState('');
  const [, setTick] = useState(0);
  const load = useCallback(() => { arpc<Record<string, string>>('admin_get_settings', { p_token: token }).then((s) => { setWorkOpen(s.work_open ?? ''); setWorkClose(s.work_close ?? ''); setClosedMessage(s.closed_message ?? ''); }).catch(() => {}); }, [token]);
  useEffect(() => { load(); }, [load]);
  /* تحديث حالة «مفتوح/مغلق» الحية كل دقيقة */
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 60000); return () => clearInterval(t); }, []);
  const { busy, wrap } = useAdminAction();
  const st = shopStatus({ work_open: workOpen, work_close: workClose });
  const norm = (t: string) => (t ? t.split(':').map((x, i) => (i === 0 ? String(Number(x)).padStart(2, '0') : x)).join(':') : '');

  return (
    <div className="mx-auto max-w-md">
      <h2 className="mb-1 text-base font-extrabold text-coffee-900">توقيت دوامي</h2>
      <p className="mb-3 text-[11px] font-bold text-neutral-500">حدّد وقت فتح المحل وغلقه — يُمنع الطلب خارج الدوام في التطبيق والكشك تلقائيًا</p>
      <Card className="space-y-4">
        {/* الحالة الحية */}
        <div className={`rounded-2xl p-4 text-center ${st.closed ? 'bg-[#FBEDE9]' : 'bg-[#EEF2DC]'}`}>
          <p className={`text-lg font-black ${st.closed ? 'text-[#C4482E]' : 'text-[#414D36]'}`}>
            {st.closed ? '🌙 المحل مغلق الآن' : '🟢 المحل مفتوح الآن'}
          </p>
          <p className="mt-1 text-[11px] font-bold text-neutral-500" dir="ltr">
            {workOpen || '--:--'} → {workClose || '--:--'} (بتوقيت دمشق)
          </p>
        </div>
        <Field label="وقت الفتح">
          <input type="time" className={inputCls} dir="ltr" value={workOpen} onChange={(e) => setWorkOpen(e.target.value)} />
        </Field>
        <Field label="وقت الإغلاق">
          <input type="time" className={inputCls} dir="ltr" value={workClose} onChange={(e) => setWorkClose(e.target.value)} />
        </Field>
        <Field label="رسالة الإغلاق (اختياري — بأسلوبك ومزاجك)">
          <textarea className={`${inputCls} h-24 py-2`} value={closedMessage} onChange={(e) => setClosedMessage(e.target.value)}
            placeholder="مثال: خلاص قفلنا اليوم 🌙 عساك من أهل الجنة، باجهزكم الساعة 10 صباحًا ☕" />
        </Field>
        {msg && <p className="rounded-xl bg-green-50 px-3 py-2 text-center text-xs font-extrabold text-green-700">{msg}</p>}
        <button disabled={busy} onClick={() => wrap(async () => {
          await arpc('admin_save_settings', { p_token: token, p_settings: { work_open: norm(workOpen), work_close: norm(workClose), closed_message: closedMessage } });
          setMsg('حُفظ التوقيت والرسالة — سارٍ فورًا في التطبيق والكشك ✓');
          setTimeout(() => setMsg(''), 5000);
        })} className={`${btnCls} w-full`} style={{ borderRadius: 16, height: 46 }}>
          {busy ? 'جارٍ الحفظ…' : 'حفظ التوقيت'}
        </button>
        <p className="rounded-xl bg-[#EEF2DC] px-3 py-2 text-[10.5px] font-bold leading-relaxed text-[#77825E]">
          عند الإغلاق يظهر للزبون رسالتك (أو الرسالة الافتراضية إذا تركت الحقل فارغًا) مع موعد الفتح، ولا يستطيع النقر على زر الطلب — كما يُرفض أي طلب خارج الدوام من الخادم.
        </p>
      </Card>
    </div>
  );
}

/* ============================ الإعدادات ============================ */
function SettingsTab({ token }: { token: string }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const load = useCallback(() => { arpc<Record<string, string>>('admin_get_settings', { p_token: token }).then(setSettings).catch(() => {}); }, [token]);
  useEffect(() => { load(); }, [load]);
  const { busy, wrap } = useAdminAction();
  const fields = [
    { key: 'whatsapp_number', label: 'رقم WhatsApp للمحل (بصيغة دولية بدون +)' },
    { key: 'store_phone', label: 'رقم هاتف المحل' },
    { key: 'currency_symbol', label: 'رمز العملة' },
    { key: 'points_award_mode', label: 'منح النقاط (on_create: عند الطلب — on_complete: عند الإكمال)' },
  ];
  return (
    <div className="mx-auto max-w-md">
      <h2 className="mb-3 text-base font-extrabold text-coffee-900">إعدادات المنصة</h2>
      <Card className="space-y-3">
        {fields.map((f) => (
          <Field key={f.key} label={f.label}>
            {f.key === 'points_award_mode' ? (
              <select className={inputCls} value={settings[f.key] ?? 'on_complete'}
                onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}>
                <option value="on_complete">عند إكمال الطلب</option>
                
              </select>
            ) : (
              <input className={inputCls} dir="ltr" value={settings[f.key] ?? ''} onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })} />
            )}
          </Field>
        ))}
        <button disabled={busy} onClick={() => wrap(async () => { await arpc('admin_save_settings', { p_token: token, p_settings: settings }); load(); alert('تم الحفظ ✓'); })}
          className={`w-full ${btnCls}`} style={{ borderRadius: 16, height: 44 }}>حفظ الإعدادات</button>
      </Card>
    </div>
  );
}
