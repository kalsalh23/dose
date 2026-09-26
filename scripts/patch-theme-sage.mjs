// تحديث ثيم الألوان في index.css + الخلفية + manifest
import { readFileSync, writeFileSync } from 'node:fs';

let css = readFileSync('src/index.css', 'utf8').replace(/\r\n/g, '\n');

const theme = `@theme {
  --font-sans: "Tajawal", "Cairo", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-serif: "Playfair Display", Georgia, serif;

  --color-coffee-950: #1E2416;
  --color-coffee-900: #2A3223;
  --color-coffee-800: #37422C;
  --color-coffee-700: #414D36;
  --color-cream: #F1F4E3;
  --color-beige: #D5DEB4;
  --color-gold: #A9B87F;
  --color-gold-deep: #7C8F52;

  --color-sand: #DCE3C3;
  --color-mauve: #8A9471;
  --color-sage: #C9D3A8;
  --color-taupe: #414D36;

  /* هوية Dose — أخضر ميرمية فاتح + زيتوني داكن (مطابقة للمنيو) */
  --color-fresh-50: #F0F4E4;
  --color-fresh-100: #DCE3C3;
  --color-fresh-200: #C4CF9E;
  --color-fresh-300: #A9B87F;
  --color-fresh-500: #7C8F52;
  --color-fresh-600: #5C6B3C;
  --color-fresh-700: #414D36;
  --color-fresh-900: #2A3223;
  --color-fresh-ink: #26301C;
}`;

const start = css.indexOf('@theme {');
const end = css.indexOf('}', css.indexOf('--color-fresh-ink')) + 1;
if (start < 0) { console.error('theme block missing'); process.exit(1); }
css = css.slice(0, start) + theme + css.slice(end);

css = css.replace(
  /body \{[^}]+\}/,
  `body {
  font-family: var(--font-sans);
  background: linear-gradient(180deg, #E9EDD6, #DCE3C3);
  color: #26301C;
  -webkit-font-smoothing: antialiased;
  overscroll-behavior-y: none;
}`
);

writeFileSync('src/index.css', css);

// manifest
let m = readFileSync('public/manifest.webmanifest', 'utf8');
m = m.split('"background_color": "#F4EDE1"').join('"background_color": "#E9EDD6"');
m = m.split('"theme_color": "#2A1C10"').join('"theme_color": "#414D36"');
writeFileSync('public/manifest.webmanifest', m);

// index.html theme-color
let h = readFileSync('index.html', 'utf8');
h = h.split('content="#2A1C10"').join('content="#414D36"');
writeFileSync('index.html', h);

console.log('theme + manifest + html updated to sage/olive');
