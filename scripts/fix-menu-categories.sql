-- إصلاح category_slug لكل قائمة حسب محتواها الفعلي
update public.menus set category_slug = 'hot_drinks' where title in ('مشروبات ساخنة', 'ميلك شيك', 'سبشل Dose', 'GUFR');
update public.menus set category_slug = 'cold_drinks' where title in ('مشروبات باردة', 'سموزي', 'فربتشينو', 'ايس تي', 'Ice Coffee');
update public.menus set category_slug = 'mojito' where title = 'موهيتو';
update public.menus set category_slug = 'dessert' where title in ('ايس كريم', 'كريب', 'وافل بابلي', 'بانكيك', 'تيز كيك', 'حلويات');
update public.menus set category_slug = 'matcha_tea' where title in ('ماتشا', 'V60');
update public.menus set category_slug = 'fresh' where title in ('عصاير طبيعية', 'كوكتيل');
select id, title, category_slug from public.menus order by id;