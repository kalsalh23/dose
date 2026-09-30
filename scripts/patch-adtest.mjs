import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/customer/CustomerApp.tsx';
let t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const old = `  const [midAdDue, setMidAdDue] = useState(false);
  /* الإعلان الوسطي: بعد دقيقتين من بدء التصفح */
  useEffect(() => {
    if (!welcomeDone) return;
    const t = setTimeout(() => setMidAdDue(true), 120000);
    return () => clearTimeout(t);
  }, [welcomeDone]);`;
const nw = `  const [midAdDue, setMidAdDue] = useState(false);
  /* الإعلان الوسطي: بعد دقيقتين من بدء التصفح (?adtest=1 يجعله بعد 8 ثوانٍ للاختبار) */
  useEffect(() => {
    if (!welcomeDone) return;
    const delay = new URLSearchParams(location.search).has('adtest') ? 8000 : 120000;
    const t = setTimeout(() => setMidAdDue(true), delay);
    return () => clearTimeout(t);
  }, [welcomeDone]);`;
if (!t.includes(old)) { console.error('ANCHOR NOT FOUND'); process.exit(1); }
writeFileSync(f, t.replace(old, nw));
console.log('adtest hook added');
