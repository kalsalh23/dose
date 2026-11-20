-- إنشاء الفئات المطلوبة (نفس أسماء القوائم) وصورها ورموزها
insert into public.categories (slug, name_ar, emoji, image_url, sort_order) values
  ('gopher',      'غوفر',       '🧇', '/img/vanilla-cake.jpg',   7),
  ('cheesecake',  'تشيز كيك',   '🍰', '/img/vanilla-cake.jpg',   8),
  ('cocktail',    'كوكتيل',     '🍹', '/img/mojito.jpg',         9),
  ('ice_coffee',  'Ice coffee', '🧊', '/img/iced-latte.jpg',     10),
  ('v60',         'V60',        '☕', '/img/v60.jpg',            11),
  ('matcha',      'ماتشا',      '🍵', '/img/matcha.jpg',         12),
  ('pancake',     'بانكيك',     '🥞', '/img/chocolate-cake.jpg', 13),
  ('waffle',      'وافل',       '🧇', '/img/cookies.jpg',        14),
  ('crepe',       'كريب',       '🥞', '/img/vanilla-cake.jpg',   15),
  ('milkshake',   'ميلك شيك',   '🥤', '/img/shake.jpg',          16),
  ('frappe',      'فربتشينو',   '🥤', '/img/frappe.jpg',         17),
  ('smoothie',    'سموزي',      '🥤', '/img/smoothie.jpg',       18)
on conflict (slug) do update
  set name_ar = excluded.name_ar,
      emoji = excluded.emoji,
      image_url = excluded.image_url;

-- نقل منتجات كل قائمة إلى فئتها المقابلة (المنتج يُنقل مرة واحدة فقط)
do $mig$
declare r record; v_cat integer;
begin
  for r in select * from (values
    (9, 'smoothie'), (10, 'frappe'), (12, 'milkshake'), (14, 'crepe'),
    (15, 'waffle'), (16, 'pancake'), (17, 'matcha'), (18, 'v60'),
    (21, 'ice_coffee'), (23, 'cocktail'), (24, 'cheesecake'), (27, 'gopher')
  ) as t(menu_id, slug)
  loop
    select id into v_cat from public.categories c where c.slug = r.slug;
    if v_cat is null then continue; end if;
    update public.products p
       set category_id = v_cat
     where p.id in (select mi.product_id from public.menu_items mi where mi.menu_id = r.menu_id)
       and p.category_id not in (
         select c.id from public.categories c
         where c.slug in ('gopher','cheesecake','cocktail','ice_coffee','v60','matcha',
                          'pancake','waffle','crepe','milkshake','frappe','smoothie'));
  end loop;
end
$mig$;

select c.slug, c.name_ar, c.emoji, c.image_url,
       (select count(*) from public.products p where p.category_id = c.id) as products
from public.categories c order by c.sort_order, c.id;