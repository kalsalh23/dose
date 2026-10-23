import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const i = s.indexOf('FeaturedCategories catalog={catalog} cat={cat} setCat={(c)');
console.log(JSON.stringify(s.slice(i + 80, i + 480)));
