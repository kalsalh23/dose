import { readFileSync, writeFileSync } from 'node:fs';

// تحديث العناوين إلى Dose Cafe
let h = readFileSync('index.html', 'utf8');
h = h.split('<title>Dose Coffee & More</title>').join('<title>Dose Cafe</title>');
h = h.split('Dose Coffee & More — اطلب، اجمع النقاط').join('Dose Cafe — اطلب، اجمع النقاط');
writeFileSync('index.html', h);

let m = readFileSync('public/manifest.webmanifest', 'utf8');
m = m.split('"name": "Dose Coffee & More"').join('"name": "Dose Cafe"');
m = m.split('"short_name": "Dose"').join('"short_name": "Dose Cafe"');
writeFileSync('public/manifest.webmanifest', m);

console.log('titles updated:', readFileSync('index.html', 'utf8').includes('<title>Dose Cafe</title>'));