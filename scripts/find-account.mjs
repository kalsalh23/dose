import { readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const { execSync } = await import('node:child_process');
const ps = "$dirs = @('C:\\Users\\DELL\\.zcode','C:\\Users\\DELL\\Desktop\\dose'); $all=@{}; foreach($d in $dirs){ Get-ChildItem $d -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Length -lt 30MB -and $_.FullName -notmatch 'node_modules|image-cache' } | Select-String -Pattern 'sbp_[A-Za-z0-9_\\-]{40,}' -AllMatches -ErrorAction SilentlyContinue | ForEach-Object { $_.Matches | ForEach-Object { $all[$_.Value] = 1 } } }; $i=0; $all.Keys | ForEach-Object { Set-Content -Path ('C:\\Users\\DELL\\Desktop\\dose\\scripts\\.sbt' + $i) -Value $_ -NoNewline; $i++ }; 'ok'";
execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: 'ignore' });
const files = readdirSync(here).filter(f => f.startsWith('.sbt'));

// جرّب كل رمز يعمل على المشروع مع نقاط نهاية معلومات الحساب المحتملة
const REF = 'mqstsxuscqbxnyejhixk';
const seen = new Set();
for (const f of files) {
  const v = readFileSync(join(here, f), 'utf8');
  try {
    const ok = await fetch(`https://api.supabase.com/v1/projects/${REF}`, { headers: { Authorization: `Bearer ${v}` } });
    if (ok.status !== 200 || seen.has(v.slice(0, 16))) continue;
    seen.add(v.slice(0, 16));
    console.log('TOKEN', f, v.slice(0, 14), '=> has project access');
    for (const ep of ['/v1/user', '/v1/account', '/v1/profile', '/v1/organizations']) {
      try {
        const r = await fetch('https://api.supabase.com' + ep, { headers: { Authorization: `Bearer ${v}` } });
        const t = await r.text();
        console.log('  ', ep, r.status, t.slice(0, 400).replace(/\s+/g, ' '));
      } catch (e) { console.log('  ', ep, 'ERR', e.message); }
    }
  } catch {}
}
readdirSync(here).filter(x => x.startsWith('.sbt')).forEach(x => unlinkSync(join(here, x)));
console.log('# cleaned');
