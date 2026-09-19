import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://mqstsxuscqbxnyejhixk.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xc3RzeHVzY3FieG55ZWpoaXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjAwMDksImV4cCI6MjEwNTMzNjAwOX0.1Em6nTniOf3xgQWQxBf0N6h_3WZqBHba5C17i7LJ5K0';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** استدعاء دالة Supabase RPC مع ترجمة الأخطاء */
export async function rpc<T = any>(fn: string, args: Record<string, any> = {}): Promise<T> {
  const { data, error } = await sb.rpc(fn, args);
  if (error) {
    const m = error.message || '';
    if (m.includes('phone_exists')) throw new Error('هذا الرقم مسجّل مسبقًا');
    if (m.includes('wrong_pin')) throw new Error('رمز PIN غير صحيح، حاول مرة أخرى');
    if (m.includes('pin_locked')) throw new Error('تم قفل المحاولات مؤقتًا — انتظر 5 دقائق ثم أعد المحاولة');
    if (m.includes('insufficient_points')) throw new Error('نقاطك غير كافية لهذه المكافأة');
    if (m.includes('bad_credentials')) throw new Error('بيانات الدخول غير صحيحة');
    if (m.includes('location_required')) throw new Error('نحتاج إلى موقعك لإتمام طلب التوصيل');
    if (m.includes('Failed to fetch') || m.includes('network'))
      throw new Error('تعذر الاتصال بالخدمة — تأكد من الإنترنت وحاول مجددًا');
    throw new Error('حدث خطأ غير متوقع، حاول مجددًا');
  }
  return data as T;
}
