-- حفظ صور الفئات الظاهرة في الشاشة الرئيسية داخل قاعدة البيانات لتظهر في اللوحة
update public.categories set image_url = '/img/cappuccino.jpg'   where slug = 'hot_drinks';
update public.categories set image_url = '/img/iced-latte.jpg'   where slug = 'cold_drinks';
update public.categories set image_url = '/img/matcha.jpg'       where slug = 'matcha_tea';
update public.categories set image_url = '/img/juice.jpg'        where slug = 'fresh';
update public.categories set image_url = '/img/mojito.jpg'       where slug = 'mojito';
update public.categories set image_url = '/img/chocolate-cake.jpg' where slug = 'dessert';

select slug, emoji, image_url from public.categories order by sort_order, id;