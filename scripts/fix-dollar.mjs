import { readFileSync, writeFileSync } from 'node:fs';
const f = 'scripts/ad-display-modes.sql';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const lines = s.split('\n');
// سطر 51 (index 50): 'returns jsonb ... as $'
if (lines[50].trimEnd().endsWith('as $')) {
  lines[50] = lines[50].trimEnd().slice(0, -1) + '$$';
  console.log('fixed line 51');
} else console.log('line 51 already ok:', lines[50]);
writeFileSync(f, lines.join('\n'));
