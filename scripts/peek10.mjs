import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
console.log('part1:', s.includes('<PopularStrip title="الأكثر مبيعًا" emoji="🔥" items={catalog?.best_sellers ?? []} cur={cur} openProduct={openProduct} />'));
console.log('part2:', s.includes('<PopularStrip title="الأكثر طلبًا" emoji="⭐" items={catalog?.most_ordered ?? []} cur={cur} openProduct={openProduct} />'));
console.log('part3:', s.includes('<FeaturedCategories catalog={catalog} cat={cat} setCat={(c) => { setCat(c); setQ(\'\'); }} />'));
// ابحث عن كل شارة يحتمل اختلاف الترميز
const i = s.indexOf('<PopularStrip title');
console.log('first strip literal:', JSON.stringify(s.slice(i, i + 130)));
