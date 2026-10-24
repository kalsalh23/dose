import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/admin/AdminApp.tsx';
let t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// 1) Show expires_at column in redemptions table
const thOld = `            <th className="p-3 font-extrabold">الحالة</th><th className="p-3"></th>`;
const thNew = `            <th className="p-3 font-extrabold">الحالة</th><th className="p-3 font-extrabold">صالح حتى</th><th className="p-3"></th>`;
if (t.includes(thOld)) t = t.replace(thOld, thNew);

// 2) Add expires_at cell before the action cell
const tdOld = `                  {r.status === 'unused' && (
                    <button disabled={busy} onClick={() => wrap(async () => { await arpc('admin_set_redemption_status', { p_token: token, p_code: r.code, p_status: 'used' }); load(); })}
                      className="rounded-lg bg-[#E3E9C8] px-3 py-1.5 text-[10px] font-extrabold text-neutral-700"> التعليم كمستخدم</button>
                  )}`;
const tdNew = `                  {r.expires_at && <td className="p-3 text-[10px] font-bold text-amber-700" dir="ltr">{new Date(r.expires_at).toLocaleDateString('ar-EG')}</td>}
                  {r.status === 'unused' && (
                    <button disabled={busy} onClick={() => wrap(async () => { await arpc('admin_set_redemption_status', { p_token: token, p_code: r.code, p_status: 'used' }); load(); })}
                      className="rounded-lg bg-[#E3E9C8] px-3 py-1.5 text-[10px] font-extrabold text-neutral-700"> defective كمستخدم</button>
                  )}`;
if (t.includes(tdOld)) t = t.replace(tdOld, tdNew);

writeFileSync(f, t);
console.log('redemptions table updated');