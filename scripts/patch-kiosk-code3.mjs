// الكشك: رمز الخصم — مراسي مطابقة للملف الحالي
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/kiosk/KioskApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* 1) الحالات */
const oldState = "  const [done, setDone] = useState<{ orderNumber: number; points: number } | null>(null);";
if (!s.includes(oldState)) fail('done state');
s = s.replace(oldState, `  const [done, setDone] = useState<{ orderNumber: number; points: number; free: boolean } | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [appliedCode, setAppliedCode] = useState<{ code: string; name: string } | null>(null);
  const [codeMsg, setCodeMsg] = useState<{ msg: string; ok: boolean } | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);`);

/* 2) applyCode بعد orderNow */
const anchorOrderNow = `  const orderNow = () => {
    if (!cart.size) return showToast('اضغط على المنتجات لإضافتها إلى طلبك');
    if (!customer) return showToast('اختر اسمك أولًا من البطاقة');
    setStep('pin');
  };`;
if (!s.includes(anchorOrderNow)) fail('orderNow');
s = s.replace(anchorOrderNow, anchorOrderNow + `

  const applyCode = async () => {
    if (codeBusy) return;
    if (!codeInput.trim()) { setCodeMsg({ msg: 'أدخل الرمز أولًا', ok: false }); return; }
    setCodeBusy(true); setCodeMsg(null);
    try {
      const res = await rpc<any>('check_reward_code', { p_code: codeInput.trim() });
      if (res.valid) {
        setAppliedCode({ code: res.code, name: res.reward_name });
        setCodeMsg({ msg: 'مطبق: ' + res.reward_name + ' — الطلب مجاني 🎁', ok: true });
        showToast('تم تطبيق رمز الخصم — طلبك مجاني', 'ok');
      } else {
        setCodeMsg({ msg: res.reason, ok: false });
      }
    } catch { setCodeMsg({ msg: 'تعذر التحقق من الرمز', ok: false }); }
    setCodeBusy(false);
  };`);

/* 3) create_order يمرر الرمز */
const oldPin = `        p_source: 'kiosk',
      });`;
if (!s.includes(oldPin)) fail('create_order tail');
s = s.replace(oldPin, `        p_source: 'kiosk',
        p_reward_code: appliedCode?.code ?? null,
      });`);

/* 4) reset يمسح الرمز */
const oldReset = `  const reset = () => {
    setCart(new Map()); setCustomer(null); setQuery(''); setSuggestions('idle');
    setStep('idle'); setDone(null); setView('lookup');
  };`;
if (!s.includes(oldReset)) fail('reset');
s = s.replace(oldReset, `  const reset = () => {
    setCart(new Map()); setCustomer(null); setQuery(''); setSuggestions('idle');
    setStep('idle'); setDone(null); setView('lookup');
    setCodeInput(''); setAppliedCode(null); setCodeMsg(null);
  };`);

/* 5) واجهة رمز الخصم + الزر */
const oldBtn = `<button onClick={orderNow} disabled={!cart.size || !customer}
                    className="w-full rounded-xl py-3 text-[15px] font-black shadow-md shadow-[#8a6a48]/30 transition active:scale-[.98] disabled:opacity-40"
                    style={{ background: '#C9D3A8', color: '#26301C' }}>
                    اطلب الآن
                  </button>`;
if (!s.includes(oldBtn)) fail('order button');
const newBtn = `{appliedCode ? (
                    <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: '#E3E9C8', border: '1.5px solid #7C8F52' }}>
                      <span className="text-[11.5px] font-extrabold" style={{ color: '#26301C' }}>🎁 {appliedCode.name} — الطلب مجاني</span>
                      <button onClick={() => { setAppliedCode(null); setCodeMsg(null); setCodeInput(''); }}
                        className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold" style={{ color: '#6E6553' }}>إزالة</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} placeholder="رمز خصم؟ (من تطبيق Dose)"
                        className="h-9 min-w-0 flex-1 rounded-lg border-[1.5px] bg-white px-2.5 text-[11.5px] font-bold outline-none"
                        style={{ borderColor: '#D9C49C', color: '#221B12' }} />
                      <button onClick={applyCode} disabled={codeBusy || !codeInput.trim()}
                        className="flex-none rounded-lg px-3 py-2 text-[11px] font-extrabold disabled:opacity-40"
                        style={{ background: '#E3E9C8', color: '#37422C' }}>{codeBusy ? '…' : 'تطبيق'}</button>
                    </div>
                  )}
                  {codeMsg && (
                    <p className="rounded-lg px-2.5 py-1.5 text-[10.5px] font-bold"
                      style={{ background: codeMsg.ok ? '#E3E9C8' : '#FBEDE9', color: codeMsg.ok ? '#414D36' : '#C4482E' }}>{codeMsg.msg}</p>
                  )}
                  <button onClick={orderNow} disabled={!cart.size || !customer}
                    className="w-full rounded-xl py-3 text-[15px] font-black shadow-md shadow-[#8a6a48]/30 transition active:scale-[.98] disabled:opacity-40"
                    style={{ background: '#C9D3A8', color: '#26301C' }}>
                    {appliedCode ? 'اطلب الآن — مجاني 🎁' : 'اطلب الآن'}
                  </button>`;
s = s.replace(oldBtn, newBtn);

/* 6) شاشة النجاح: شارة مجاني */
const oldPts = `⭐ +{done.points} نقطة عند إكمال الطلب
            </p>`;
if (!s.includes(oldPts)) fail('points badge');
const newPts = `⭐ +{done.points} نقطة عند إكمال الطلب
            </p>
            {done.free && (
              <p className="mt-1.5 inline-block rounded-full px-4 py-1.5 text-[13px] font-black" style={{ background: '#C9D3A8', color: '#26301C' }}>
                🎁 طلب مجاني برمز الخصم
              </p>
            )}`;
s = s.replace(oldPts, newPts);

writeFileSync(f, s);
console.log('kiosk reward code added (v2)');
