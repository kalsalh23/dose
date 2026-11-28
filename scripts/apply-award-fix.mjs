import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, 'fix-award-points-expiry.sql'), 'utf8');
const c = new pg.Client({
  host: 'aws-0-ap-south-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.mqstsxuscqbxnyejhixk',
  password: 'Oday2001#23#',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});
await c.connect();
try {
  await c.query(sql);
  const fixed = await c.query(`update public.customers
    set points = points + p_delta,
        points_expires_at = case when p_delta > 0 then now() + (d || ' days')::interval else points_expires_at end
  where customer_id = p_customer;
 `);
  console.log('fn applied; fixed expired-live customers:', fixed.rowCount);
} finally {
  await c.end();
}