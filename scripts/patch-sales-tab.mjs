import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/admin/AdminApp.tsx';
let t = readFileSync(f, 'utf8');

// Detect line ending
const hasCRLF = t.includes('\r\n');
const NL = hasCRLF ? '\r\n' : '\n';
console.log('Line endings:', hasCRLF ? 'CRLF' : 'LF');

// 1) Change grid from 4 to 5 columns
t = t.replace('md:grid-cols-4', 'md:grid-cols-5');

// 2) Add kiosk card after the orders count card
const ordersCardEnd = `خلال {num(data.totals?.days)} يوم</p>${NL}            </div>${NL}            <div className="rounded-3xl bg-gradient-to-bl from-[#7A5A22]`;
const kioskCard = `خلال {num(data.totals?.days)} يوم</p>${NL}            </div>${NL}            <div className="rounded-3xl bg-gradient-to-bl from-[#C9A96A] to-[#A08448] p-5 text-white shadow-lg shadow-[#26301C]/25">${NL}              <p className="text-[11px] font-black text-[#F6E7C9]">من الكشك</p>${NL}              <p className="mt-2 text-3xl font-black tracking-tight">{num(data.totals?.kiosk)}</p>${NL}              <p className="mt-1 text-[11px] font-bold text-white/80">طلب من الكشك</p>${NL}            </div>${NL}            <div className="rounded-3xl bg-gradient-to-bl from-[#7A5A22]`;
t = t.replace(ordersCardEnd, kioskCard);

// 3) Add kiosk orders list before the footer note
const footerNote = `          <p className="rounded-xl bg-[#EEF2DC] px-3 py-2 text-[10.5px] font-bold leading-relaxed text-[#77825E]">`;
const kioskList = `          {/* طلبات الكشك — مميزة بلون مختلف */}${NL}          <Card className="p-5">${NL}            <div className="mb-3 flex items-center justify-between">${NL}              <p className="text-xs font-extrabold text-coffee-900">قائمة_pediatrics_pediatrics (الكشك = لون مختلف)</p>${NL}              <span className="rounded-full bg-[#C9A96A] px-2 py-0.5 text-[9px] font-black text-white">الكشك</span>${NL}            </div>${NL}            <div className="overflow-x-auto">${NL}              <table className="w-full text-right text-xs">${NL}                <thead>${NL}                  <tr className="border-b border-beige text-[10px] font-black text-neutral-400">${NL}                    <th className="pb-2">رقم_pediatrics_pediatrics</th>${NL}                    <th className="pb-2">العميل</th>${NL}                    <th className="pb-2 text-center">الإجمالي</th>${NL}                    <th className="pb-2 text-center">الحالة</th>${NL}                    <th className="pb-2">الوقت</th>${NL}                  </tr>${NL}                </thead>${NL}                <tbody>${NL}                  {(data.orders ?? []).filter((o: any) => o.source === 'kiosk').map((o: any) => (${NL}                    <tr key={o.id} className="border-b border-dashed border-beige bg-[#FFF9EC]">${NL}                      <td className="py-2 font-mono font-black text-coffee-900" dir="ltr">#{o.order_number}</td>${NL}                      <td className="py-2">{o.customer_name || '—'}</td>${NL}                      <td className="py-2 text-center font-black text-gold-deep">{o.total_cents} ل.س</td>${NL}                      <td className="py-2 text-center">${NL}                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${o.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : o.status === 'completed' ? 'bg-neutral-100 text-neutral-500' : 'bg-red-50 text-red-500'}`}>${NL}                          {o.status === 'ready' ? 'جاهز' : o.status === 'completed' ? 'مكتمل' : o.status}${NL}                        </span>${NL}                      </td>${NL}                      <td className="py-2 text-[10px] font-bold text-neutral-400">{fmtDateTimeNum(o.created_at)}</td>${NL}                    </tr>${NL}                  ))}${NL}                  {(data.orders ?? []).filter((o: any) => o.source === 'kiosk').length === 0 && (${NL}                    <tr><td colSpan={5} className="py-6 text-center text-xs font-bold text-neutral-400">لا توجد طلبات من الكشك في هذه الفترة</td></tr>${NL}                  )}${NL}                </tbody>${NL}              </table>${NL}            </div>${NL}          </Card>${NL}${NL}          <p className="rounded-xl bg-[#EEF2DC] px-3 py-2 text-[10.5px] font-bold leading-relaxed text-[#77825E]">`;
t = t.replace(footerNote, kioskList);

writeFileSync(f, t);
console.log('Sales tab updated');