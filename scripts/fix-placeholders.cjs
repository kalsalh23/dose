const fs = require('fs');
let t = fs.readFileSync('src/admin/AdminApp.tsx', 'utf8');

// Find the empty state text
const idx = t.indexOf('لا توجد طلبات');
if (idx >= 0) {
  const endIdx = t.indexOf('</td>', idx);
  const oldText = t.substring(idx, endIdx + 5);
  console.log('Old empty:', JSON.stringify(oldText));
  
  // Replace with clean text
  const newText = 'لا توجد طلبات من ك shack في هذه الفترة</td>';
  t = t.replace(oldText, newText);
  console.log('Empty replaced');
}

fs.writeFileSync('src/admin/AdminApp.tsx', t);
console.log('Done');