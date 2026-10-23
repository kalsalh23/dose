import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const fail = (m) => { console.error('MISSING: ' + m); process.exit(1); };
let out = `-- دفعة التعديلات: إضافات مدفوعة + اسم/هاتف الطلب + صلاحية 10 أيام + جاري التوصيل + حذف المكافآت نهائيًا\n\n`;

/* ============ 1) الإضافات: جداول + دوال الإدارة + الكتالوج ============ */
out += `-- (1) الإضافات المدفوعة
create table if not exists public.additions (
  id serial primary key,
  name_ar text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  is_active boolean not null default true
);
create table if not exists public.addition_products (
  addition_id integer not null references public.additions(id) on delete cascade,
  product_id integer not null references public.products(id) on delete cascade,
  primary key (addition_id, product_id)
);
alter table public.order_items add column if not exists additions jsonb not null default '[]';

drop function if exists public.admin_list_additions(uuid);
create or replace function public.admin_list_additions(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  return coalesce(jsonb_agg(x order by x.id), '[]'::jsonb) from (
    select a.id, a.name_ar, a.price_cents, a.is_active,
           (select coalesce(jsonb_agg(ap.product_id), '[]'::jsonb) from public.addition_products ap where ap.addition_id = a.id) as product_ids
    from public.additions a) x where public._valid_admin(p_token);
end $$;
grant execute on function public.admin_list_additions(uuid) to anon;

drop function if exists public.admin_save_addition(uuid, jsonb);
create or replace function public.admin_save_addition(p_token uuid, p_addition jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare aid int; pid int;
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  if btrim(coalesce(p_addition->>'name_ar','')) = '' then raise exception 'invalid_name'; end if;
  if (p_addition->>'id')::int > 0 then
    update public.additions set
      name_ar = btrim(p_addition->>'name_ar'),
      price_cents = greatest(0, coalesce((p_addition->>'price_cents')::int, 0)),
      is_active = coalesce((p_addition->>'is_active')::boolean, true)
    where id = (p_addition->>'id')::int
    returning id into aid;
    if aid is null then raise exception 'not_found'; end if;
    delete from public.addition_products where addition_id = aid;
  else
    insert into public.additions (name_ar, price_cents, is_active)
    values (btrim(p_addition->>'name_ar'), greatest(0, coalesce((p_addition->>'price_cents')::int, 0)),
            coalesce((p_addition->>'is_active')::boolean, true))
    returning id into aid;
  end if;
  for pid in select j::int from jsonb_array_elements_text(coalesce(p_addition->'product_ids', '[]'::jsonb)) j loop
    insert into public.addition_products (addition_id, product_id) values (aid, pid)
    on conflict do nothing;
  end loop;
  return jsonb_build_object('ok', true, 'id', aid);
end $$;
grant execute on function public.admin_save_addition(uuid, jsonb) to anon;

drop function if exists public.admin_delete_addition(uuid, int);
create or replace function public.admin_delete_addition(p_token uuid, p_addition_id int)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  delete from public.additions where id = p_addition_id;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.admin_delete_addition(uuid, int) to anon;

`;

/* ============ 2) get_catalog: إضافة الإضافات ============ */
let cat = readFileSync(join(here, 'fix-promo-all-scope.sql'), 'utf8'); // ليس الكتالوج — الكتالوج من category-ads-sale
cat = readFileSync(join(here, 'category-ads-sale.sql'), 'utf8');
const catAnchor = `    'settings', (select jsonb_object_agg(key, value) from public.settings)`;
if (!cat.includes(catAnchor)) fail('catalog settings anchor');
cat = cat.replace(catAnchor, `    'additions', (select coalesce(jsonb_agg(x order by x.id), '[]'::jsonb) from (
        select a.id, a.name_ar, a.price_cents,
               (select coalesce(jsonb_agg(ap.product_id), '[]'::jsonb) from public.addition_products ap where ap.addition_id = a.id) as product_ids
        from public.additions a where a.is_active) x),
${catAnchor}`);
cat = cat.replace(`-- إعلانات موجّهة للفئات + سعر عرض لكل منتج (يُمشَّط القديم ويُبرز الجديد بشارة «عرض»)
`, `-- (تحديث) get_catalog مع الإضافات
`);
// استخراج دالة get_catalog فقط من الملف
const catStart = cat.indexOf('create or replace function public.get_catalog()');
const catEnd = cat.indexOf('grant execute on function public.get_catalog() to anon;');
if (catStart < 0 || catEnd < 0) fail('catalog bounds');
out += cat.slice(catStart, catEnd) + 'grant execute on function public.get_catalog() to anon;\n\n';

/* ============ 3) create_order: الإضافات + الاسم/الهاتف ============ */
let ord = readFileSync(join(here, 'fix-promo-all-scope.sql'), 'utf8');
const ordStart = ord.indexOf('drop function if exists public.create_order');
const ordEnd = ord.indexOf('grant execute on function public.create_order(uuid, text, text, jsonb, double precision, double precision, text, text, text) to anon;');
if (ordStart < 0 || ordEnd < 0) fail('order bounds');
let o = ord.slice(ordStart, ordEnd);

// 3أ) توقيع جديد (11 معامل)
o = o.replace(
  `drop function if exists public.create_order(uuid, text, text, jsonb, double precision, double precision, text, text, text);
create or replace function public.create_order(
  p_customer_id uuid,
  p_pin text,
  p_fulfillment_type text,
  p_items jsonb,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_map_url text default null,
  p_source text default 'kiosk',
  p_reward_code text default null
)`,
  `drop function if exists public.create_order(uuid, text, text, jsonb, double precision, double precision, text, text, text);
drop function if exists public.create_order(uuid, text, text, jsonb, double precision, double precision, text, text, text, text, text);
create or replace function public.create_order(
  p_customer_id uuid,
  p_pin text,
  p_fulfillment_type text,
  p_items jsonb,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_map_url text default null,
  p_source text default 'kiosk',
  p_reward_code text default null,
  p_customer_name text default null,
  p_customer_phone text default null
)`);

// 3ب) تصريحات الإضافات
o = o.replace(
  `  v_promo_pct int := 0; v_promo_subtotal int := 0; pc text; psc text; ptg text; ptg_cat int;`,
  `  v_promo_pct int := 0; v_promo_subtotal int := 0; pc text; psc text; ptg text; ptg_cat int;
  v_add_json jsonb := '[]'::jsonb; a jsonb; aid int; aname text; aprice int;`);

// 3ج) حساب الإضافات داخل حلقة الأصناف
const itemLoopOld = `    v_total := v_total + coalesce(prod.sale_price_cents, prod.price_cents) * v_qty;
    v_points := v_points + prod.points * v_qty;
    v_count := v_count + v_qty;`;
if (!o.includes(itemLoopOld)) fail('order item loop');
o = o.replace(itemLoopOld, `    v_total := v_total + coalesce(prod.sale_price_cents, prod.price_cents) * v_qty;
    v_points := v_points + prod.points * v_qty;
    v_count := v_count + v_qty;
    -- الإضافات المدفوعة: تحقق من تفعيلها وارتباطها بالمنتج ثم تسعيرها
    v_add_json := '[]'::jsonb;
    if jsonb_typeof(it->'additions') = 'array' then
      for a in select * from jsonb_array_elements(it->'additions') loop
        aid := null; aname := null; aprice := null;
        select ad.id, ad.name_ar, ad.price_cents into aid, aname, aprice
        from public.additions ad
        join public.addition_products ap on ap.addition_id = ad.id
        where ad.id = (a::text)::int and ad.is_active and ap.product_id = prod.id;
        if aid is not null then
          v_total := v_total + aprice * v_qty;
          v_add_json := v_add_json || jsonb_build_object('id', aid, 'name_ar', aname, 'price_cents', aprice);
        end if;
      end loop;
    end if;`);

// 3د) تخزين الإضافات في بنود الطلب
const itemsInsOld = `    insert into public.order_items (order_id, product_id, name_ar, name_en, unit_price_cents, qty, points, options)
    values (o.id, prod.id, prod.name_ar, prod.name_en, coalesce(prod.sale_price_cents, prod.price_cents), (it->>'qty')::int, prod.points, coalesce(it->>'options',''));`;
if (!o.includes(itemsInsOld)) fail('order items insert');
o = o.replace(itemsInsOld, `    insert into public.order_items (order_id, product_id, name_ar, name_en, unit_price_cents, qty, points, options, additions)
    values (o.id, prod.id, prod.name_ar, prod.name_en, coalesce(prod.sale_price_cents, prod.price_cents), (it->>'qty')::int, prod.points, coalesce(it->>'options',''), v_add_json);`);

// 3هـ) حفظ الاسم/الهاتف مع الطلب
const insOld = `  insert into public.orders (customer_id, fulfillment_type, delivery_latitude, delivery_longitude, delivery_map_url, total_cents, total_points, source)
  values (c.id, p_fulfillment_type, p_latitude, p_longitude, p_map_url, v_total, v_points, p_source)
  returning * into o;`;
if (!o.includes(insOld)) fail('orders insert');
o = o.replace(insOld, `  insert into public.orders (customer_id, fulfillment_type, delivery_latitude, delivery_longitude, delivery_map_url, total_cents, total_points, source, customer_name, customer_phone)
  values (c.id, p_fulfillment_type, p_latitude, p_longitude, p_map_url, v_total, v_points, p_source,
          coalesce(btrim(p_customer_name), c.full_name), coalesce(btrim(p_customer_phone), c.phone))
  returning * into o;`);

// 3و) إرجاع الاسم/الهاتف الفعليين
const retOld = `    'customer_name', c.full_name, 'customer_phone', c.phone,`;
if (!o.includes(retOld)) fail('order return');
o = o.replace(retOld, `    'customer_name', coalesce(btrim(p_customer_name), c.full_name), 'customer_phone', coalesce(btrim(p_customer_phone), c.phone),`);

out += o + 'grant execute on function public.create_order(uuid, text, text, jsonb, double precision, double precision, text, text, text, text, text) to anon;\n\n';

/* ============ 4) admin_set_order_status: جاري التوصيل ============ */
let st = readFileSync(join(here, 'sales-status-fn.sql'), 'utf8');
const stStart = st.indexOf('drop function if exists public.admin_set_order_status');
const stEnd = st.indexOf('grant execute on function public.admin_set_order_status(uuid, uuid, text) to anon;');
if (stStart < 0 || stEnd < 0) fail('status bounds');
let s = st.slice(stStart, stEnd);
s = s.replace(`if p_status not in ('pending','confirmed','preparing','ready','completed','cancelled') then raise exception 'invalid_status'; end if;`,
  `if p_status not in ('pending','confirmed','preparing','ready','out_for_delivery','completed','cancelled') then raise exception 'invalid_status'; end if;`);
s = s.replace(`'ready','☕ طلبك جاهز','completed','✅ تم إكمال طلبك','cancelled','❌ تم إلغاء طلبك');`,
  `'ready','☕ طلبك جاهز','out_for_delivery','🛵 طلبك في الطريق إليك!','completed','✅ تم إكمال طلبك','cancelled','❌ تم إلغاء طلبك');`);
out += s + 'grant execute on function public.admin_set_order_status(uuid, uuid, text) to anon;\n\n';

/* ============ 5) المكافآت: 10 أيام + حذف نهائي ============ */
let red = readFileSync(join(here, 'live-redeem_reward.txt'), 'utf8');
if (!red.includes(`interval '7 days'`)) fail('redeem 7 days');
red = red.replace(`interval '7 days'`, `interval '10 days'`);
out += `drop function if exists public.redeem_reward(uuid, integer);
create or replace function public.redeem_reward(p_token uuid, p_reward_id integer)
returns jsonb language plpgsql security definer set search_path = public as $$
${red}
$$;
grant execute on function public.redeem_reward(uuid, integer) to anon;

`;

let chk = readFileSync(join(here, 'fix-composite-null.sql'), 'utf8');
const chkStart = chk.indexOf('create or replace function public.check_reward_code(p_code text)');
const chkEnd = chk.indexOf('grant execute on function public.check_reward_code(text) to anon;');
if (chkStart < 0 || chkEnd < 0) fail('check bounds');
let c = chk.slice(chkStart, chkEnd);
c = c.replace(`'انتهت صلاحية الرمز (أسبوع)'`, `'انتهت صلاحية الرمز (10 أيام)'`);
out += c + 'grant execute on function public.check_reward_code(text) to anon;\n\n';

out += `-- حذف مكافأة نهائيًا مع فك الارتباطات
alter table public.reward_redemptions alter column reward_id drop not null;
alter table public.points_transactions alter column reward_id drop not null;
drop function if exists public.admin_delete_reward(uuid, integer);
create or replace function public.admin_delete_reward(p_token uuid, p_reward_id integer)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._valid_admin(p_token) then raise exception 'unauthorized'; end if;
  update public.reward_redemptions set reward_id = null where reward_id = p_reward_id;
  update public.points_transactions set reward_id = null where reward_id = p_reward_id;
  delete from public.rewards where id = p_reward_id;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.admin_delete_reward(uuid, integer) to anon;

`;

/* ============ 6) admin_list_orders: الاسم/الهاتف الفعليان ============ */
let lst = readFileSync(join(here, 'live-admin_list_orders.txt'), 'utf8');
lst = lst.replace(`c.full_name as customer_name, c.phone as customer_phone,`,
  `coalesce(o.customer_name, c.full_name) as customer_name, coalesce(o.customer_phone, c.phone) as customer_phone,`);
out += `create or replace function public.admin_list_orders(p_token uuid, p_limit int default 50)
returns jsonb language sql stable security definer set search_path = public as $$
${lst}
$$;
grant execute on function public.admin_list_orders(uuid, int) to anon;

-- أعمدة اسم/هاتف الطلب
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists customer_phone text;
`;

writeFileSync(join(here, 'batch8.sql'), out);
console.log('batch8.sql ready:', out.length, 'chars');
