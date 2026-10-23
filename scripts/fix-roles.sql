-- ============================================================
-- تصحيح الأدوار:
--   admin            = المالك (كل اللوحة) — بنفس كلمة المرور الأصلية
--   one@gmail.com    = العامل (واجهة الطلبات فقط)
-- ============================================================

-- 1) إرجاع حساب المالك الأصلي (admin) بنفس بصمة كلمة المرور القديمة تمامًا
INSERT INTO public.admin_users (username, password_hash, role)
VALUES ('admin', 'e62bdf9a90490023d41db9261fa14c7d008fb227c0ccfc0465e78c0c69726269', 'owner')
ON CONFLICT (username) DO UPDATE SET role = 'owner', password_hash = 'e62bdf9a90490023d41db9261fa14c7d008fb227c0ccfc0465e78c0c69726269';

-- 2) one@gmail.com يصبح عامل (واجهة الطلبات فقط)
UPDATE public.admin_users
SET role = 'worker', password_hash = encode(extensions.digest('dose:123123', 'sha256'), 'hex')
WHERE username = 'one@gmail.com';

-- 3) إزالة حساب العامل المؤقت الذي أُنشئ سابقًا
DELETE FROM public.admin_sessions WHERE admin_id IN (SELECT id FROM public.admin_users WHERE username = 'worker');
DELETE FROM public.admin_users WHERE username = 'worker';

-- 4) إبطال كل الجلسات لضمان إعادة الدخول بالأدوار الصحيحة
DELETE FROM public.admin_sessions;

SELECT id, username, role FROM public.admin_users ORDER BY id;