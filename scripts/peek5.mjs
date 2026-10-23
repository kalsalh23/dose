import { readFileSync } from 'node:fs';
const s = readFileSync('src/customer/CustomerApp.tsx', 'utf8');
const i = s.indexOf('function Home');
const j = s.indexOf('FeaturedCategories catalog', i);
console.log(JSON.stringify(s.slice(j - 150, j + 100)));
