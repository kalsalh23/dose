import { eur, timeOnly } from './utils';

/* ============================================================
   WhatsApp — طبقة إرسال قابلة للاستبدال
   المرحلة الحالية: Deep Link (wa.me)
   المرحلة المتقدمة: WhatsApp Business API عبر Edge Function
   التبديل مستقبلًا = توفير مزود جديد بنفس الواجهة فقط
   ============================================================ */

export interface WhatsAppOrder {
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  fulfillmentType: 'pickup' | 'delivery';
  items: { name: string; qty: number; unitPriceCents: number }[];
  totalCents: number;
  totalPoints: number;
  mapUrl?: string | null;
  createdAt: string;
  currencySymbol?: string;
}

export function buildOrderMessage(o: WhatsAppOrder): string {
  const cur = o.currencySymbol ?? '€';
  const lines: string[] = [];
  lines.push('☕ طلب جديد — Dose Cafe', '');
  lines.push(`🔢 رقم الطلب: #${o.orderNumber}`, '');
  lines.push('👤 العميل:', o.customerName, '');
  lines.push('📱 الهاتف:', o.customerPhone, '');
  lines.push('📦 نوع الطلب:', o.fulfillmentType === 'delivery' ? '🚚 توصيل' : '🏪 استلام من المحل', '');
  lines.push('🛒 الطلب:');
  for (const it of o.items) lines.push(`• ${it.name} × ${it.qty} — ${eur(it.unitPriceCents, cur)}`);
  lines.push('', '💰 الإجمالي:', eur(o.totalCents, cur), '');
  lines.push('⭐ النقاط:', `${o.totalPoints} نقاط`);
  if (o.fulfillmentType === 'delivery' && o.mapUrl) {
    lines.push('', '📍 موقع العميل:', o.mapUrl);
  }
  lines.push('', '🕐 وقت الطلب:', timeOnly(o.createdAt));
  return lines.join('\n');
}

export interface WhatsAppProvider {
  readonly name: 'deeplink' | 'business-api';
  send(number: string, message: string): boolean;
}

/** المرحلة الأولى — Deep Link */
const deepLinkProvider: WhatsAppProvider = {
  name: 'deeplink',
  send(number, message) {
    const url = `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    const w = window.open(url, '_blank');
    return !!w;
  },
};

/** المرحلة المتقدمة — WhatsApp Business API (جاهزة للتفعيل عبر Edge Function) */
const businessApiProvider: WhatsAppProvider = {
  name: 'business-api',
  send: async (number, message) => {
    const res = await fetch('/api/whatsapp-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: number, message }),
    });
    return res.ok;
  },
};

export const whatsapp: WhatsAppProvider = deepLinkProvider;
export const waChatLink = (number: string, text = '') =>
  `https://wa.me/${number.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
