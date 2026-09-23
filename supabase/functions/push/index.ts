// إشعارات Dose Cafe الفورية — Web Push عبر VAPID
// يُستدعى من قاعدة البيانات (pg_net) بعد إنشاء/إكمال الطلب
import webpush from 'npm:web-push@3.6.7';

const PUB = Deno.env.get('VAPID_PUBLIC_KEY')!;
const PRIV = Deno.env.get('VAPID_PRIVATE_KEY')!;
webpush.setVapidDetails('mailto:cafe@dose.app', PUB, PRIV);

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SR_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const { customer_id, title, body } = await req.json().catch(() => ({}));
  if (!customer_id || !title) return new Response('bad request', { status: 400 });

  // جلب اشتراكات أجهزة العميل (service role)
  const res = await fetch(`${SB_URL}/rest/v1/device_tokens?customer_id=eq.${customer_id}&select=token`, {
    headers: { apikey: SR_KEY, Authorization: `Bearer ${SR_KEY}` },
  });
  const rows = await res.json().catch(() => []);
  if (!Array.isArray(rows) || rows.length === 0) return Response.json({ sent: 0 });

  let sent = 0;
  const dead: string[] = [];
  await Promise.all(rows.map(async (r) => {
    try {
      await webpush.sendNotification(JSON.parse(r.token), JSON.stringify({ title, body }));
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(r.token);
    }
  }));

  // تنظيف الاشتراكات الميتة
  for (const t of dead) {
    await fetch(`${SB_URL}/rest/v1/device_tokens?token=eq.${encodeURIComponent(t)}`, {
      method: 'DELETE',
      headers: { apikey: SR_KEY, Authorization: `Bearer ${SR_KEY}` },
    }).catch(() => {});
  }

  return Response.json({ sent });
});
