// إعادة كتابة كتلة navItems داخل patch-six.mjs بالكامل
import { readFileSync, writeFileSync } from 'node:fs';

let s = readFileSync('scripts/patch-six.mjs', 'utf8');
const start = s.indexOf('const oldNavItems = ');
const endMarker = "s = s.replace(oldNavItems, newNavItems);";
const end = s.indexOf(endMarker);
if (start < 0 || end < 0) { console.error('navItems chunk not found'); process.exit(1); }

const chunk = `const oldNavItems = \`  const navItems: { to: string; icon: IconName; label: string; end?: boolean }[] = [
    { to: '/', icon: 'home', label: 'الرئيسية', end: true },
    { to: '/rewards', icon: 'star', label: 'النقاط' },
    { to: '/orders', icon: 'receipt', label: 'الطلبات' },
    { to: '/notifications', icon: 'bell', label: 'الإشعارات' },
  ]\`;
if (!s.includes(oldNavItems)) fail('navItems');
const newNavItems = \`  const navItems: { to: string; icon: IconName; label: string; end?: boolean }[] = [
    { to: '/', icon: 'home', label: 'الرئيسية', end: true },
    { to: '/favorites', icon: 'heart', label: 'المفضلة' },
    { to: '/rewards', icon: 'star', label: 'النقاط' },
    { to: '/orders', icon: 'receipt', label: 'الطلبات' },
  ]\`;
s = s.replace(oldNavItems, newNavItems);`;

s = s.slice(0, start) + chunk + s.slice(end + endMarker.length);
writeFileSync('scripts/patch-six.mjs', s);
console.log('navItems chunk rewritten');
