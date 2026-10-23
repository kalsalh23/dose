-- ============================================================
-- المنيو الجديد الكامل — تصنيفات + منتجات
-- ============================================================

-- إيقاف المشروبات القديمة (تصنيفان: hot وcold)
update public.products p set is_active = false
where p.category_id in (select id from public.categories where slug in ('hot','cold'));

-- تصنيفات جديدة
insert into public.categories (slug, name_ar, emoji, sort_order) values
  ('hotdrinks','المشروبات الساخنة','🍵',5),
  ('matcha','الماتشا','🍵',6),
  ('icetea','الشاي المثلج','🧊',7),
  ('shake','ميلك شيك','🥤',8),
  ('frappe','ميكس فرابيه','🥤',9),
  ('juices','العصائر الطبيعية','🍊',10),
  ('mojito','الموهيتو','🍹',11),
  ('smoothie','السموذي','🥤',12),
  ('special','سبشيال دوز','⭐',13)
on conflict (slug) do nothing;

-- القهوة الساخنة
insert into public.products (category_id, name_ar, name_en, price_cents, points, image_url, sort_order, options)
select c.id, v.name_ar, v.name_en, v.price, greatest(1, round(v.price/5000.0)::int), v.img, v.sort, v.opts
from (values
  ('V60','V60',25000,'/img/v60.jpg',1,'سكر إضافي, بدون سكر'),
  ('سبانيش لاتيه','Spanish Latte',12000,'/img/latte.jpg',2,'سكر إضافي, بدون سكر, سكر داييت'),
  ('موكاتشينو','Mochaccino',12000,'/img/mocha.jpg',3,'سكر إضافي, بدون سكر, كاكاو إضافي'),
  ('امريكانو','Americano',8000,'/img/americano.jpg',4,'سكر إضافي, بدون سكر, نعناع'),
  ('كراميل ماكياتو','Caramel Macchiato',12000,'/img/caramel-macchiato.jpg',5,'سكر إضافي, بدون سكر, كراميل إضافي'),
  ('وايت موكا','White Mocha',12000,'/img/mocha.jpg',6,'سكر إضافي, بدون سكر, كريمة'),
  ('قهوة تركية','Turkish Coffee',7000,'/img/espresso.jpg',7,'سكر إضافي, بدون سكر, وسط, خفيف'),
  ('هوت شوكولت حليب','Hot Chocolate Milk',12000,'/img/hotchoc.jpg',8,'سكر إضافي, بدون سكر, كريمة'),
  ('هوت شوكولات مياه','Hot Chocolate Water',7000,'/img/hotchoc.jpg',9,'سكر إضافي, بدون سكر'),
  ('كابتشينو','Cappuccino',12000,'/img/cappuccino.jpg',10,'سكر إضافي, بدون سكر, نعناع, حليب أكثر'),
  ('لاتيه','Latte',10000,'/img/latte.jpg',11,'سكر إضافي, بدون سكر, حليب أكثر, حليب خالي'),
  ('فلات وايت','Flat White',8000,'/img/cappuccino.jpg',12,'سكر إضافي, بدون سكر'),
  ('كورتادو','Cortado',8000,'/img/espresso.jpg',13,'سكر إضافي, بدون سكر'),
  ('اسبريسو','Espresso',5000,'/img/espresso.jpg',14,'سكر إضافي, بدون سكر')
) as v(name_ar, name_en, price, img, sort, opts)
join public.categories c on c.slug = 'hot'
where not exists (select 1 from public.products p where p.name_ar = v.name_ar and p.category_id = c.id);

-- المشروبات الساخنة
insert into public.products (category_id, name_ar, name_en, price_cents, points, image_url, sort_order, options)
select c.id, v.name_ar, v.name_en, v.price, greatest(1, round(v.price/5000.0)::int), v.img, v.sort, v.opts
from (values
  ('هوت لوتس','Hot Lotus',12000,'/img/hotchoc.jpg',1,'سكر إضافي, بدون سكر'),
  ('ملتشا','Maltea',12000,'/img/matcha.jpg',2,'سكر إضافي, بدون سكر'),
  ('سحلب','Sahlab',8000,'/img/hotchoc.jpg',3,'مكسرات, قرفة, جوز الهند'),
  ('شاي كرك','Karak Tea',12000,'/img/tea.jpg',4,'سكر إضافي, بدون سكر, هيل'),
  ('3-1 مياه','3in1 Water',7000,'/img/tea.jpg',5,''),
  ('3-1 حليب','3in1 Milk',10000,'/img/tea.jpg',6,''),
  ('كمون ولايمون','Cumin Lemon',5000,'/img/tea.jpg',7,''),
  ('زنجبيل ولايمون','Ginger Lemon',5000,'/img/tea.jpg',8,'سكر إضافي, بدون سكر'),
  ('شاي عادي','Plain Tea',3000,'/img/tea.jpg',9,'سكر إضافي, بدون سكر'),
  ('زهورات','Zahrawat',5000,'/img/tea.jpg',10,'')
) as v(name_ar, name_en, price, img, sort, opts)
join public.categories c on c.slug = 'hotdrinks'
where not exists (select 1 from public.products p where p.name_ar = v.name_ar and p.category_id = c.id);

-- القهوة المثلجة (صغير/كبير)
insert into public.products (category_id, name_ar, name_en, price_cents, points, image_url, sort_order, options)
select c.id, v.name_ar, v.name_en, v.price, greatest(1, round(v.price/5000.0)::int), v.img, v.sort, v.opts
from (values
  ('آيس لاتيه صغير','Iced Latte S',15000,'/img/iced-latte.jpg',1,'سكر إضافي, بدون سكر, حليب أكثر'),
  ('آيس لاتيه كبير','Iced Latte L',18000,'/img/iced-latte.jpg',2,'سكر إضافي, بدون سكر, حليب أكثر'),
  ('آيس سبانيش لاتيه صغير','Iced Spanish Latte S',18000,'/img/iced-latte.jpg',3,'سكر إضافي, بدون سكر'),
  ('آيس سبانيش لاتيه كبير','Iced Spanish Latte L',20000,'/img/iced-latte.jpg',4,'سكر إضافي, بدون سكر'),
  ('آيس موكاتشينو صغير','Iced Mochaccino S',18000,'/img/iced-mocha.jpg',5,'سكر إضافي, بدون سكر, شوكولا'),
  ('آيس موكاتشينو كبير','Iced Mochaccino L',20000,'/img/iced-mocha.jpg',6,'سكر إضافي, بدون سكر, شوكولا'),
  ('V60 مثلج','Iced V60',27000,'/img/v60.jpg',7,''),
  ('آيس كراميل ماكياتو صغير','Iced Caramel Macchiato S',18000,'/img/caramel-macchiato.jpg',8,'كراميل إضافي, بدون سكر'),
  ('آيس كراميل ماكياتو كبير','Iced Caramel Macchiato L',20000,'/img/caramel-macchiato.jpg',9,'كراميل إضافي, بدون سكر'),
  ('آيس وايت موكا صغير','Iced White Mocha S',15000,'/img/iced-mocha.jpg',10,'كريمة, بدون سكر'),
  ('آيس وايت موكا كبير','Iced White Mocha L',18000,'/img/iced-mocha.jpg',11,'كريمة, بدون سكر'),
  ('آيس كوفي دوز صغير','Iced Coffee Dose S',18000,'/img/iced-mocha.jpg',12,''),
  ('آيس كوفي دوز كبير','Iced Coffee Dose L',22000,'/img/iced-mocha.jpg',13,''),
  ('آيس لاتيه باستاشيو صغير','Iced Pistachio Latte S',22000,'/img/iced-latte.jpg',14,''),
  ('آيس لاتيه باستاشيو كبير','Iced Pistachio Latte L',25000,'/img/iced-latte.jpg',15,''),
  ('آيس امريكانو','Iced Americano',10000,'/img/americano.jpg',16,'سكر إضافي, بدون سكر')
) as v(name_ar, name_en, price, img, sort, opts)
join public.categories c on c.slug = 'cold'
where not exists (select 1 from public.products p where p.name_ar = v.name_ar and p.category_id = c.id);

-- الماتشا
insert into public.products (category_id, name_ar, name_en, price_cents, points, image_url, sort_order, options)
select c.id, v.name_ar, v.name_en, v.price, greatest(1, round(v.price/5000.0)::int), v.img, v.sort, v.opts
from (values
  ('ايس لاتيه ماتشا','Iced Matcha Latte',22000,'/img/matcha.jpg',1,''),
  ('ايس لاتيه بالو ماتشا','Iced Pallo Matcha Latte',30000,'/img/matcha.jpg',2,''),
  ('ايس لاتيه بالو ماتشا مع شوندر','Iced Pallo Matcha with Chunder',35000,'/img/matcha.jpg',3,''),
  ('ماتشا ستراوبيري','Matcha Strawberry',30000,'/img/matcha.jpg',4,''),
  ('ماتشا فانيلا','Matcha Vanilla',25000,'/img/matcha.jpg',5,''),
  ('ماتشا جوز الهند','Matcha Coconut',25000,'/img/matcha.jpg',6,''),
  ('ماتشا كراميل','Matcha Caramel',25000,'/img/matcha.jpg',7,''),
  ('ماتشا بندق','Matcha Hazelnut',25000,'/img/matcha.jpg',8,'')
) as v(name_ar, name_en, price, img, sort, opts)
join public.categories c on c.slug = 'matcha'
where not exists (select 1 from public.products p where p.name_ar = v.name_ar and p.category_id = c.id);

-- الشاي المثلج (صغير/كبير)
insert into public.products (category_id, name_ar, name_en, price_cents, points, image_url, sort_order, options)
select c.id, v.name_ar, v.name_en, v.price, greatest(1, round(v.price/5000.0)::int), v.img, v.sort, v.opts
from (values
  ('آيس تي خوخ صغير','Peach Ice Tea S',15000,'/img/icetea.jpg',1,''),
  ('آيس تي خوخ كبير','Peach Ice Tea L',18000,'/img/icetea.jpg',2,''),
  ('آيس تي مكس بيري صغير','Mixed Berry Ice Tea S',18000,'/img/icetea.jpg',3,''),
  ('آيس تي مكس بيري كبير','Mixed Berry Ice Tea L',20000,'/img/icetea.jpg',4,''),
  ('آيس تي غرين باشن صغير','Green Passion Ice Tea S',15000,'/img/icetea.jpg',5,''),
  ('آيس تي غرين باشن كبير','Green Passion Ice Tea L',18000,'/img/icetea.jpg',6,''),
  ('آيس تي تروبيكال باشن صغير','Tropical Passion Ice Tea S',15000,'/img/icetea.jpg',7,''),
  ('آيس تي تروبيكال باشن كبير','Tropical Passion Ice Tea L',18000,'/img/icetea.jpg',8,'')
) as v(name_ar, name_en, price, img, sort, opts)
join public.categories c on c.slug = 'icetea'
where not exists (select 1 from public.products p where p.name_ar = v.name_ar and p.category_id = c.id);

-- ميلك شيك (صغير/كبير)
insert into public.products (category_id, name_ar, name_en, price_cents, points, image_url, sort_order, options)
select c.id, v.name_ar, v.name_en, v.price, greatest(1, round(v.price/5000.0)::int), v.img, v.sort, v.opts
from (values
  ('شيك فانيلا صغير','Vanilla Shake S',15000,'/img/shake.jpg',1,'كريمة, مكسرات'),
  ('شيك فانيلا كبير','Vanilla Shake L',18000,'/img/shake.jpg',2,'كريمة, مكسرات'),
  ('شيك فراوله صغير','Strawberry Shake S',18000,'/img/shake.jpg',3,'كريمة'),
  ('شيك فراوله كبير','Strawberry Shake L',22000,'/img/shake.jpg',4,'كريمة'),
  ('شيك اوريو صغير','Oreo Shake S',15000,'/img/shake.jpg',5,'كريمة'),
  ('شيك اوريو كبير','Oreo Shake L',18000,'/img/shake.jpg',6,'كريمة'),
  ('شيك تشيز كيك صغير','Cheesecake Shake S',20000,'/img/shake.jpg',7,''),
  ('شيك تشيز كيك كبير','Cheesecake Shake L',24000,'/img/shake.jpg',8,''),
  ('شيك لوتس صغير','Lotus Shake S',18000,'/img/shake.jpg',9,'كريمة'),
  ('شيك لوتس كبير','Lotus Shake L',22000,'/img/shake.jpg',10,'كريمة'),
  ('شيك نيوتيلا صغير','Nutella Shake S',18000,'/img/shake.jpg',11,'كريمة, مكسرات'),
  ('شيك نيوتيلا كبير','Nutella Shake L',24000,'/img/shake.jpg',12,'كريمة, مكسرات'),
  ('شيك قيولت صغير','Yogurt Shake S',18000,'/img/shake.jpg',13,''),
  ('شيك قيولت كبير','Yogurt Shake L',22000,'/img/shake.jpg',14,''),
  ('شيك كيندر صغير','Kinder Shake S',18000,'/img/shake.jpg',15,'كريمة'),
  ('شيك كيندر كبير','Kinder Shake L',22000,'/img/shake.jpg',16,'كريمة'),
  ('شيك سنيكرز صغير','Snickers Shake S',18000,'/img/shake.jpg',17,'كريمة, مكسرات'),
  ('شيك سنيكرز كبير','Snickers Shake L',22000,'/img/shake.jpg',18,'كريمة, مكسرات'),
  ('شيك توفيكس صغير','Twix Shake S',15000,'/img/shake.jpg',19,'كريمة'),
  ('شيك توفيكس كبير','Twix Shake L',20000,'/img/shake.jpg',20,'كريمة'),
  ('شيك شوكولا صغير','Chocolate Shake S',15000,'/img/shake.jpg',21,'كريمة'),
  ('شيك شوكولا كبير','Chocolate Shake L',20000,'/img/shake.jpg',22,'كريمة')
) as v(name_ar, name_en, price, img, sort, opts)
join public.categories c on c.slug = 'shake'
where not exists (select 1 from public.products p where p.name_ar = v.name_ar and p.category_id = c.id);

-- ميكس فرابيه (صغير/كبير)
insert into public.products (category_id, name_ar, name_en, price_cents, points, image_url, sort_order, options)
select c.id, v.name_ar, v.name_en, v.price, greatest(1, round(v.price/5000.0)::int), v.img, v.sort, v.opts
from (values
  ('فرابيه فانيلا صغير','Vanilla Frappe S',18000,'/img/frappe.jpg',1,'كريمة'),
  ('فرابيه فانيلا كبير','Vanilla Frappe L',22000,'/img/frappe.jpg',2,'كريمة'),
  ('فرابيه موكا صغير','Mocha Frappe S',18000,'/img/frappe.jpg',3,'كريمة'),
  ('فرابيه موكا كبير','Mocha Frappe L',22000,'/img/frappe.jpg',4,'كريمة'),
  ('فرابيه كراميل صغير','Caramel Frappe S',18000,'/img/frappe.jpg',5,'كريمة'),
  ('فرابيه كراميل كبير','Caramel Frappe L',22000,'/img/frappe.jpg',6,'كريمة'),
  ('فرابيه باستاشيو صغير','Pistachio Frappe S',22000,'/img/frappe.jpg',7,'كريمة'),
  ('فرابيه باستاشيو كبير','Pistachio Frappe L',25000,'/img/frappe.jpg',8,'كريمة'),
  ('فرابيه توفيكس صغير','Twix Frappe S',18000,'/img/frappe.jpg',9,'كريمة'),
  ('فرابيه توفيكس كبير','Twix Frappe L',22000,'/img/frappe.jpg',10,'كريمة'),
  ('فراب لاتيه صغير','Latte Frappe S',18000,'/img/frappe.jpg',11,''),
  ('فراب لاتيه كبير','Latte Frappe L',22000,'/img/frappe.jpg',12,'')
) as v(name_ar, name_en, price, img, sort, opts)
join public.categories c on c.slug = 'frappe'
where not exists (select 1 from public.products p where p.name_ar = v.name_ar and p.category_id = c.id);

-- العصائر الطبيعية
insert into public.products (category_id, name_ar, name_en, price_cents, points, image_url, sort_order, options)
select c.id, v.name_ar, v.name_en, v.price, greatest(1, round(v.price/5000.0)::int), v.img, v.sort, v.opts
from (values
  ('عصير موز وحليب','Banana Milk Juice',20000,'/img/juice.jpg',1,'شوكولا, عسل, فراوله'),
  ('كوكتيل فواكه','Fruit Cocktail',20000,'/img/juice.jpg',2,''),
  ('كوكتيل جميكا','Jamaica Cocktail',20000,'/img/juice.jpg',3,''),
  ('موز وحليب واتناس','Banana Milk Walnuts',20000,'/img/juice.jpg',4,''),
  ('عصير رمان','Pomegranate Juice',15000,'/img/juice.jpg',5,''),
  ('عصير بولو','Melon Juice',18000,'/img/juice.jpg',6,''),
  ('عصير كيوي','Kiwi Juice',20000,'/img/juice.jpg',7,''),
  ('عصير مانجو','Mango Juice',20000,'/img/juice.jpg',8,''),
  ('عصير لايمون','Lemon Juice',15000,'/img/juice.jpg',9,'سكر إضافي, بدون سكر, نعناع'),
  ('عصير فراوله','Strawberry Juice',18000,'/img/juice.jpg',10,''),
  ('عصير اناناس','Pineapple Juice',18000,'/img/juice.jpg',11,''),
  ('عصير برتقال','Orange Juice',15000,'/img/juice.jpg',12,''),
  ('عصير جزر وبرتقال','Carrot Orange Juice',18000,'/img/juice.jpg',13,'')
) as v(name_ar, name_en, price, img, sort, opts)
join public.categories c on c.slug = 'juices'
where not exists (select 1 from public.products p where p.name_ar = v.name_ar and p.category_id = c.id);

-- الموهيتو (صغير/كبير)
insert into public.products (category_id, name_ar, name_en, price_cents, points, image_url, sort_order, options)
select c.id, v.name_ar, v.name_en, v.price, greatest(1, round(v.price/5000.0)::int), v.img, v.sort, v.opts
from (values
  ('موهيتو بلو هاواي صغير','Blue Hawaii Mojito S',15000,'/img/mojito.jpg',1,''),
  ('موهيتو بلو هاواي كبير','Blue Hawaii Mojito L',20000,'/img/mojito.jpg',2,''),
  ('موهيتو ميكس بيتش صغير','Mix Peach Mojito S',18000,'/img/mojito.jpg',3,''),
  ('موهيتو ميكس بيتش كبير','Mix Peach Mojito L',22000,'/img/mojito.jpg',4,''),
  ('موهيتو بابل جوم صغير','Bubblegum Mojito S',18000,'/img/mojito.jpg',5,''),
  ('موهيتو بابل جوم كبير','Bubblegum Mojito L',22000,'/img/mojito.jpg',6,''),
  ('موهيتو جرين هابي صغير','Green Happy Mojito S',15000,'/img/mojito.jpg',7,''),
  ('موهيتو جرين هابي كبير','Green Happy Mojito L',20000,'/img/mojito.jpg',8,''),
  ('موهيتو تروبيكال صغير','Tropical Mojito S',18000,'/img/mojito.jpg',9,''),
  ('موهيتو تروبيكال كبير','Tropical Mojito L',22000,'/img/mojito.jpg',10,''),
  ('موهيتو كيوي صغير','Kiwi Mojito S',15000,'/img/mojito.jpg',11,''),
  ('موهيتو كيوي كبير','Kiwi Mojito L',20000,'/img/mojito.jpg',12,''),
  ('موهيتو أورانج صغير','Orange Mojito S',15000,'/img/mojito.jpg',13,''),
  ('موهيتو أورانج كبير','Orange Mojito L',20000,'/img/mojito.jpg',14,''),
  ('موهيتو ميكس بيري صغير','Mix Berry Mojito S',15000,'/img/mojito.jpg',15,''),
  ('موهيتو ميكس بيري كبير','Mix Berry Mojito L',20000,'/img/mojito.jpg',16,''),
  ('موهيتو كيوي غرين صغير','Green Kiwi Mojito S',18000,'/img/mojito.jpg',17,''),
  ('موهيتو كيوي غرين كبير','Green Kiwi Mojito L',22000,'/img/mojito.jpg',18,''),
  ('موهيتو بلو باشن صغير','Blue Passion Mojito S',18000,'/img/mojito.jpg',19,''),
  ('موهيتو بلو باشن كبير','Blue Passion Mojito L',22000,'/img/mojito.jpg',20,''),
  ('موهيتو بلو بيري صغير','Blueberry Mojito S',18000,'/img/mojito.jpg',21,''),
  ('موهيتو بلو بيري كبير','Blueberry Mojito L',22000,'/img/mojito.jpg',22,''),
  ('موهيتو سانشاين صغير','Sunshine Mojito S',18000,'/img/mojito.jpg',23,''),
  ('موهيتو سانشاين كبير','Sunshine Mojito L',22000,'/img/mojito.jpg',24,'')
) as v(name_ar, name_en, price, img, sort, opts)
join public.categories c on c.slug = 'mojito'
where not exists (select 1 from public.products p where p.name_ar = v.name_ar and p.category_id = c.id);

-- السموذي (صغير/كبير)
insert into public.products (category_id, name_ar, name_en, price_cents, points, image_url, sort_order, options)
select c.id, v.name_ar, v.name_en, v.price, greatest(1, round(v.price/5000.0)::int), v.img, v.sort, v.opts
from (values
  ('سموذي دراق صغير','Peach Smoothie S',15000,'/img/smoothie.jpg',1,''),
  ('سموذي دراق كبير','Peach Smoothie L',18000,'/img/smoothie.jpg',2,''),
  ('سموذي اناناس صغير','Pineapple Smoothie S',15000,'/img/smoothie.jpg',3,''),
  ('سموذي اناناس كبير','Pineapple Smoothie L',18000,'/img/smoothie.jpg',4,''),
  ('سموذي فراوله صغير','Strawberry Smoothie S',15000,'/img/smoothie.jpg',5,''),
  ('سموذي فراوله كبير','Strawberry Smoothie L',20000,'/img/smoothie.jpg',6,''),
  ('سموذي مانجو صغير','Mango Smoothie S',18000,'/img/smoothie.jpg',7,''),
  ('سموذي مانجو كبير','Mango Smoothie L',22000,'/img/smoothie.jpg',8,''),
  ('سموذي موز صغير','Banana Smoothie S',18000,'/img/smoothie.jpg',9,''),
  ('سموذي موز كبير','Banana Smoothie L',22000,'/img/smoothie.jpg',10,''),
  ('سموذي جوز الهند صغير','Coconut Smoothie S',15000,'/img/smoothie.jpg',11,''),
  ('سموذي جوز الهند كبير','Coconut Smoothie L',18000,'/img/smoothie.jpg',12,''),
  ('سموذي دوز صغير','Dose Smoothie S',18000,'/img/smoothie.jpg',13,''),
  ('سموذي دوز كبير','Dose Smoothie L',22000,'/img/smoothie.jpg',14,''),
  ('سموذي بلو بيري صغير','Blueberry Smoothie S',15000,'/img/smoothie.jpg',15,''),
  ('سموذي بلو بيري كبير','Blueberry Smoothie L',20000,'/img/smoothie.jpg',16,''),
  ('سموذي غرين هابي صغير','Green Happy Smoothie S',15000,'/img/smoothie.jpg',17,''),
  ('سموذي غرين هابي كبير','Green Happy Smoothie L',20000,'/img/smoothie.jpg',18,'')
) as v(name_ar, name_en, price, img, sort, opts)
join public.categories c on c.slug = 'smoothie'
where not exists (select 1 from public.products p where p.name_ar = v.name_ar and p.category_id = c.id);

-- سبشيال دوز (صغير/كبير)
insert into public.products (category_id, name_ar, name_en, price_cents, points, image_url, sort_order, options)
select c.id, v.name_ar, v.name_en, v.price, greatest(1, round(v.price/5000.0)::int), v.img, v.sort, v.opts
from (values
  ('كوتترول S صغير','Cottrol S',18000,'/img/frappe.jpg',1,''),
  ('كوتترول S كبير','Cottrol L',22000,'/img/frappe.jpg',2,''),
  ('براون مود صغير','Brown Mood S',18000,'/img/mocha.jpg',3,''),
  ('براون مود كبير','Brown Mood L',22000,'/img/mocha.jpg',4,''),
  ('ستراوبيري كاندي صغير','Strawberry Candy S',15000,'/img/smoothie.jpg',5,''),
  ('ستراوبيري كاندي كبير','Strawberry Candy L',20000,'/img/smoothie.jpg',6,''),
  ('سينابون صغير','Cinnabon S',18000,'/img/frappe.jpg',7,'كريمة, قرفة'),
  ('سينابون كبير','Cinnabon L',22000,'/img/frappe.jpg',8,'كريمة, قرفة'),
  ('سينا لاتيه صغير','Cina Latte S',18000,'/img/latte.jpg',9,''),
  ('سينا لاتيه كبير','Cina Latte L',22000,'/img/latte.jpg',10,''),
  ('كوفي بلو صغير','Coffee Blue S',18000,'/img/iced-latte.jpg',11,''),
  ('كوفي بلو كبير','Coffee Blue L',22000,'/img/iced-latte.jpg',12,''),
  ('ريدمييلون صغير','Redmelon S',18000,'/img/juice.jpg',13,''),
  ('ريدمييلون كبير','Redmelon L',22000,'/img/juice.jpg',14,''),
  ('بيناكولادا صغير','Pina Colada S',18000,'/img/mojito.jpg',15,''),
  ('بيناكولادا كبير','Pina Colada L',22000,'/img/mojito.jpg',16,''),
  ('بلو بلاتنا صغير','Blue Platana S',22000,'/img/mojito.jpg',17,''),
  ('بلو بلاتنا كبير','Blue Platana L',25000,'/img/mojito.jpg',18,''),
  ('كوكو كراميل صغير','Coco Caramel S',18000,'/img/frappe.jpg',19,''),
  ('كوكو كراميل كبير','Coco Caramel L',22000,'/img/frappe.jpg',20,'')
) as v(name_ar, name_en, price, img, sort, opts)
join public.categories c on c.slug = 'special'
where not exists (select 1 from public.products p where p.name_ar = v.name_ar and p.category_id = c.id);

-- الإحصائية تُنفَّذ منفصلة (انظر scripts/menu2-stats.sql)
