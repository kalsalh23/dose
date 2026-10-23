// بطاقة المراجعة: المبلغ + زرا التأكيد والإلغاء فقط — بدون أي نص آخر
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

const oldReview = `        {phase === 'review' ? (
          <>
            <h3 className="text-center text-lg font-black text-[#26301C]">مراجعة طلبك</h3>
            <p className="mt-1 text-center text-xs text-neutral-500">راجع طلبك ثم أكّد الإرسال عبر WhatsApp</p>
            <div className="mt-4 max-h-52 space-y-1.5 overflow-y-auto rounded-[1.4rem] bg-[#EEF2DC] p-4">
              {lines.map((l, i) => (
                <p key={i} className="text-xs text-[#4A3A28]">
                  • {l.product.name_ar} × {l.qty} — {eur(l.product.price_cents * l.qty, cur)}
                  {(l.options || []).length > 0 && <span className="text-[#7C8665]"> ({l.options.join('، ')})</span>}
                </p>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#E3E9C8] px-4 py-3">
              <span className="text-sm font-black text-[#26301C]">الإجمالي</span>
              <span className="text-lg font-black text-[#26301C]">{free ? 'مجاني 🎁' : eur(total, cur)}</span>
            </div>
            <p className="mt-2 text-center text-[11px] font-bold text-[#7C8665]">ستكسب ⭐ {points} نقطة عند إكمال الطلب</p>
            <button onClick={onConfirm} disabled={busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3.5 text-base font-black text-white shadow-lg shadow-green-500/30 transition active:scale-[.98] disabled:opacity-50">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.7-4-4.8-4.2-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4.2.5.7 1.8.8 1.9.1.1.1.3 0 .5-.1.2-.1.3-.3.5l-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.5.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1l1.8.9c.3.1.5.2.5.3.1.1.1.7-.1 1.3Z"/></svg>
              {busy ? 'جارٍ التأكيد…' : 'تأكيد واتساب'}
            </button>
            <button onClick={onCancel} disabled={busy}
              className="mt-3 w-full rounded-full bg-red-50 py-3 text-sm font-black text-[#C4482E] transition active:scale-[.98] disabled:opacity-50">
              إلغاء الطلب
            </button>
            <p className="mt-2 text-center text-[10px] font-bold text-neutral-400">الإلغاء لا يُرسل الطلب إلى المحل إطلاقًا</p>
          </>
        ) : (`;

if (!s.includes(oldReview)) { console.error('review block not found'); process.exit(1); }

const newReview = `        {phase === 'review' ? (
          <>
            <div className="rounded-[1.6rem] bg-[#E3E9C8] px-5 py-4 text-center">
              <span className="text-sm font-black text-[#26301C]">المبلغ</span>
              <p className="mt-1 text-3xl font-black text-[#26301C]">{free ? 'مجاني 🎁' : eur(total, cur)}</p>
            </div>
            <button onClick={onConfirm} disabled={busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3.5 text-base font-black text-white shadow-lg shadow-green-500/30 transition active:scale-[.98] disabled:opacity-50">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.7-4-4.8-4.2-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4.2.5.7 1.8.8 1.9.1.1.1.3 0 .5-.1.2-.1.3-.3.5l-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.5.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1l1.8.9c.3.1.5.2.5.3.1.1.1.7-.1 1.3Z"/></svg>
              {busy ? 'جارٍ التأكيد…' : 'تأكيد واتساب'}
            </button>
            <button onClick={onCancel} disabled={busy}
              className="mt-3 w-full rounded-full bg-red-50 py-3 text-sm font-black text-[#C4482E] transition active:scale-[.98] disabled:opacity-50">
              إلغاء الطلب
            </button>
          </>
        ) : (`;
writeFileSync(f, s);
console.log('review card simplified: amount + 2 buttons only');
