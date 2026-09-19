# Dose Coffee & More

منصة رقمية متكاملة لـ **Dose Coffee & More** — ولاء، طلبات، WhatsApp، مكافآت، ولوحة إدارة.

## المنظومة

| الواجهة | الرابط | الجمهور |
|---|---|---|
| منصة العميل | `/` | هاتف العميل (PWA) |
| منصة المحل (كشك) | `/kiosk` | التابلت داخل المحل |
| لوحة الإدارة | `/admin` | المدير |

الجميع متصل بنفس قاعدة بيانات **Supabase** — لا وجود لأي نظام طلبات منفصل.

## التقنيات
React 19 · Vite · TypeScript · Tailwind CSS v4 · Supabase (Postgres + RPC + Realtime-ready) · PWA · WhatsApp Deep Link (قابل للترقية إلى WhatsApp Business API عبر مزود واحد في `src/lib/whatsapp.ts`).

## التشغيل محليًا
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # بناء الإنتاج
```

## قاعدة البيانات
`supabase/schema.sql` — الجداول (customers, products, orders, order_items, points_transactions, rewards, reward_redemptions, notifications, advertisements, stores, device_tokens, admin_users, settings, profiles…) مع RLS كامل وجميع العمليات عبر دوال RPC.

```bash
set SB_TOKEN=<supabase-access-token>
node scripts/apply-schema.mjs
```

## الحسابات الافتراضية
- **لوحة الإدارة:** `admin` / `dose-admin-2026` — ⚠️ غيّر كلمة المرور من جدول `admin_users`.
- **كشك المحل:** يعمل مباشرة على `/kiosk` — لا يحتاج دخولًا.

## تدفق الطلب
اسم العميل ← المنتجات ← استلام/توصيل ← (موقع) ← PIN ← **Supabase** ← **WhatsApp** لرقم المحل.

النقاط تُمنح عند إكمال الطلب (قابل للتغيير من الإعدادات). استبدال النقاط يولّد Reward Code يُستخدم مرة واحدة.
