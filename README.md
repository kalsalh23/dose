# Dose Coffee & More — Kiosk Loyalty Platform

منصة نقاط ولاء للتابلت المثبّت داخل محل Dose Coffee & More — واجهة عربية RTL بتصميم Premium Coffee UI، تعمل بالكامل من شاشة التابلت: إنشاء الحساب، اختيار المنتجات، إرسال الطلب، وتأكيد الهوية برمز PIN.

## المزايا

- **إنشاء حساب من نفس الشاشة** — الاسم، رقم الهاتف، ورمز PIN من 4 أرقام (يُخزَّن مشفَّرًا SHA-256).
- **قائمة منتجات** بثلاث تصنيفات (ساخنة / باردة / حلويات) مع نقاط لكل منتج — بدون عرض أي أسعار.
- **سلة طلب** مع شريط سفلي وإرسال الطلب بضغطة واحدة.
- **تأكيد الهوية بشاشة PIN** (لوحة أرقام على الشاشة) قبل تسجيل الطلب وإضافة النقاط.
- **Backend على Supabase** — جداول `customers` و`orders` محمية بـ RLS، والوصول فقط عبر دوال RPC آمنة (`create_customer`, `verify_customer`, `create_order`).

## البنية

```
index.html            الواجهة (RTL)
styles.css            التصميم (Premium Coffee UI)
app.js                المنطق + إعدادات Supabase
vendor/supabase.js    مكتبة supabase-js (محلية، بدون CDN)
assets/img/           صور المنتجات
scripts/schema.sql    مخطط قاعدة البيانات
scripts/apply-schema.mjs   أداة تنفيذ المخطط
scripts/dev-server.mjs     خادم تطوير محلي
```

## التشغيل محليًا

```bash
node scripts/dev-server.mjs
# ثم افتح http://localhost:4173
```

## إعداد قاعدة البيانات (مرة واحدة)

```bash
set SB_TOKEN=<supabase-access-token>
node scripts/apply-schema.mjs
```

## النشر

الموقع مُهيّأ للنشر الثابت على Vercel (بدون build):

```bash
npx vercel --prod
```

## إدارة الطلبات

الطلبات تُسجَّل في جدول `orders` في Supabase (لوحة التحكم → Table Editor). رقم الطلب تسلسلي، والحالة الافتراضية `new` — يمكن لاحقًا بناء شاشة باريستا تقرأ الطلبات الجديدة.
