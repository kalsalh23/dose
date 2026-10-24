const fs = require('fs');
const f = 'src/admin/AdminApp.tsx';
let t = fs.readFileSync(f, 'utf8');

// 1) Change grid from 4 to 5 columns and add kiosk card
const gridOld = `<div className="grid gap-3 md:grid-cols-4">`;
const gridNew = `<div className="grid gap-3 md:grid-cols-5">`;
t = t.replace(gridOld, gridNew);

// 2) Add kiosk card after the orders count card
const ordersCardEnd = `خلال {num(data.totals?.days)} يوم</p>
            </div>
            <div className="rounded-3xl bg-gradient-to-bl from-[#7A5A22]`;
const kioskCard = `خلال {num(data.totals?.days)} يوم</p>
            </div>
            <div className="rounded-3xl bg-gradient-to-bl from-[#C9A96A] to-[#A08448] p-5 text-white shadow-lg shadow-[#26301C]/25">
              <p className="text-[11px] font-black text-[#F6E7C9]">من الكشك</p>
              <p className="mt-2 text-3xl font-black tracking-tight">{num(data.totals?.kiosk)}</p>
              <p className="mt-1 text-[11px] font-bold text-white/80">طلب من الكشك</p>
            </div>
            <div className="rounded-3xl bg-gradient-to-bl from-[#7A5A22]`;
t = t.replace(ordersCardEnd, kioskCard);

// 3) Add kiosk orders list before the footer note
const footerNote = `          <p className="rounded-xl bg-[#EEF2DC] px-3 py-2 text-[10.5px] font-bold leading-relaxed text-[#77825E]">`;
const kioskList = `          {/* طلبات الكشك — مميزة بلون مختلف */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-extrabold text-coffee-900">قائمة_pediatrics_pediatrics (الكشك = لون مختلف)</p>
              <span className="rounded-full bg-[#C9A96A] px-2 py-0.5 text-[9px] font-black text-white">الكشك</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-beige text-[10px] font-black text-neutral-400">
                    <th className="pb-2">رقم_pediatrics_pediatrics</th>
                    <th className="pb-2">العميل</th>
                    <th className="pb-2 text-center">الإجمالي</th>
                    <th className="pb-2 text-center">الحالة</th>
                    <th className="pb-2">الوقت</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.orders ?? []).filter((o: any) => o.source === 'kiosk').map((o: any) => (
                    <tr key={o.id} className="border-b border-dashed border-beige bg-[#FFF9EC]">
                      <td className="py-2 font-mono font-black text-coffee-900" dir="ltr">#{o.order_number}</td>
                      <td className="py-2">{o.customer_name || '—'}</td>
                      <td className="py-2 text-center font-black text-gold-deep">{o.total_cents} ل.س</td>
                      <td className="py-2 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${o.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : o.status === 'completed' ? 'bg-neutral-100 text-neutral-500' : 'bg-red-50 text-red-500'}`}>
                          {o.status === 'ready' ? 'جاهز' : o.status === 'completed' ? 'مكتمل' : o.status}
                        </span>
                      </td>
                      <td className="py-2 text-[10px] font-bold text-neutral-400">{fmtDateTimeNum(o.created_at)}</td>
                    </tr>
                  ))}
                  {(data.orders ?? []).filter((o: any) => o.source === 'kiosk').length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-xs font-bold text-neutral-400">لا توجد طلبات من الكشك في هذه الفترة</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="rounded-xl bg-[#EEF2DC] px-3 py-2 text-[10.5px] font-bold leading-relaxed text-[#77825E]">`;
t = t.replace(footerNote, kioskList);

fs.writeFileSync(f, t);
console.log('Sales tab updated');