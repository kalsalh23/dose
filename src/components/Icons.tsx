/* أيقونات SVG احترافية — نمط Lucide (خط واحد، سماكة 1.7) */
import type { CSSProperties, ReactNode } from 'react';

export type IconName =
  | 'home' | 'star' | 'receipt' | 'bell' | 'user' | 'coffee' | 'snow' | 'cake' | 'plus'
  | 'flame' | 'gift' | 'headset' | 'logout' | 'pin' | 'settings' | 'megaphone' | 'users'
  | 'package' | 'clipboard' | 'chart' | 'lock' | 'check' | 'x' | 'search' | 'phone'
  | 'instagram' | 'tiktok' | 'clock' | 'chevron' | 'eye' | 'trash' | 'edit' | 'info'
  | 'store' | 'facebook' | 'globe';

const PATHS: Record<IconName, ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 10v10h14V10" /></>,
  star: <path d="M12 3l2.7 5.5 6 .9-4.3 4.3 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.4l6-.9L12 3z" />,
  receipt: <><path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3z" /><path d="M9 8h6M9 12h6" /></>,
  bell: <><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></>,
  coffee: <><path d="M4 9h12v5.5A5.5 5.5 0 0 1 10.5 20h-1A5.5 5.5 0 0 1 4 14.5V9Z" /><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" /><path d="M8 3.5c0 1-1 1.5-1 2.5M12 3.5c0 1-1 1.5-1 2.5" /></>,
  snow: <><path d="M12 2v20M4.2 6.5l15.6 11M19.8 6.5l-15.6 11" /><path d="M12 5.5 9.8 3.8M12 5.5l2.2-1.7M12 18.5l-2.2 1.7M12 18.5l2.2 1.7" /></>,
  cake: <><path d="M4 20h16" /><path d="M5.5 20v-5.5a3.5 3.5 0 0 1 3.5-3.5h6a3.5 3.5 0 0 1 3.5 3.5V20" /><path d="M12 11V8.5" /><path d="M12 5.2c.9.9.9 1.9 0 2.6-.9-.7-.9-1.7 0-2.6Z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  flame: <><path d="M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-1.8.8-3.4 1.8-4.8C9.8 8.6 12 3 12 3Z" /><path d="M12 17a2.5 2.5 0 0 0 2.5-2.5c0-1.4-1.3-2.6-2.5-4-1.2 1.4-2.5 2.6-2.5 4A2.5 2.5 0 0 0 12 17Z" /></>,
  gift: <><path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8" /><path d="M2 7h20v5H2z" /><path d="M12 7v14" /><path d="M12 7s-1.5-4-4-4a2 2 0 0 0 0 4h4Zm0 0s1.5-4 4-4a2 2 0 0 1 0 4h-4Z" /></>,
  headset: <><path d="M4 14v-1a8 8 0 0 1 16 0v1" /><path d="M4 14v3a2 2 0 0 0 2 2h1v-5H4Zm16 0v3a2 2 0 0 1-2 2h-1v-5h3Z" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  pin: <><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
  settings: <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>,
  megaphone: <><path d="m3 11 18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  package: <><path d="M21 8V6a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 6v12a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 18v-5" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>,
  clipboard: <><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" /><path d="M9 2h6v4H9z" /><path d="M9 12h6M9 16h4" /></>,
  chart: <><path d="M3 3v18h18" /><path d="M7 15v3M12 9v9M17 5v13" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  check: <path d="M5 13l4.2 4.2L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.8-3.8" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
  instagram: <><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /><circle cx="12" cy="12" r="3.8" /><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" /></>,
  tiktok: <><path d="M13.5 3v11.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M13.5 3c.5 2.5 2.2 4.3 5 4.5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  chevron: <path d="m14 6-6 6 6 6" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6" /><path d="M10 11v6M14 11v6" /></>,
  edit: <><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 8v.5M12 11v5" /></>,
  store: <><path d="M3 9.5 4.6 4h14.8L21 9.5" /><path d="M3 9.5h18" /><path d="M4.5 9.5V20h15V9.5" /><path d="M9.5 20v-5.5h5V20" /><path d="M3 13.5c1.6 0 3-1.2 3-2.7 0 1.5 1.4 2.7 3 2.7s3-1.2 3-2.7c0 1.5 1.4 2.7 3 2.7s3-1.2 3-2.7" /></>,
  facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
};

export function Icon({ name, size = 20, className = '', filled = false, strokeWidth = 1.7, style }: {
  name: IconName; size?: number; className?: string; filled?: boolean; strokeWidth?: number; style?: CSSProperties;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
