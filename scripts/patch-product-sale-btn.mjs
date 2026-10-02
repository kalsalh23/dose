import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/admin/AdminApp.tsx';
let t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// 1) حالة محرر العرض
const stOld = `function ProductsTab({ token }: { token: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);`;
if (!t.includes(stOld)) { console.error('STATE ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(stOld, `function ProductsTab({ token }: { token: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const [offerId, setOfferId] = useState<number | null>(null);
  const [offerVal, setOfferVal] = useState('');`);

// 2) سعر البطاقة: عرض نشط = سعر جديد مشطوب القديم + شارة
const priceOld = `              <p className="mt-1 text-xs font-extrabold text-gold-deep">{eur(p.price_cents, 'ل.س')} · ⭐ {p.points}</p>`;
if (!t.includes(priceOld)) { console.error('PRICE ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(priceOld, `              <p className="mt-1 text-xs font-extrabold text-gold-deep">
                {p.sale_price_cents != null ? (
                  <>
                    <span className="me-1 rounded-full bg-[#C4482E] px-2 py-0.5 text-[9px] font-black text-white">عرض</span>
                    {eur(p.sale_price_cents, 'ل.س')} <span className="font-bold text-neutral-400 line-through">{eur(p.price_cents, 'ل.س')}</span>
                  </>
                ) : eur(p.price_cents, 'ل.س')}
                {' '}· ⭐ {p.points}
              </p>`);

// 3) زر عرض في صف الأزرار
const btnOld = `                <button disabled={busy} onClick={() => wrap(async () => { await arpc('admin_set_product_availability', { p_token: token, p_product_id: p.id, p_available: p.is_available === false }); load(); })}
                  className={\`rounded-lg px-3 py-1.5 text-[11px] font-extrabold \${p.is_available === false ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}\`}>
                  {p.is_available === false ? 'غير متوفر' : 'متوفر'}
                </button>`;
if (!t.includes(btnOld)) { console.error('AVAIL ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(btnOld, btnOld + `
                <button disabled={busy} onClick={() => { setOfferId(offerId === p.id ? null : p.id); setOfferVal(p.sale_price_cents != null ? String(p.sale_price_cents) : ''); }}
                  className={\`rounded-lg px-3 py-1.5 text-[11px] font-extrabold \${p.sale_price_cents != null ? 'bg-[#C4482E] text-white' : 'bg-[#F1DCB0] text-[#7A5A22]'}\`}>
                  عرض
                </button>`);

// 4) محرر السعر الجديد — يظهر تحت صف الأزرار عند تفعيل العرض
const closeOld = `              </div>
            </div>
          </Card>
        ))}
      </div>

      {edit && (`;
if (!t.includes(closeOld)) { console.error('CARD CLOSE ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(closeOld, `              </div>
              {offerId === p.id && (
                <div className="mt-2 rounded-xl bg-[#FFF9EC] p-3 ring-1 ring-[#EAD3A0]">
                  <p className="text-[10px] font-black text-[#7A5A22]">السعر الجديد (ل.س) — القديم يُمشَّط ويظهر شارة «عرض» للزبون</p>
                  <div className="mt-2 flex gap-2">
                    <input type="number" className={inputCls} value={offerVal} onChange={(e) => setOfferVal(e.target.value)} placeholder="مثال: 12000" />
                    <button disabled={busy || !offerVal} onClick={() => wrap(async () => { await arpc('admin_set_product_sale', { p_token: token, p_product_id: p.id, p_sale_cents: Number(offerVal) }); setOfferId(null); load(); })}
                      className="flex-none rounded-lg bg-[#414D36] px-3 py-1.5 text-[11px] font-extrabold text-[#C9D3A8]">حفظ</button>
                    {p.sale_price_cents != null && (
                      <button disabled={busy} onClick={() => wrap(async () => { await arpc('admin_set_product_sale', { p_token: token, p_product_id: p.id, p_sale_cents: null }); setOfferId(null); load(); })}
                        className="flex-none rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-extrabold text-red-600">إزالة العرض</button>
                    )}
                    <button onClick={() => setOfferId(null)} className="flex-none rounded-lg bg-neutral-100 px-3 py-1.5 text-[11px] font-extrabold text-neutral-600">إلغاء</button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {edit && (`);

writeFileSync(f, t);
console.log('product offer button + editor added');
