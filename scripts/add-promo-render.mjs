import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const old = `      </section>

      {/* الأكثر طلبًا — بطاقات أفقية */}`;
if (!s.includes(old)) { console.error('anchor missing'); process.exit(1); }
s = s.replace(old, `      </section>

      {!searching && <PromoBanner settings={catalog?.settings ?? {}} />}

      {/* الأكثر طلبًا — بطاقات أفقية */}`);
writeFileSync(f, s);
console.log('promo banner render added');
