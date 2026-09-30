/** عرض المبالغ — الليرة السورية بدون كسور، والعملات الأعشار بالصيغة القديمة */
export const eur = (cents: number, symbol = '€') => {
  if (symbol === 'ل.س') return cents.toLocaleString('en-US') + ' ل.س';
  return (cents / 100).toFixed(2) + symbol;
};

export const timeOnly = (iso: string) =>
  new Date(iso).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit', hour12: false });

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ar-SY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

export const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'قيد المراجعة', color: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'مؤكد', color: 'bg-blue-100 text-blue-800' },
  preparing: { label: 'قيد التحضير', color: 'bg-orange-100 text-orange-800' },
  ready: { label: 'جاهز', color: 'bg-emerald-100 text-emerald-800' },
  completed: { label: 'مكتمل', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700' },
};

export const deviceId = (() => {
  let d = localStorage.getItem('dose_device');
  if (!d) {
    d = (crypto.randomUUID && crypto.randomUUID()) || 'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    localStorage.setItem('dose_device', d);
  }
  return d;
})();

export async function getCurrentLocation(): Promise<{ lat: number; lng: number; mapUrl: string }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('المتصفح لا يدعم تحديد الموقع'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        resolve({ lat, lng, mapUrl: `https://maps.google.com/?q=${lat},${lng}` });
      },
      () => reject(new Error('تعذر الحصول على موقعك — تأكد من السماح بالوصول للموقع')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  });
}

/** تحويل مفتاح VAPID من Base64-URL إلى Uint8Array لاشتراك الإشعارات */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** تاريخ بصيغة رقمية فقط: 10/2/2026 */
export const fmtDateNum = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

/** حالة الدوام الآن (بتوقيت دمشق UTC+3) من إعدادات work_open / work_close */
export function shopStatus(settings?: Record<string, string>): { closed: boolean; open: string; close: string } {
  const open = settings?.work_open ?? '';
  const close = settings?.work_close ?? '';
  if (!open || !close || !/^\d{1,2}:\d{2}$/.test(open) || !/^\d{1,2}:\d{2}$/.test(close))
    return { closed: false, open, close };
  const now = new Date();
  const local = new Date(now.getTime() + (3 * 60 + now.getTimezoneOffset()) * 60000);
  const t = local.getHours() * 60 + local.getMinutes();
  const [oh, om] = open.split(':').map(Number);
  const [ch, cm] = close.split(':').map(Number);
  const o = oh * 60 + om, c = ch * 60 + cm;
  const closed = o <= c ? (t < o || t >= c) : (t < o && t >= c);
  return { closed, open, close };
}
