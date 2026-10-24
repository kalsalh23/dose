const fs = require('fs');
const f = 'src/admin/AdminApp.tsx';
let t = fs.readFileSync(f, 'utf8');

// Debug: find the grid line
const gridIdx = t.indexOf('md:grid-cols-4');
console.log('grid-cols-4 found at:', gridIdx);
if (gridIdx >= 0) {
  console.log('Context:', JSON.stringify(t.substring(gridIdx - 30, gridIdx + 50)));
}

// Check orders card end
const ordersIdx = t.indexOf('خلال {num(data.totals?.days)} يوم');
console.log('orders card found at:', ordersIdx);
if (ordersIdx >= 0) {
  console.log('Context:', JSON.stringify(t.substring(ordersIdx, ordersIdx + 200)));
}