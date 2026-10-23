import { readFileSync } from 'node:fs';
const t = readFileSync('src/kiosk/KioskApp.tsx', 'utf8');
// خطوة PIN + تسجيل
const pinIdx = t.indexOf("setStep('pin')");
console.log('--- pin flow ---');
console.log(t.slice(t.indexOf("const [step"), t.indexOf("const [step") + 200));
const sp = t.indexOf("'signup'");
console.log('--- signup view anchor ---');
const i = t.indexOf("view === 'signup'");
console.log(i < 0 ? 'NO view===signup' : t.slice(i - 200, i + 200));
const j = t.indexOf('SignupView');
console.log('--- SignupView fn ---');
const k = t.indexOf('function SignupView');
if (k > 0) console.log(t.slice(k, k + 2400));
