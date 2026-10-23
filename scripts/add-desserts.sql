-- إضافة قائمة الحلويات من ملف الـPDF (30 منتجًا) — آمنة لإعادة التطبيق
insert into public.products (category_id, name_ar, name_en, description_ar, price_cents, points, image_url, sort_order)
select c.id, v.name_ar, v.name_en, v.descr, v.price, v.pts, v.img, v.sort
from (values
  -- تشيز كيك
  ('تشيز كيك فراوله','Strawberry Cheesecake','تشيز كيك كريمي بنكهة الفراولة',25000,5,'/img/vanilla-cake.jpg',4),
  ('تشيز كيك شوكولا','Chocolate Cheesecake','تشيز كيك كريمي بنكهة الشوكولاتة',22000,4,'/img/vanilla-cake.jpg',5),
  ('تشيز كيك لوتس','Lotus Cheesecake','تشيز كيك كريمي بنكهة اللوتس',25000,5,'/img/vanilla-cake.jpg',6),
  ('تشيز كيك باستاشيو','Pistachio Cheesecake','تشيز كيك كريمي بنكهة الفستق الحلبي',25000,5,'/img/vanilla-cake.jpg',7),
  ('تشيز كيك توت','Berries Cheesecake','تشيز كيك كريمي بنكهة التوت',20000,4,'/img/vanilla-cake.jpg',8),
  ('تشيز كيك فواكه','Fruit Cheesecake','تشيز كيك كريمي مع فواكه موسمية',25000,5,'/img/vanilla-cake.jpg',9),
  ('تيراميسيو','Tiramisu','تيراميسيو كلاسيكي بنكهة القهوة',25000,5,'/img/vanilla-cake.jpg',10),
  -- غوفر
  ('غوفر كيندر','Kinder Waffle','غوفر طازج مع كريمة الكيندر',15000,3,'/img/chocolate-cake.jpg',11),
  ('غوفر لوتس','Lotus Waffle','غوفر طازج مع كريمة اللوتس',20000,4,'/img/chocolate-cake.jpg',12),
  ('غوفر باستاشيو','Pistachio Waffle','غوفر طازج مع كريمة الفستق',25000,5,'/img/chocolate-cake.jpg',13),
  ('غوفر ديري','Berry Waffle','غوفر طازج بنكهة التوت',25000,5,'/img/chocolate-cake.jpg',14),
  -- وافل ببلي
  ('وافل كيندر','Kinder Bubbly Waffle','وافل ببلي طازج مع كريمة الكيندر',25000,5,'/img/cookies.jpg',11),
  ('وافل لوتس','Lotus Bubbly Waffle','وافل ببلي طازج مع كريمة اللوتس',25000,5,'/img/cookies.jpg',12),
  ('وافل فواكه','Fruit Bubbly Waffle','وافل ببلي طازج مع فواكه موسمية',35000,7,'/img/cookies.jpg',13),
  ('وافل باستاشيو','Pistachio Bubbly Waffle','وافل ببلي طازج مع كريمة الفستق',40000,8,'/img/cookies.jpg',14),
  ('وافل دوز','Dos Bubbly Waffle','وافل ببلي طازج بنكهة مميزة',40000,8,'/img/cookies.jpg',15),
  -- بان كيك
  ('بان كيك كيندر','Kinder Pancake','بان كيك طري مع كريمة الكيندر',25000,5,'/img/vanilla-cake.jpg',11),
  ('بان كيك لوتس','Lotus Pancake','بان كيك طري مع كريمة اللوتس',25000,5,'/img/vanilla-cake.jpg',12),
  ('بان كيك باستاشيو','Pistachio Pancake','بان كيك طري مع كريمة الفستق',30000,6,'/img/vanilla-cake.jpg',13),
  ('بان كيك فواكه','Fruit Pancake','بان كيك طري مع فواكه موسمية',35000,7,'/img/vanilla-cake.jpg',14),
  ('بان كيك دبي','Dubai Pancake','بان كيك بنكهة دبي الشهيرة',35000,7,'/img/vanilla-cake.jpg',15),
  -- كريب
  ('كريب كيندر','Kinder Crepe','كريب طازج مع كريمة الكيندر',25000,5,'/img/cookies.jpg',11),
  ('كريب لوتس','Lotus Crepe','كريب طازج مع كريمة اللوتس',25000,5,'/img/cookies.jpg',12),
  ('كريب اوريو','Oreo Crepe','كريب طازج مع البسكويت الاوريو',30000,6,'/img/cookies.jpg',13),
  ('كريب رول','Crepe Roll','كريب رول طازج محشو',30000,6,'/img/cookies.jpg',14),
  ('كريب فونتنتشيني شوكولا','Fontticcini Chocolate Crepe','كريب فونتنتشيني بالشوكولاتة',25000,5,'/img/cookies.jpg',15),
  ('كريب سوشي','Sushi Crepe','كريب سوشي بطعم مميز',30000,6,'/img/cookies.jpg',16),
  ('كريب فواكه','Fruit Crepe','كريب طازج مع فواكه موسمية',35000,7,'/img/cookies.jpg',17),
  ('كريب دبي','Dubai Crepe','كريب دبي الشهير',45000,9,'/img/cookies.jpg',18),
  ('كريب باستاشيو','Pistachio Crepe','كريب طازج مع كريمة الفستق',40000,8,'/img/cookies.jpg',19)
) as v(name_ar, name_en, descr, price, pts, img, sort)
join public.categories c on c.slug = 'dessert'
where not exists (select 1 from public.products p where p.name_ar = v.name_ar);

select p.name_ar, p.price_cents, p.points from public.products p
join public.categories c on c.id = p.category_id
where c.slug = 'dessert' order by p.sort_order, p.id;
