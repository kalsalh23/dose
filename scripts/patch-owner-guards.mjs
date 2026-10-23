// إضافة فحص الملكية (owner-only) لكل الدوال الإدارية غير الطلبات
import { readFileSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));

let token = null;
for (const f of readdirSync(here).filter((x) => x.startsWith('.sbt'))) {
  const v = readFileSync(join(here, f), 'utf8');
  const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'select 1' }),
  });
  if (r.status === 200 || r.status === 201) { token = v; break; }
}
if (!token) { console.error('NO TOKEN'); process.exit(1); }
try { writeFileSync(join(here, '.sbtok'), token); } catch {}

const dbq = async (sql) => {
  const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  if (r.status !== 200 && r.status !== 201) throw new Error(`${r.status} ${t.slice(0, 400)}`);
  return JSON.parse(t);
};

// الدوال التي يبقى العامل قادرًا على استخدامها
const WORKER_OK = new Set(['admin_login', 'admin_set_order_status', 'admin_list_orders']);
// الدوال التي جرى تحديثها يدويًا مسبقًا (بدون إعادة كتابة)
const SKIP = new Set(['admin_login', 'admin_set_order_status', 'admin_list_orders', 'admin_delete_product']);

const rows = await dbq("select p.proname, pg_get_function_identity_arguments(p.oid) as args, pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'admin%' order by p.proname");

let patched = 0, skipped = 0;
for (const r of rows) {
  if (SKIP.has(r.proname)) { skipped++; continue; }
  let def = r.def;
  let patchedDef = def;

  // plpgsql: الحقن بعد فحص الصلاحية
  if (def.includes("if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;")) {
    patchedDef = def.replace(
      "if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;",
      "if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;\n  if not public._is_owner(p_token) then raise exception 'unauthorized'; end if;"
    );
  }
  // دالة SQL: تقييد جملة where
  if (def.includes('where public._valid_admin(p_token)')) {
    patchedDef = def.replace('where public._valid_admin(p_token)', 'where public._valid_admin(p_token) and public._is_owner(p_token)');
  }

  if (patchedDef === def) { console.log('NO-CHANGE:', r.proname); skipped++; continue; }
  try {
    await dbq(patchedDef);
    patched++;
    console.log('patched:', r.proname, '(' + r.args + ')');
  } catch (e) {
    console.log('FAILED:', r.proname, e.message.slice(0, 200));
  }
}
console.log('---');
console.log('patched:', patched, '| skipped:', skipped);
readdirSync(here).filter((x) => x.startsWith('.sbt') && x !== '.sbtok').forEach((x) => unlinkSync(join(here, x)));