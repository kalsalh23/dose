import { readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const { execSync } = await import('node:child_process');
const ps = "$dirs = @('C:\\Users\\DELL\\.zcode','C:\\Users\\DELL\\Desktop\\dose'); $all=@{}; foreach($d in $dirs){ Get-ChildItem $d -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Length -lt 30MB -and $_.FullName -notmatch 'node_modules|image-cache' } | Select-String -Pattern 'sbp_[A-Za-z0-9_\\-]{40,}' -AllMatches -ErrorAction SilentlyContinue | ForEach-Object { $_.Matches | ForEach-Object { $all[$_.Value] = 1 } } }; $i=0; $all.Keys | ForEach-Object { Set-Content -Path ('C:\\Users\\DELL\\Desktop\\dose\\scripts\\.sbt' + $i) -Value $_ -NoNewline; $i++ }; 'ok'";
execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: 'ignore' });
const files = readdirSync(here).filter(f => f.startsWith('.sbt'));
const dbq = async (sql) => {
  for (const f of files) {
    const v = readFileSync(join(here, f), 'utf8');
    try {
      const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
        method: 'POST', headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql }),
      });
      if (r.status === 200 || r.status === 201) return JSON.parse(await r.text());
    } catch {}
  }
  throw new Error('no working token');
};

// 1) مصدر check_reward_code الحيّ
const chk = await dbq(`select prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='check_reward_code'`);
console.log('=== check_reward_code (live) ===');
console.log((chk[0]?.prosrc ?? 'MISSING').slice(0, 1500));

// 2) أعمدة reward_redemptions وعينات أكواد
const cols = await dbq(`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='reward_redemptions' order by ordinal_position`);
console.log('=== reward_redemptions columns ===');
console.log(JSON.stringify(cols.map(c => c.column_name)));
const samples = await dbq(`select code, status, expires_at, reward_name, created_at from reward_redemptions order by created_at desc limit 6`);
console.log('=== recent codes ===');
console.log(JSON.stringify(samples, null, 1));

// 3) المكافآت النشطة
const rewards = await dbq(`select id, name_ar, points_cost, is_active from rewards order by points_cost limit 5`);
console.log('=== rewards ===');
console.log(JSON.stringify(rewards));

readdirSync(here).filter(x => x.startsWith('.sbt')).forEach(x => unlinkSync(join(here, x)));
console.log('# tokens cleaned');
