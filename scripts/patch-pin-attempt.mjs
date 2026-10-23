// ربط عدّاد محاولات PIN في تطبيق العميل والكشك
import { readFileSync, writeFileSync } from 'node:fs';

/* --- تطبيق العميل --- */
const cf = 'src/customer/CustomerApp.tsx';
let c = readFileSync(cf, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

if (!c.includes('pinAttempt')) {
  const oldState = "  const [pinErr, setPinErr] = useState('');";
  if (!c.includes(oldState)) fail('customer pinErr');
  c = c.replace(oldState, oldState + "\n  const [pinAttempt, setPinAttempt] = useState(0);");

  // زيادة العداد عند فشل التحقق (مرحلة review لا تُنشئ طلبًا، فالخطأ هنا من verify)
  const oldCatch = `    } catch (e: any) {
      setPinErr(e.message);
    } finally { setPinBusy(false); }
  };`;
  if (!c.includes(oldCatch)) fail('customer catch');
  c = c.replace(oldCatch, `    } catch (e: any) {
      setPinErr(e.message);
      setPinAttempt((a) => a + 1);
    } finally { setPinBusy(false); }
  };`);

  // تمرير attemptKey لـ PinPad
  const oldPinPad = `<PinPad title="تأكيد هويتك" subtitle="أدخل رمز PIN المكوّن من 4 أرقام لتأكيد طلبك"
          loading={pinBusy} error={pinErr} onFill={submitPin}`;
  if (!c.includes(oldPinPad)) fail('customer PinPad');
  c = c.replace(oldPinPad, `<PinPad title="تأكيد هويتك" subtitle="أدخل رمز PIN المكوّن من 4 أرقام لتأكيد طلبك"
          loading={pinBusy} error={pinErr} attemptKey={pinAttempt} onFill={submitPin}`);

  // مسح الخطأ عند فتح شاشة PIN
  const oldOpen = "          onClose={() => { setFlow({ step: null, lines: [] }); setPinErr(''); }} />";
  if (c.includes(oldOpen)) {
    c = c.replace(oldOpen, "          onClose={() => { setFlow({ step: null, lines: [] }); setPinErr(''); setPinAttempt(0); }} />");
  }
  writeFileSync(cf, c);
  console.log('customer: attempt counter wired');
}

/* --- الكشك --- */
const kf = 'src/kiosk/KioskApp.tsx';
let k = readFileSync(kf, 'utf8').replace(/\r\n/g, '\n');
if (!k.includes('pinAttempt')) {
  const oldState = "  const [pinErr, setPinErr] = useState('');";
  if (!k.includes(oldState)) fail('kiosk pinErr');
  k = k.replace(oldState, oldState + "\n  const [pinAttempt, setPinAttempt] = useState(0);");

  const oldCatch = `    } catch (e: any) {
      setPinErr(e.message);
    } finally { setPinBusy(false); }
  };`;
  if (!k.includes(oldCatch)) fail('kiosk catch');
  k = k.replace(oldCatch, `    } catch (e: any) {
      setPinErr(e.message);
      setPinAttempt((a) => a + 1);
    } finally { setPinBusy(false); }
  };`);

  const oldPinPad = `<PinPad
          title="تأكيد هويتك"`;
  if (!k.includes(oldPinPad)) fail('kiosk PinPad');
  k = k.replace(oldPinPad, `<PinPad
          attemptKey={pinAttempt}
          title="تأكيد هويتك"`);

  writeFileSync(kf, k);
  console.log('kiosk: attempt counter wired');
}
