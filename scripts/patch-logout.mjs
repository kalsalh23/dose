// إضافة تأكيد الخروج — مرساة مطابقة
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

const oldBtn = `        <button onClick={onLogout}
          className="flex w-full items-center justify-between rounded-[1.4rem] bg-[#E3E9C8] p-4 transition active:scale-[.98]">`;
if (!s.includes(oldBtn)) fail('logout button');
s = s.replace(oldBtn, `        <button onClick={() => setConfirmLogout(true)}
          className="flex w-full items-center justify-between rounded-[1.4rem] bg-[#E3E9C8] p-4 transition active:scale-[.98]">`);

const oldState = `  const [showCodes, setShowCodes] = useState(false);
  const c = myData?.customer ?? session.customer;`;
if (!s.includes(oldState)) fail('account state');
s = s.replace(oldState, `  const [showCodes, setShowCodes] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const c = myData?.customer ?? session.customer;`);

const oldEnd = `      {showCodes && <MyCodes redemptions={redemptions} />}
    </div>
  );
}

let _navRef`;
if (!s.includes(oldEnd)) fail('account end');
const newEnd = `      {showCodes && <MyCodes redemptions={redemptions} />}

      {confirmLogout && (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-black/50 p-4 backdrop-blur-sm anim-fade" onClick={() => setConfirmLogout(false)}>
          <div className="w-full max-w-xs rounded-[2rem] bg-white p-6 text-center shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#F1DCB0] text-[#8A6A48]"><Icon name="logout" size={24} /></span>
            <h3 className="mt-3 text-base font-black text-[#26301C]">تسجيل الخروج؟</h3>
            <p className="mt-1 text-xs text-neutral-500">سيتم الخروج من حسابك على هذا الجهاز</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => { setConfirmLogout(false); onLogout(); }}
                className="rounded-full bg-[#C4482E] py-3 text-sm font-black text-white shadow-md active:scale-95">تأكيد</button>
              <button onClick={() => setConfirmLogout(false)}
                className="rounded-full bg-neutral-100 py-3 text-sm font-black text-neutral-600 active:scale-95">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

let _navRef`;
s = s.replace(oldEnd, newEnd);

writeFileSync(f, s);
console.log('logout confirmation added');
