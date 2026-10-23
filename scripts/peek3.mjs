import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const show = (label, needle, len = 500) => {
  const i = s.indexOf(needle);
  console.log('=== ' + label + ' ===');
  console.log(i < 0 ? 'NOT FOUND' : JSON.stringify(s.slice(i, i + len)));
};
show('OrderFlow', 'interface OrderFlow', 260);
show('submitPin', 'const submitPin', 900);
show('success state', 'const [success', 200);
show('OrderSuccessModal def', 'function OrderSuccessModal', 120);
show('render success', "{success && <OrderSuccessModal", 200);
show('pin render', "{flow.step === 'pin'", 320);
