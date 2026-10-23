// معالجة انتهاء جلسة الإدارة: null من أي RPC → خروج تلقائي لشاشة الدخول
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/admin/AdminApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// 1) تعريف arpc بعد ثابت المفتاح
const anchor = "const ADMIN_KEY = 'dose_admin_token_v1';";
if (!s.includes(anchor)) { console.error('anchor missing'); process.exit(1); }
s = s.replace(anchor, anchor + `

/** استدعاء RPC إداري — إن انتهت الجلسة (null) خروج تلقائي لشاشة الدخول */
async function arpc<T = any>(fn: string, args: Record<string, any> = {}): Promise<T> {
  const d = await rpc<T>(fn, args);
  if (d === null) {
    localStorage.removeItem(ADMIN_KEY);
    setTimeout(() => location.reload(), 600);
    throw new Error('انتهت صلاحية الجلسة — سجّل الدخول من جديد');
  }
  return d;
}`);

// 2) تحويل كل استدعاءات rpc داخل AdminApp إلى arpc
let n = 0;
s = s.replace(/(?<![\w.])rpc(?=\(|<)/g, (m, off, str) => {
  // لا نلمس التعريف أو الاستيراد
  const before = str.slice(Math.max(0, off - 30), off);
  if (before.includes('async function a') || before.includes('import ')) return m;
  n++;
  return 'arpc';
});

writeFileSync(f, s);
console.log('arpc calls:', n);
