-- تحصين فحص الاقتراب: قيم موقع تالفة لا تكسر الدالة (ترد سببًا واضحًا بدل الخطأ)
-- + تصحيح قيمة خط العرض التالفة المحفوظة من زر GPS
update public.settings set value = '35.133024' where key = 'shop_lat' and value = '35.13302435.133024';

create or replace function public.check_geo_proximity(p_token uuid, p_lat double precision, p_lng double precision)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  vc public.customers;
  v_lat text; v_lng text; v_msg text;
  sl double precision; sn double precision; rad double precision;
  dist_m double precision;
  recent int;
  v_title text; v_body text;
begin
  select c.* into vc from public.customers c
    join public.customer_sessions s on s.customer_id = c.id
  where s.token = p_token;
  if vc is null then raise exception 'unauthorized'; end if;
  if p_lat is null or p_lng is null then
    return jsonb_build_object('notified', false, 'reason', 'no_position');
  end if;

  v_lat := public._get_setting('shop_lat', '');
  v_lng := public._get_setting('shop_lng', '');
  -- تحقق صارم من صيغة الإحداثيات — قيمة تالفة من اللوحة لا تكسر النظام
  if v_lat !~ '^-?\d{1,2}(\.\d+)?$' or v_lng !~ '^-?\d{1,3}(\.\d+)?$' then
    return jsonb_build_object('notified', false, 'reason', 'bad_shop_location');
  end if;
  begin
    sl := v_lat::double precision;
    sn := v_lng::double precision;
  exception when others then
    return jsonb_build_object('notified', false, 'reason', 'bad_shop_location');
  end;
  if sl < -90 or sl > 90 or sn < -180 or sn > 180 then
    return jsonb_build_object('notified', false, 'reason', 'bad_shop_location');
  end if;
  rad := coalesce(nullif(public._get_setting('geo_radius', ''), '')::double precision, 500);
  if rad is null or rad <= 0 or rad > 10000 then rad := 500; end if;

  -- المسافة بالهافرسين (متر)
  dist_m := 6371000 * 2 * asin(sqrt(
    power(sin(radians(sn - p_lng) / 2), 2) +
    cos(radians(p_lat)) * cos(radians(sl)) * power(sin(radians(sl - p_lat) / 2), 2)
  ));

  if dist_m > rad then
    return jsonb_build_object('notified', false, 'distance_m', round(dist_m)::int);
  end if;

  -- تهدئة: إشعار واحد كل 3 ساعات كحد أقصى
  select count(*) into recent from public.notifications
  where customer_id = vc.id and kind = 'geo' and created_at > now() - interval '3 hours';
  if recent > 0 then
    return jsonb_build_object('notified', false, 'reason', 'cooldown', 'distance_m', round(dist_m)::int);
  end if;

  v_title := '📍 Dose Cafe على خطوات منك!';
  v_msg := btrim(public._get_setting('geo_message', ''));
  if v_msg = '' then
    v_msg := 'خطوات قليلة تفصلك عن راحتك… على بعد {مسافة} متر فقط، فنجانك يتحضّر على ذوقك والحلويات طازجة تنتظرك ☕🥐 تعال دلّل حالك اليوم ✨';
  end if;
  v_body := replace(v_msg, '{مسافة}', round(dist_m)::int::text);

  insert into public.notifications (customer_id, title, body, kind)
  values (vc.id, v_title, v_body, 'geo');

  begin
    perform net.http_post(
      url := 'https://mqstsxuscqbxnyejhixk.supabase.co/functions/v1/push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer anon'),
      body := jsonb_build_object('customer_id', vc.id, 'title', v_title, 'body', v_body));
  exception when others then null;
  end;

  return jsonb_build_object('notified', true, 'distance_m', round(dist_m)::int);
end $$;
grant execute on function public.check_geo_proximity(uuid, double precision, double precision) to anon;
