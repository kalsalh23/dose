import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fail = (m) => { console.error('MISSING:', m); process.exit(1); };

/* 1) searching + menuItems بلا حد أثناء البحث */
const oldMenu = "  const menuItems = showAll ? shown : shown.slice(0, 4);";
if (!s.includes(oldMenu)) fail('menuItems');
s = s.replace(oldMenu, "  const searching = q.trim() !== '';\n  const menuItems = searching || showAll ? shown : shown.slice(0, 4);");

/* 2) إخفاء الأكثر طلبًا أثناء البحث */
const oldMO = "      {/* الأكثر طلبًا — بطاقات أفقية */}\n      {mostOrdered.length > 0 && (";
if (!s.includes(oldMO)) fail('most ordered');
s = s.replace(oldMO, "      {!searching && (\n      {/* الأكثر طلبًا — بطاقات أفقية */}\n      {mostOrdered.length > 0 && (");
const closeMO = `        </section>
      )}

      {/* استكشف المنيو */}`;
if (!s.includes(closeMO)) fail('most ordered close');
s = s.replace(closeMO, `        </section>
      )}

      )}

      {/* استكشف المنيو */}`);

/* 3) زر عرض الكل يختفي أثناء البحث */
const oldShowAllBtn = "          {shown.length > 4 && (";
if (!s.includes(oldShowAllBtn)) fail('show all button');
s = s.replace(oldShowAllBtn, "          {!searching && shown.length > 4 && (");

/* 4) بطاقة كود الخصم بعد الفئات — تختفي أثناء البحث */
const anchorCirclesEnd = `      </section>

      {/* الأكثر طلبًا — بطاقات أفقية */}`;
if (!s.includes(anchorCirclesEnd)) fail('circles end');
s = s.replace(anchorCirclesEnd, `      </section>

      {!searching && <PromoBanner settings={catalog?.settings ?? {}} />}

      {/* الأكثر طلبًا — بطاقات أفقية */}`);

writeFileSync(f, s);
console.log('all search fixes applied');
