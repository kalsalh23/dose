import { readFileSync } from 'node:fs';
const s = readFileSync('src/kiosk/KioskApp.tsx', 'utf8');
const i = s.indexOf('const searchTimer');
console.log(JSON.stringify(s.slice(i - 40, i + 120)));
