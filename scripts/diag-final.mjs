import pg from 'pg';
const c = new pg.Client({ host:'aws-0-ap-south-1.pooler.supabase.com', port:6543, user:'postgres.mqstsxuscqbxnyejhixk', password:'Oday2001#23#', database:'postgres', ssl:{rejectUnauthorized:false} });
await c.connect();
const r = await c.query("select token from public.customer_sessions where customer_id='bc7167b0-5881-4543-b6ba-8c61e90b89a8' order by created_at desc limit 1");
if (r.rows.length) {
  const d = await c.query(`select public.get_my_data($1::uuid) as d`, [r.rows[0].token]);
  console.log(JSON.stringify(d.rows[0].d));
}
await c.end();