import { readFileSync } from 'node:fs';
const s = readFileSync('supabase/functions/push/index.ts', 'utf8');
const i = s.indexOf('Deno.serve');
console.log(JSON.stringify(s.slice(i, i + 600)));
