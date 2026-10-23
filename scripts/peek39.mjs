import { readFileSync } from 'node:fs';
const s = readFileSync('scripts/ad-display-modes.sql', 'utf8');
const lines = s.split('\n');
for (let i = 44; i < 56; i++) console.log((i + 1) + ': ' + lines[i]);
