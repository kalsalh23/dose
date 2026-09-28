// اصطياد أخطاء التشغيل — تثبيت المصائد ثم قراءتها
import { readFileSync } from 'node:fs';

const install = `sessionStorage.setItem('dose_errs','[]');
window.addEventListener('error',function(e){var a=JSON.parse(sessionStorage.getItem('dose_errs')||'[]');a.push('ERR '+(e.message||'resource')+' '+(e.filename||'').split('/').pop()+':'+(e.lineno||''));sessionStorage.setItem('dose_errs',JSON.stringify(a));},true);
window.addEventListener('unhandledrejection',function(e){var a=JSON.parse(sessionStorage.getItem('dose_errs')||'[]');a.push('REJ '+(e.reason&&e.reason.message?e.reason.message:String(e.reason)));sessionStorage.setItem('dose_errs',JSON.stringify(a));});
'setup-ok';`;

const f = 'src/customer/CustomerApp.tsx';
readFileSync(f, 'utf8'); // noop

const fix = {
  browser: null,
  async run(browser, list, mode) {
    const tab = await browser.tabs.get(list[list.length - 1].id);
    if (mode === 'install') {
      const r = await tab.playwright.evaluate(install);
      return r;
    }
    return null;
  },
};

module.exports = {};
