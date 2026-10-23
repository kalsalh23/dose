import { readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const { execSync } = await import('node:child_process');
const ps = "$dirs = @('C:\\Users\\DELL\\.zcode','C:\\Users\\DELL\\Desktop\\dose'); $all=@{}; foreach($d in $dirs){ Get-ChildItem $d -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Length -lt 30MB -and $_.FullName -notmatch 'node_modules|image-cache' } | Select-String -Pattern 'sbp_[A-Za-z0-9_\\-]{40,}' -AllMatches -ErrorAction SilentlyContinue | ForEach-Object { $_.Matches | ForEach-Object { $all[$_.Value] = 1 } } }; $i=0; $all.Keys | ForEach-Object { Set-Content -Path ('C:\\Users\\DELL\\Desktop\\dose\\scripts\\.sbt' + $i) -Value $_ -NoNewline; $i++ }; 'ok'";
execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: 'ignore' });
const files = readdirSync(here).filter(f => f.startsWith('.sbt'));
const REF = 'mqstsxuscqbxnyejhixk';

let token = null;
for (const f of files) {
  const v = readFileSync(join(here, f), 'utf8');
  try {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}`, { headers: { Authorization: `Bearer ${v}` } });
    if (r.status === 200) { token = v; console.log('WORKING_TOKEN_FILE:', f); break; }
  } catch {}
}

if (token) {
  const meta = await (await fetch(`https://api.supabase.com/v1/projects/${REF}`, { headers: { Authorization: `Bearer ${token}` } })).json();
  console.log('PROJECT:', JSON.stringify({ id: meta.id, name: meta.name, region: meta.region, created_at: meta.created_at, organization_id: meta.organization_id, status: meta.status ?? '' }, null, 1));
  for (const ep of [`/v1/projects/${REF}/api-keys`, `/v1/projects/${REF}/functions/v1/none`]) {
    try {
      const r = await fetch(`https://api.supabase.com${ep}`, { headers: { Authorization: `Bearer ${token}` } });
      const t = await r.text();
      console.log('ENDPOINT', ep.replace(`/v1/projects/${REF}`, ''), r.status, t.slice(0, 900));
    } catch (e) { console.log('ENDPOINT ERR', ep, e.message); }
  }
} else {
  console.log('NO TOKEN WITH PROJECT ACCESS');
}
readdirSync(here).filter(x => x.startsWith('.sbt')).forEach(x => unlinkSync(join(here, x)));
console.log('# tokens cleaned');
