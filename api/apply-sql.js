export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  let raw = req.body;
  if (Buffer.isBuffer(raw)) raw = raw.toString('utf8');
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = {};
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};
  const key = raw.key || req.headers['x-runner-key'];
  if (!process.env.RUNNER_KEY || key !== process.env.RUNNER_KEY) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  const sql = raw.sql;
  if (!sql || typeof sql !== 'string') {
    res.status(400).json({ error: 'sql required' });
    return;
  }
  try {
    const r = await fetch('https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.SUPABASE_PAT,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });
    const text = await r.text();
    res.status(r.status).send(text);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}