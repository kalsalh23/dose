import { readFileSync } from 'node:fs';
const s = readFileSync('src/kiosk/KioskApp.tsx', 'utf8');
const i = s.indexOf('orderNow} disabled');
console.log(JSON.stringify(s.slice(i, i + 320)));
