// لوحة الإدارة: اشتراك Push عند الدخول + نطاق كود الخصم (كل الطلب/منتج/فئة)
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/admin/AdminApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

const VAPID_PUB = 'BCDKL0U34tZgWEGIygt6PLe6tpX_7kOn4bkavZYoO6OAPdEBC0kjDpLxuDouKqWNqjgsC5h9V2gNJ08POBsRLmo';

/* 1) دالة تحويل مفتاح VAPID */
const helper = `const ADMIN_KEY = 'dose_admin_token_v1';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}`;
if (!s.includes("const ADMIN_KEY = 'dose_admin_token_v1';")) fail('ADMIN_KEY');
if (!s.includes('urlBase64ToUint8Array')) {
  s = s.replace("const ADMIN_KEY = 'dose_admin_token_v1';", helper);
}

/* 2) اشتراك الإدارة في الإشعارات الخارجية عند الدخول + صلاحية الإشعارات */
const oldRoot = `  useEffect(() => {
    if (token && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [token]);`;
if (!s.includes(oldRoot)) fail('root effect');
const newRoot = `  useEffect(() => {
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
  }, [token]);`;
s = s.replace(oldRoot, newRoot);

/* 3) PromoTab: قائمة نطاق + قائمة هدف (منتج/فئة) */
const oldPromoFields = `        <Field label="نسبة الخصم % (1 - 90)"><input type="number" className={inputCls} value={settings.promo_discount ?? ''} onChange={(e) => setSettings({ ...settings, promo_discount: e.target.value })} placeholder="20" /></Field>`;
if (!s.includes(oldPromoFields)) fail('promo fields');
const newPromoFields = `        <Field label="نسبة الخصم % (1 - 90)"><input type="number" className={inputCls} value={settings.promo_discount ?? ''} onChange={(e) => setSettings({ ...settings, promo_discount: e.target.value })} placeholder="20" /></Field>
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
        )}`;
s = s.replace(oldPromoFields, newPromoFields);

/* 4) PromoTab: جلب الكتالوج + تمريره */
const oldPromoSig = `function PromoTab({ token }: { token: string }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const load = useCallback(() => { arpc<Record<string, string>>('admin_get_settings', { p_token: token }).then(setSettings).catch(() => {}); }, [token]);`;
if (!s.includes(oldPromoSig)) fail('promo sig');
const newPromoSig = `function PromoTab({ token }: { token: string }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [catalog, setCatalog] = useState<any>(null);
  useEffect(() => { fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/get_catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.json()).then(setCatalog).catch(() => {}); }, []);
  const load = useCallback(() => { arpc<Record<string, string>>('admin_get_settings', { p_token: token }).then(setSettings).catch(() => {}); }, [token]);`;
s = s.replace(oldPromoSig, newPromoSig);

/* 5) النشر يمرر النطاق والهدف */
const oldPublish = `const r = await arpc<{ notified: number }>('admin_publish_promo', { p_token: token, p_code: settings.promo_code, p_discount: Number(settings.promo_discount) });`;
if (!s.includes(oldPublish)) fail('publish call');
const newPublish = `const r = await arpc<{ notified: number }>('admin_publish_promo', { p_token: token, p_code: settings.promo_code, p_discount: Number(settings.promo_discount), p_scope: settings.promo_scope ?? 'all', p_target: settings.promo_scope === 'all' ? null : (settings.promo_target ?? null) });`;
s = s.replace(oldPublish, newPublish);

writeFileSync(f, s);
console.log('admin push subscription + promo scope added');
