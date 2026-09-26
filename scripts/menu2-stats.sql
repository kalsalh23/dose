select c.slug, c.name_ar, count(p.id) as cnt
from public.products p
join public.categories c on c.id = p.category_id
where p.is_active
group by c.slug, c.name_ar, c.sort_order
order by c.sort_order;
