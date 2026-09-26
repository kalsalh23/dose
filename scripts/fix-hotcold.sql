-- فصل المنتجات القديمة المعطلة عن الطلبات السابقة ثم حذفها وتنشيط الجديدة
update public.order_items set product_id = null
where product_id in (
  select p.id from public.products p
  join public.categories c on c.id = p.category_id
  where p.is_active = false and c.slug in ('hot','cold')
);

delete from public.products
where is_active = false and category_id in (
  select id from public.categories where slug in ('hot','cold')
);

update public.products set is_active = true
where category_id in (select id from public.categories where slug in ('hot','cold'));

select c.slug, c.name_ar, count(p.id) as cnt
from public.products p
join public.categories c on c.id = p.category_id
where p.is_active and c.slug in ('hot','cold')
group by c.slug, c.name_ar;
