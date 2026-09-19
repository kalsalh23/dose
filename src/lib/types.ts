export interface Category { id: number; slug: string; name_ar: string; emoji: string; sort_order: number }
export interface Product {
  id: number; category_id: number; category: string; name_ar: string; name_en: string;
  description_ar: string; price_cents: number; points: number; image_url: string; sort_order: number;
}
export interface Reward { id: number; name_ar: string; name_en: string; image_url: string; points_cost: number; sort_order: number }
export interface Ad {
  id: number; image_url: string; title: string; description_ar: string;
  old_price_cents: number | null; new_price_cents: number | null; discount_percent: number | null; full_screen: boolean;
}
export interface Catalog {
  categories: Category[]; products: Product[]; rewards: Reward[]; ads: Ad[];
  settings: Record<string, string>;
}
export interface AppCustomer {
  id: string; full_name: string; phone: string; points: number; orders_count: number;
}
export interface Session { token: string; customer: AppCustomer }
export interface OrderItem { name_ar: string; qty: number; unit_price_cents: number }
export interface MyOrder {
  id: string; order_number: number; status: string; fulfillment_type: 'pickup' | 'delivery';
  total_cents: number; total_points: number; created_at: string; items: OrderItem[];
}
export interface AppNotification { id: number; title: string; body: string; kind: string; is_read: boolean; created_at: string }
export interface Redemption { code: string; reward_name: string; points_cost: number; status: 'unused' | 'used' | 'expired'; created_at: string }
export interface MyData { customer: AppCustomer | null; orders: MyOrder[]; redemptions: Redemption[]; notifications: AppNotification[] }
export interface CartLine { product: Product; qty: number }
