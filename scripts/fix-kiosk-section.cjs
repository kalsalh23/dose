const fs = require('fs');
let t = fs.readFileSync('src/admin/AdminApp.tsx', 'utf8');

// Find the section to replace
const startIdx = t.indexOf('{/* طلبات الك shack');
if (startIdx < 0) {
  console.error('Could not find kiosk list section');
  process.exit(1);
}

// Find the end - the footer note after the section
const footerIdx = t.indexOf('<p className="rounded-xl bg-[#EEF2DC]', startIdx);
if (footerIdx < 0) {
  console.error('Could not find footer note');
  process.exit(1);
}

// Read the replacement content from a separate file
const replacement = fs.readFileSync('scripts/kiosk-section-replacement.txt', 'utf8');

// Replace from start to footer
t = t.substring(0, startIdx) + replacement + '\n\n          ' + t.substring(footerIdx);

fs.writeFileSync('src/admin/AdminApp.tsx', t);
console.log('Done, file size:', t.length);