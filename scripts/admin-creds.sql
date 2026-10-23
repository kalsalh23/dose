-- تحديث بيانات دخول المسؤول (المالك)
UPDATE public.admin_users
SET username = 'one@gmail.com',
    password_hash = encode(extensions.digest('dose:123123', 'sha256'), 'hex'),
    role = 'owner'
WHERE username = 'admin';

-- إن لم يكن موجودًا (احتياطًا)
INSERT INTO public.admin_users (username, password_hash, role)
VALUES ('one@gmail.com', encode(extensions.digest('dose:123123', 'sha256'), 'hex'), 'owner')
ON CONFLICT (username) DO UPDATE SET role = 'owner', password_hash = encode(extensions.digest('dose:123123', 'sha256'), 'hex');

-- إبطال الجلسات القديمة لضمان إعادة الدخول
DELETE FROM public.admin_sessions WHERE admin_id NOT IN (SELECT id FROM public.admin_users WHERE username = 'one@gmail.com');

SELECT id, username, role FROM public.admin_users ORDER BY id;