// زر حذف لكل إشعار + تبويب كود الخصم في لوحة الإدارة
import { readFileSync, writeFileSync } from 'node:fs';

/* ===== تطبيق العميل: زر حذف الإشعار ===== */
const cf = 'src/customer/CustomerApp.tsx';
let s = readFileSync(cf, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

const oldNotifCard = `      {items.map((n) => (
        <div key={n.id} className={\`rounded-[1.5rem] p-4 \${n.is_read ? 'bg-white/70' : 'bg-[#F1DCB0] shadow-sm'}\`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-[#221B12]">{n.title}</p>
              {n.body && <p className="mt-1 text-xs leading-relaxed text-[#6E6553]">{n.body}</p>}
            </div>
            <span className="flex-none text-[10px] font-bold text-[#94826A]">{fmtDateTime(n.created_at)}</span>
          </div>
        </div>
      ))}`;
if (!s.includes(oldNotifCard)) fail('notification card');
const newNotifCard = `      {items.map((n) => (
        <div key={n.id} className={\`flex items-start gap-2.5 rounded-[1.5rem] p-4 \${n.is_read ? 'bg-white/70' : 'bg-[#F1DCB0] shadow-sm'}\`}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-[#221B12]">{n.title}</p>
            {n.body && <p className="mt-1 text-xs leading-relaxed text-[#6E6553]">{n.body}</p>}
            <span className="mt-1 block text-[10px] font-bold text-[#94826A]">{fmtDateTime(n.created_at)}</span>
          </div>
          <button onClick={() => onDeleteNotif(n.id)}
            className="grid size-9 flex-none place-items-center rounded-full bg-white/80 text-[#C4482E] transition active:scale-90" aria-label="حذف الإشعار">
            <Icon name="trash" size={14} />
          </button>
        </div>
      ))}`;
s = s.replace(oldNotifCard, newNotifCard);

// خاصية onDeleteNotif في NotificationsPage
const oldSig = `function NotificationsPage({ myData, session, onSeen, onEnablePush, pushMsg }: {
  myData: MyData | null; session: Session | null; onSeen: () => void; onEnablePush: () => void; pushMsg: string;
}) {`;
if (!s.includes(oldSig)) fail('notifications page sig');
s = s.replace(oldSig, `function NotificationsPage({ myData, session, onSeen, onEnablePush, pushMsg, onDeleteNotif }: {
  myData: MyData | null; session: Session | null; onSeen: () => void; onEnablePush: () => void; pushMsg: string; onDeleteNotif: (id: number) => void;
}) {`);

// تمرير الدالة من الهيكل
const oldRoute = `<NotificationsPage myData={myData} session={session} pushMsg={pushMsg}`;
if (!s.includes(oldRoute)) fail('notifications route');
s = s.replace(oldRoute, `<NotificationsPage myData={myData} session={session} pushMsg={pushMsg} onDeleteNotif={deleteNotif}`);

// دالة الحذف في الهيكل
const oldRedeem = `  const redeem = async (reward: any) => {`;
if (!s.includes(oldRedeem)) fail('redeem anchor');
s = s.replace(oldRedeem, `  const deleteNotif = async (id: number) => {
    if (!session) return;
    try {
      await rpc('delete_notification', { p_token: session.token, p_notif_id: id });
      refresh();
      show('حُذف الإشعار', 'ok');
    } catch (e: any) { show(e.message, 'err'); }
  };

  const redeem = async (reward: any) => {`);

writeFileSync(cf, s);
console.log('customer: notification delete added');

/* ===== لوحة الإدارة: تبويب كود الخصم ===== */
const af = 'src/admin/AdminApp.tsx';
let a = readFileSync(af, 'utf8').replace(/\r\n/g, '\n');

// التبويب
const oldTab = `  { id: 'settings', label: 'الإعدادات', icon: 'settings' },
];`;
if (!a.includes(oldTab)) fail('tabs');
a = a.replace(oldTab, `  { id: 'settings', label: 'الإعدادات', icon: 'settings' },
  { id: 'promo', label: 'كود الخصم', icon: 'gift' },
];`);
a = a.replace("type TabId = 'dashboard' | 'orders' | 'products' | 'customers' | 'rewards' | 'ads' | 'notify' | 'settings';",
              "type TabId = 'dashboard' | 'orders' | 'products' | 'customers' | 'rewards' | 'ads' | 'notify' | 'settings' | 'promo';");

// المسار
const oldSettingsRoute = `        {tab === 'settings' && <SettingsTab token={token} />}`;
if (!a.includes(oldSettingsRoute)) fail('settings route');
a = a.replace(oldSettingsRoute, oldSettingsRoute + `\n        {tab === 'promo' && <PromoTab token={token} />}`);

// مكون التبويب قبل SettingsTab
const anchorSettings = `/* ============================ الإعدادات ============================ */`;
if (!a.includes(anchorSettings)) fail('settings anchor');
const promoTab = `/* ============================ كود الخصم ============================ */
function PromoTab({ token }: { token: string }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const load = useCallback(() => { rpc<Record<string, string>>('admin_get_settings', { p_token: token }).then(setSettings).catch(() => {}); }, [token]);
  useEffect(() => { load(); }, [load]);
  const { busy, wrap } = useAdminAction();

  return (
    <div className="mx-auto max-w-md">
      <h2 className="mb-1 text-base font-extrabold text-coffee-900">كود الخصم</h2>
      <p className="mb-3 text-[11px] font-bold text-neutral-500">انشر كود خصم يظهر في الشاشة الرئيسية للتطبيق، ويستخدمه الزبون في الكشك للحصول على الخصم</p>
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
        {msg && <p className="rounded-xl bg-green-50 px-3 py-2 text-center text-xs font-extrabold text-green-700">{msg}</p>}
        <button disabled={busy || !(settings.promo_code ?? '').trim()} onClick={() => wrap(async () => {
          const r = await rpc<{ notified: number }>('admin_publish_promo', { p_token: token, p_code: settings.promo_code, p_discount: Number(settings.promo_discount) });
          setMsg('تم نشر الكود — أُرسل إشعار داخلي وفوري إلى ' + (r.notified ?? 'كل') + ' الزبائن ✓');
          load(); setTimeout(() => setMsg(''), 5000);
        })} className={\`\${btnCls} w-full\`} style={{ borderRadius: 16, height: 46 }}>
          {busy ? 'جارٍ النشر…' : 'نشر الكود وإرسال الإشعارات'}
        </button>
      </Card>
    </div>
  );
}

`;
a = a.replace(anchorSettings, promoTab + anchorSettings);

writeFileSync(af, a);
console.log('admin promo tab added');
