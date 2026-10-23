import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

const old = `const CAT_IMAGES: Record<string, string> = {
  hot: '/img/cappuccino.jpg',
  cold: '/img/iced-latte.jpg',
  dessert: '/img/chocolate-cake.jpg',
  extras: '/img/caramel-macchiato.jpg',
};`;
if (!s.includes(old)) { console.error('CAT_IMAGES not found'); process.exit(1); }
const nw = `const CAT_IMAGES: Record<string, string> = {
  hot_drinks: '/img/cappuccino.jpg',
  cold_drinks: '/img/iced-latte.jpg',
  matcha_tea: '/img/matcha.jpg',
  fresh: '/img/juice.jpg',
  mojito: '/img/mojito.jpg',
  dessert: '/img/chocolate-cake.jpg',
};`;
s = s.replace(old, nw);
writeFileSync(f, s);
console.log('CAT_IMAGES updated for new slugs');
