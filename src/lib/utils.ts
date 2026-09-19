export const eur = (cents: number, symbol = '€') =>
  (cents / 100).toFixed(2) + symbol;

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
