-- دمج الفئات إلى 6: مشروبات ساخنة، مشروبات باردة، ماتشا وشاي، مشروبات فريش، موهيتو، حلويات
-- كل منتج ينتقل لفئته الصحيحة، والإضافات تُوقف

insert into public.categories (slug, name_ar, emoji, sort_order) values
  ('hot_drinks','مشروبات ساخنة','☕',1),
  ('cold_drinks','مشروبات باردة','🧊',2),
  ('matcha_tea','ماتشا وشاي','🍵',3),
  ('fresh','مشروبات فريش','🥤',4)
on conflict (slug) do nothing;

-- نقل المنتجات لفئاتها الجديدة
update public.products set category_id = (select id from public.categories where slug='hot_drinks')
where category_id in (select id from public.categories where slug in ('hot','hotdrinks'));

update public.products set category_id = (select id from public.categories where slug='cold_drinks')
where category_id in (select id from public.categories where slug='cold');

update public.products set category_id = (select id from public.categories where slug='matcha_tea')
where category_id in (select id from public.categories where slug in ('matcha','icetea'));

update public.products set category_id = (select id from public.categories where slug='fresh')
where category_id in (select id from public.categories where slug in ('juices','smoothie','special'));

-- تحديث أسماء موهيتو وحلويات (التصنيفان موجودان)
update public.categories set name_ar='موهيتو', emoji='🍹', sort_order=5 where slug='mojito';
update public.categories set name_ar='حلويات', emoji='🍰', sort_order=6 where slug='dessert';

-- إيقاف الإضافات (ليست ضمن الفئات الست)
update public.products set is_active = false
where category_id in (select id from public.categories where slug='extras');

-- حذف التصنيفات القديمة الفارغة
delete from public.categories where slug in ('hot','hotdrinks','cold','matcha','icetea','juices','smoothie','special','extras');

-- النتيجة
select c.slug, c.name_ar, count(p.id) as cnt
from public.products p
join public.categories c on c.id = p.category_id
where p.is_active
group by c.slug, c.name_ar, c.sort_order
order by c.sort_order;
