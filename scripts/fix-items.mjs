import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const old = "  const mostOrdered = catalog?.most_ordered ?? [];\n  const menuItems = showAll ? shown : shown.slice(0, 4);";
if (!s.includes(old)) { console.error('anchor missing'); process.exit(1); }
s = s.replace(old, "  const mostOrdered = catalog?.most_ordered ?? [];\n  const items = [{ slug: 'all', name_ar: 'الكل' }, ...(catalog?.categories ?? [])];\n  const menuItems = showAll ? shown : shown.slice(0, 4);");
writeFileSync(f, s);
console.log('items added');
