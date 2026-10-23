export interface Category { id: number; slug: string; name_ar: string; emoji: string; sort_order: number }
export interface Product {
  id: number; category_id: number; category: string; name_ar: string; name_en: string;
  description_ar: string; price_cents: number; points: number; image_url: string; sort_order: number; options?: string;
  is_available?: boolean;
  sale_price_cents?: number | null;
  eta_minutes?: number | null;
}
export interface Reward { id: number; name_ar: string; name_en: string; image_url: string; points_cost: number; sort_order: number; expires_at?: string | null; is_active?: boolean; redemption_days?: number | null }
export type AdditionPriceMode = 'add' | 'subtract';
export interface Addition { id: number; name_ar: string; price_cents: number; product_ids: number[]; price_mode?: AdditionPriceMode }
export interface PickedAddition { id: number; name_ar: string; price_cents: number; price_mode?: AdditionPriceMode }
export interface Ad {
  id: number; image_url: string; title: string; description_ar: string;
  old_price_cents: number | null; new_price_cents: number | null; discount_percent: number | null; full_screen: boolean; show_in_hero?: boolean;
  popup_after_2min?: boolean;
  category_slug?: string | null;
}
export interface PopularProduct { id: number; name_ar: string; name_en: string; price_cents: number; sale_price_cents?: number | null; points: number; image_url: string; sold_qty?: number; order_count?: number }
export interface MenuList {
  id: number; title: string; subtitle: string; image_url: string; emoji: string; sort_order: number;
  items: Product[];
}
export interface HeroSettings {
  hero_title?: string;
  hero_subtitle?: string;
  hero_image_url?: string;
  hero_active?: boolean;
}
export interface Catalog {
  categories: Category[]; products: Product[]; rewards: Reward[]; ads: Ad[];
  best_sellers?: PopularProduct[]; most_ordered?: PopularProduct[]; additions?: Addition[];
  menus?: MenuList[];
  hero?: HeroSettings;
  settings: Record<string, string>;
}
export interface AppCustomer {
  id: string; full_name: string; phone: string; points: number; orders_count: number; avatar_url?: string; points_expires_at?: string;
}
export interface Session { token: string; customer: AppCustomer }
export interface OrderItem {
  name_ar: string; qty: number; unit_price_cents: number;
  options?: string | null; additions?: any[] | null; eta_minutes?: number | null;
}
export interface MyOrder {
  id: string; order_number: number; status: string; fulfillment_type: 'pickup' | 'delivery';
  total_cents: number; total_points: number; created_at: string; items: OrderItem[];
  completed_at?: string | null; points_awarded?: boolean;
  source?: string | null; customer_name?: string | null;
  customer_phone?: string | null; delivery_map_url?: string | null;
  estimated_delivery_at?: string | null; eta_minutes?: number | null;
}
export interface AppNotification { id: number; title: string; body: string; kind: string; is_read: boolean; created_at: string }
export interface Redemption { code: string; reward_name: string; points_cost: number; status: 'unused' | 'used' | 'expired'; created_at: string; expires_at?: string | null; reward_expires_at?: string | null }
export interface MyData { customer: AppCustomer | null; favorites: (Product & { created_at: string })[]; orders: MyOrder[]; redemptions: Redemption[]; notifications: AppNotification[] }
export interface CartLine { product: Product; qty: number; options?: string[]; additions?: PickedAddition[] }
