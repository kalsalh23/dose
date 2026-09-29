import { readFileSync } from 'node:fs';
const s = readFileSync('src/kiosk/KioskApp.tsx', 'utf8');
const i = s.indexOf('whatsapp_number');
console.log(JSON.stringify(s.slice(i - 60, i + 80)));
