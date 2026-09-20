import { useState } from 'react';

/** لوحة إدخال PIN (4 أرقام) — مشتركة بين الكشك وتطبيق العميل */
export default function PinPad({
  title, subtitle, loading, error, onFill, onClose,
}: {
  title: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  onFill: (pin: string) => void;
  onClose: () => void;
}) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  const push = (k: string) => {
    if (loading) return;
    if (k === 'back') setPin((p) => p.slice(0, -1));
    else if (k === 'clear') setPin('');
    else if (pin.length < 4) setPin((p) => (p + k).slice(0, 4));
  };

  const confirm = () => {
    if (pin.length === 4 && !loading) onFill(pin);
  };

  // عند تغيّر الخطأ: هز النافذة وتفريغ الإدخال
  useState;
  if (error && !shake) {
    setShake(true);
    setPin('');
    setTimeout(() => setShake(false), 450);
  }

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/50 backdrop-blur-sm p-4 anim-fade" onClick={onClose}>
      <div
        className={`relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl anim-pop ${shake ? 'anim-shake' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-3 left-3 grid size-9 place-items-center rounded-full bg-neutral-100 text-neutral-500 hover:text-neutral-800"
          onClick={onClose} aria-label="إغلاق"
        >✕</button>

        <h3 className="text-center text-lg font-extrabold text-coffee-900">{title}</h3>
        {subtitle && <p className="mt-1 text-center text-xs leading-relaxed text-neutral-500">{subtitle}</p>}

        <div className="my-4 flex justify-center gap-3" dir="ltr">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`grid size-13 place-items-center rounded-2xl border-2 transition-all ${
                pin.length === i ? 'border-fresh-500 bg-fresh-50 shadow-[0_0_0_3px_rgba(52,169,113,.18)]' : 'border-beige bg-[#FAF5EA]'
              }`}
              style={{ width: 52, height: 60 }}
            >
              <i className={`block size-3.5 rounded-full bg-gradient-to-br from-fresh-500 to-fresh-700 transition-all ${i < pin.length ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} />
            </span>
          ))}
        </div>

        <p className={`mb-2 h-5 text-center text-sm font-bold text-red-600 ${error ? '' : 'invisible'}`}>{error || '—'}</p>

        <div className="grid grid-cols-3 gap-2.5">
          {['1','2','3','4','5','6','7','8','9'].map((n) => (
            <button key={n} className="h-14 rounded-2xl border border-beige bg-white text-xl font-extrabold text-coffee-900 transition hover:border-fresh-300 hover:bg-fresh-50 active:scale-95"
              onClick={() => push(n)}>{n}</button>
          ))}
          <button className="grid h-14 place-items-center rounded-2xl border border-beige bg-white text-neutral-500 transition hover:bg-neutral-50 active:scale-95"
            onClick={() => push('back')} aria-label="حذف">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7 6-7Z"/><path d="m12.5 9.5 5 5m0-5-5 5"/></svg>
          </button>
          <button className="h-14 rounded-2xl border border-beige bg-white text-xl font-extrabold text-coffee-900 transition hover:border-fresh-300 hover:bg-fresh-50 active:scale-95"
            onClick={() => push('0')}>0</button>
          <button className="h-14 rounded-2xl border border-beige bg-white text-sm font-bold text-neutral-500 transition hover:bg-neutral-50 active:scale-95"
            onClick={() => push('clear')}>مسح</button>
        </div>

        <button
          className="mt-4 h-13 w-full rounded-2xl bg-gradient-to-l from-fresh-500 to-fresh-700 py-3.5 text-base font-extrabold text-white shadow-lg shadow-fresh-900/25 transition enabled:hover:brightness-105 enabled:active:scale-[.98] disabled:opacity-40"
          style={{ height: 52 }}
          disabled={pin.length !== 4 || loading}
          onClick={confirm}
        >
          {loading ? 'جارٍ التحقق…' : 'تأكيد'}
        </button>
      </div>
    </div>
  );
}
