import { readFileSync } from 'node:fs';

const K = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xc3RzeHVzY3FieG55ZWpoaXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjAwMDksImV4cCI6MjEwNTMzNjAwOX0.1Em6nTniOf3xgQWQxBf0N6h_3WZqBHba5C17i7LJ5K0';
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const rpc = (f, b) => fetch('https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/' + f, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(async r => ({ status: r.status, body: await r.text() }));

readFileSync; // noop
(async () => {
  const adm = JSON.parse((await rpc('admin_login', { p_username: 'admin', p_password: 'dose-admin-2026' })).body);
  const tok = adm.token;
  const custs = JSON.parse((await rpc('admin_list_customers', { p_token: tok })).body);
  const c1 = custs[0];
  console.log('toggle:', (await rpc('admin_toggle_customer', { p_token: tok, p_customer_id: c1.id, p_active: !c1.is_active })).body);
  console.log('toggle back:', (await rpc('admin_toggle_customer', { p_token: tok, p_customer_id: c1.id, p_active: c1.is_active })).body);
  console.log('bad token stats (يجب null):', (await rpc('admin_stats', { p_token: '00000000-0000-0000-0000-000000000000' })).body);
})();
