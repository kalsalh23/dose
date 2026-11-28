import pg from 'pg';
const c = new pg.Client({ host:'aws-0-ap-south-1.pooler.supabase.com', port:6543, user:'postgres.mqstsxuscqbxnyejhixk', password:'Oday2001#23#', database:'postgres', ssl:{rejectUnauthorized:false} });
await c.connect();
const q = async (label, sql) => { try { const r = await c.query(sql); console.log('=== '+label+' ==='); console.log(JSON.stringify(r.rows)); } catch(e){ console.log('ERR '+label+': '+e.message); } };
await q('customer expires', "select id, full_name, points, points_expires_at from public.customers where points>0 order by created_at desc limit 5");
await q('settings', "select key,value from public.settings where key='points_expire_days'");
await c.end();