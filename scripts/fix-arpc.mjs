// إصلاح الاستدعاء الذاتي داخل arpc
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/admin/AdminApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

const bad = `async function arpc<T = any>(fn: string, args: Record<string, any> = {}): Promise<T> {
  const d = await arpc<T>(fn, args);`;
const good = `async function arpc<T = any>(fn: string, args: Record<string, any> = {}): Promise<T> {
  const d = await rpc<T>(fn, args);`;
if (!s.includes(bad)) { console.error('recursive call not found'); process.exit(1); }
s = s.replace(bad, good);
writeFileSync(f, s);
console.log('arpc fixed — now calls rpc');
