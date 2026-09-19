'use strict';

/* ============================================================
   Dose Coffee & More — Kiosk App Logic
   ============================================================ */

const SUPABASE_URL = 'https://mqstsxuscqbxnyejhixk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xc3RzeHVzY3FieG55ZWpoaXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjAwMDksImV4cCI6MjEwNTMzNjAwOX0.1Em6nTniOf3xgQWQxBf0N6h_3WZqBHba5C17i7LJ5K0';

/* تهيئة آمنة — لو فشل تحميل المكتبة تبقى الواجهة تعمل ورسائل الشبكة تظهر بلطف */
let sb = null;
try {
  if (window.supabase) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) { console.warn('Supabase init failed:', e); }

async function rpc(fn, params) {
  if (!sb) throw { friendly: true, message: 'تعذر الاتصال بالخدمة، حدّث الصفحة وتأكد من الإنترنت' };
  const { data, error } = await sb.rpc(fn, params);
  if (error) throw error;
  return data;
}

/* ---------- بيانات القائمة ---------- */
const PRODUCTS = [
  { id:'americano',          ar:'أمريكانو',        en:'Americano',          points:4, cat:'hot' },
  { id:'latte',              ar:'لاتيه',           en:'Latte',              points:5, cat:'hot' },
  { id:'cappuccino',         ar:'كابتشينو',        en:'Cappuccino',         points:4, cat:'hot' },
  { id:'mocha',              ar:'موكا',            en:'Mocha',              points:6, cat:'hot' },
  { id:'espresso',           ar:'إسبريسو',         en:'Espresso',           points:2, cat:'hot' },
  { id:'macchiato',          ar:'ماكياتو',         en:'Macchiato',          points:3, cat:'hot' },
  { id:'caramel-macchiato',  ar:'كراميل ماكياتو',  en:'Caramel Macchiato',  points:5, cat:'hot' },
  { id:'iced-latte',         ar:'آيس لاتيه',       en:'Iced Latte',         points:7, cat:'cold' },
  { id:'iced-mocha',         ar:'آيس موكا',        en:'Iced Mocha',         points:7, cat:'cold' },
  { id:'chocolate-cake',     ar:'كيك الشوكولاتة',  en:'Chocolate Cake',     points:5, cat:'dessert' },
  { id:'vanilla-cake',       ar:'كيك الفانيليا',   en:'Vanilla Cake',       points:4, cat:'dessert' },
  { id:'cookies',            ar:'كوكيز',           en:'Cookies',            points:3, cat:'dessert' },
];
PRODUCTS.forEach(p => p.img = 'assets/img/' + p.id + '.jpg');

const STAR_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95L12 2.6z"/></svg>';
const PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" width="20" height="20" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

/* ---------- الحالة ---------- */
const state = {
  cat: 'hot',
  cart: new Map(),   // productId -> qty
  customer: null,    // {id, name, phone, points}
  pinEntry: '',
  busy: false,
};
const SESSION_KEY = 'dose_session_v1';
const DEVICE_KEY  = 'dose_device_v1';

/* ---------- عناصر ---------- */
const $ = id => document.getElementById(id);
const grid = $('grid'), catsEl = $('cats'), cartChips = $('cartChips'), cartMeta = $('cartMeta');
const cartbar = $('cartbar'), sendBtn = $('sendBtn');
const acct = $('acct'), accountBtn = $('accountBtn'), userChip = $('userChip');
const pinOverlay = $('pinOverlay'), pinDisplay = $('pinDisplay'), pinErr = $('pinErr');
const pinConfirm = $('pinConfirm'), pinSummary = $('pinSummary'), pinModal = pinOverlay.querySelector('.modal');
const doneOverlay = $('doneOverlay');
const toasts = $('toasts');

/* ---------- أدوات ---------- */
function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' t-' + type : '');
  t.textContent = msg;
  toasts.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 350); }, 3200);
}

function getDeviceId() {
  let d = localStorage.getItem(DEVICE_KEY);
  if (!d) {
    d = (crypto.randomUUID && crypto.randomUUID()) || 'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    localStorage.setItem(DEVICE_KEY, d);
  }
  return d;
}

async function hashPin(phone, pin) {
  const data = new TextEncoder().encode(phone.trim() + ':' + pin);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function setBtnLoading(btn, on) {
  btn.classList.toggle('loading', on);
  btn.disabled = on ? true : btn.dataset.disabled === '1';
}

/* ---------- الجلسة ---------- */
function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (s && s.id && s.phone) state.customer = s;
  } catch (_) {}
}
function saveSession() { localStorage.setItem(SESSION_KEY, JSON.stringify(state.customer)); }
function clearSession() { localStorage.removeItem(SESSION_KEY); state.customer = null; }

/* ---------- واجهة الشريط العلوي ---------- */
function updateTopbar() {
  const c = state.customer;
  userChip.classList.toggle('hidden', !c);
  accountBtn.classList.toggle('hidden', !!c);
  if (c) {
    $('chipAvatar').textContent = c.name.trim().charAt(0) || 'م';
    $('chipName').textContent = c.name;
    $('chipPoints').textContent = c.points;
  }
}

/* ---------- لوح الحساب ---------- */
function isNarrow() { return window.matchMedia('(max-width:1080px)').matches; }

function showAccount(view) {
  acct.dataset.state = view;
  if (isNarrow()) {
    document.body.classList.add('acct-open');
  }
}
function closeAccountOverlay() {
  if (isNarrow()) document.body.classList.remove('acct-open');
}

accountBtn.addEventListener('click', () => showAccount(state.customer ? 'home' : 'signup'));
userChip.addEventListener('click', () => showAccount('home'));
$('openSignup').addEventListener('click', () => showAccount('signup'));
$('cancelSignup').addEventListener('click', () => {
  acct.dataset.state = 'welcome';
  closeAccountOverlay();
});
$('signOut').addEventListener('click', () => {
  clearSession();
  updateTopbar();
  acct.dataset.state = 'welcome';
  closeAccountOverlay();
  toast('تم تسجيل الخروج، نراك قريبًا في Dose');
});
window.addEventListener('resize', () => { if (!isNarrow()) document.body.classList.remove('acct-open'); });

/* ---------- المنتجات ---------- */
function renderProducts() {
  const list = PRODUCTS.filter(p => p.cat === state.cat);
  grid.innerHTML = list.map((p, i) => `
    <article class="card" style="--d:${i * 45}ms">
      <div class="card-img">
        <img src="${p.img}" alt="${p.ar}" loading="lazy"
             onerror="this.closest('.card-img').classList.add('noimg')">
      </div>
      <div class="card-body">
        <div class="card-title">
          <h3>${p.ar}</h3>
          <span class="latin">${p.en}</span>
        </div>
        <div class="card-foot">
          <span class="points-pill">${STAR_SVG}<span>${p.points} نقاط</span></span>
          <button class="add-btn" data-add="${p.id}" aria-label="أضف ${p.ar} إلى الطلب">${PLUS_SVG}</button>
        </div>
      </div>
    </article>
  `).join('');
}

catsEl.addEventListener('click', e => {
  const btn = e.target.closest('.cat');
  if (!btn) return;
  state.cat = btn.dataset.cat;
  catsEl.querySelectorAll('.cat').forEach(b => {
    const on = b === btn;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
  });
  renderProducts();
});

/* ---------- السلة ---------- */
function cartItems() {
  const items = [];
  let total = 0, count = 0;
  for (const [id, qty] of state.cart) {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p) continue;
    items.push({ product_ar: p.ar, product_en: p.en, qty, points: p.points });
    total += p.points * qty;
    count += qty;
  }
  return { items, total, count };
}

function renderCart() {
  const { items, total, count } = cartItems();
  if (!items.length) {
    cartChips.innerHTML = '<span class="cart-empty-hint">لم تضف أي منتجات بعد — اختر من القائمة واضغط «+»</span>';
    cartMeta.innerHTML = '';
    sendBtn.disabled = true;
    sendBtn.dataset.disabled = '1';
    return;
  }
  sendBtn.disabled = false;
  sendBtn.dataset.disabled = '0';
  cartChips.innerHTML = items.map(it => `
    <span class="chip">${it.product_ar}<b>×${it.qty}</b>
      <button data-dec="${it.product_en}" aria-label="إنقاص ${it.product_ar}">×</button>
    </span>`).join('') +
    (count > 1 ? '<button class="chip" data-clear="1" style="color:var(--faint)">تفريغ الطلب</button>' : '');
  cartMeta.innerHTML = `المجموع: <b>${total} نقطة</b> ستُضاف إلى رصيدك`;
}

grid.addEventListener('click', e => {
  const btn = e.target.closest('[data-add]');
  if (!btn) return;
  const id = btn.dataset.add;
  state.cart.set(id, (state.cart.get(id) || 0) + 1);
  renderCart();
  cartbar.style.transform = 'scale(1.012)';
  setTimeout(() => cartbar.style.transform = '', 160);
});

cartChips.addEventListener('click', e => {
  const dec = e.target.closest('[data-dec]');
  if (dec) {
    const pid = PRODUCTS.find(p => p.en === dec.dataset.dec)?.id;
    if (pid) {
      const q = (state.cart.get(pid) || 0) - 1;
      if (q <= 0) state.cart.delete(pid); else state.cart.set(pid, q);
      renderCart();
    }
    return;
  }
  if (e.target.closest('[data-clear]')) {
    state.cart.clear();
    renderCart();
  }
});

/* ---------- إنشاء الحساب ---------- */
const form = $('signupForm');
const fields = { name: $('fullName'), phone: $('phone'), pin: $('pin'), pin2: $('pin2') };

function setFieldErr(key, msg) {
  const el = form.querySelector(`[data-err="${key}"]`);
  if (el) el.textContent = msg || '';
  if (fields[key]) fields[key].classList.toggle('err-state', !!msg);
}

['name', 'phone'].forEach(k => fields[k].addEventListener('input', () => setFieldErr(k, '')));
fields.pin.addEventListener('input', () => {
  fields.pin.value = fields.pin.value.replace(/\D/g, '').slice(0, 4);
  setFieldErr('pin', '');
});
fields.pin2.addEventListener('input', () => {
  fields.pin2.value = fields.pin2.value.replace(/\D/g, '').slice(0, 4);
  setFieldErr('pin', '');
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (state.busy) return;
  $('signupErr').textContent = '';

  const name = fields.name.value.trim();
  const phone = fields.phone.value.replace(/\D/g, '');
  const pin = fields.pin.value, pin2 = fields.pin2.value;
  let bad = false;

  if (name.length < 2) { setFieldErr('name', 'فضلًا أدخل اسمك الكامل'); bad = true; }
  if (phone.length < 8 || phone.length > 15) { setFieldErr('phone', 'أدخل رقم هاتف صحيح (8 أرقام على الأقل)'); bad = true; }
  if (pin.length !== 4) { setFieldErr('pin', 'رمز PIN يجب أن يكون 4 أرقام'); bad = true; }
  else if (pin !== pin2) { setFieldErr('pin', 'رمزا PIN غير متطابقين'); bad = true; }
  if (bad) return;

  const btn = $('signupBtn');
  state.busy = true;
  setBtnLoading(btn, true);
  try {
    const pinHash = await hashPin(phone, pin);
    const data = await rpc('create_customer', {
      p_full_name: name,
      p_phone: phone,
      p_pin_hash: pinHash,
      p_device_id: getDeviceId(),
    });

    state.customer = { id: data.id, name: data.full_name, phone: data.phone, points: data.points || 0 };
    saveSession();
    updateTopbar();
    renderHome();
    acct.dataset.state = 'home';
    closeAccountOverlay();
    form.reset();
    toast('تم إنشاء حسابك بنجاح، أهلًا بك في Dose', 'ok');
  } catch (err) {
    const m = (err && err.message) || '';
    if (err && err.friendly) $('signupErr').textContent = err.message;
    else if (m.includes('phone_exists')) $('signupErr').textContent = 'هذا الرقم مسجّل مسبقًا — تواصل مع الباريستا للمساعدة';
    else if (m.includes('Failed to fetch') || m.includes('network')) $('signupErr').textContent = 'تعذر الاتصال بالخدمة، تأكد من الإنترنت وحاول مجددًا';
    else $('signupErr').textContent = 'حدث خطأ غير متوقع، حاول مجددًا';
  } finally {
    state.busy = false;
    setBtnLoading(btn, false);
  }
});

function renderHome() {
  const c = state.customer;
  if (!c) return;
  $('homeName').textContent = c.name.split(' ')[0];
  $('homePoints').textContent = c.points;
  $('homeAvatar').textContent = c.name.trim().charAt(0) || 'م';
  $('chipPoints').textContent = c.points;
}

/* ---------- إرسال الطلب ---------- */
sendBtn.addEventListener('click', () => {
  const { items } = cartItems();
  if (!items.length) { toast('أضف منتجات إلى طلبك أولًا'); return; }
  if (!state.customer) {
    toast('أنشئ حسابك أولًا لإرسال الطلب');
    showAccount('signup');
    accountBtn.classList.add('pulse');
    setTimeout(() => accountBtn.classList.remove('pulse'), 2400);
    return;
  }
  openPinModal();
});

/* ---------- نافذة PIN ---------- */
const pdots = pinDisplay.querySelectorAll('.pdot');

function openPinModal() {
  state.pinEntry = '';
  pinErr.textContent = '';
  updatePinDots();
  const { items, total } = cartItems();
  pinSummary.innerHTML = 'طلبك: ' + items.map(i => `${i.product_ar} ×${i.qty}`).join('، ') +
    ` — ستكسب <b>${total} نقطة</b>`;
  pinConfirm.disabled = true;
  pinConfirm.dataset.disabled = '1';
  pinOverlay.classList.remove('hidden');
}
function closePinModal() {
  pinOverlay.classList.add('hidden');
  state.pinEntry = '';
}
function updatePinDots() {
  pdots.forEach((d, i) => {
    d.classList.toggle('on', i < state.pinEntry.length);
    d.classList.toggle('active', i === state.pinEntry.length);
  });
  const ok = state.pinEntry.length === 4 && !state.busy;
  pinConfirm.disabled = !ok;
  pinConfirm.dataset.disabled = ok ? '0' : '1';
}

$('pinClose').addEventListener('click', closePinModal);
pinOverlay.addEventListener('click', e => { if (e.target === pinOverlay) closePinModal(); });

$('keypad').addEventListener('click', e => {
  const btn = e.target.closest('button[data-k]');
  if (!btn || state.busy) return;
  const k = btn.dataset.k;
  if (k === 'back') state.pinEntry = state.pinEntry.slice(0, -1);
  else if (k === 'clear') state.pinEntry = '';
  else if (state.pinEntry.length < 4) state.pinEntry += k;
  pinErr.textContent = '';
  updatePinDots();
});

document.addEventListener('keydown', e => {
  if (pinOverlay.classList.contains('hidden')) return;
  if (/^[0-9]$/.test(e.key) && state.pinEntry.length < 4) { state.pinEntry += e.key; updatePinDots(); }
  else if (e.key === 'Backspace') { state.pinEntry = state.pinEntry.slice(0, -1); updatePinDots(); }
  else if (e.key === 'Escape') closePinModal();
});

pinConfirm.addEventListener('click', async () => {
  if (state.busy || state.pinEntry.length !== 4) return;
  state.busy = true;
  setBtnLoading(pinConfirm, true);
  pinErr.textContent = '';
  try {
    const { items, total } = cartItems();
    const pinHash = await hashPin(state.customer.phone, state.pinEntry);

    const v = await rpc('verify_customer', { p_phone: state.customer.phone, p_pin_hash: pinHash });
    if (!v || (Array.isArray(v) ? v.length === 0 : !v.id)) {
      throw { wrongPin: true };
    }

    const o = await rpc('create_order', {
      p_customer_id: state.customer.id,
      p_items: items,
      p_total_points: total,
    });

    state.customer.points = o.balance;
    saveSession();
    updateTopbar();
    renderHome();
    closePinModal();
    showDone(o);
  } catch (err) {
    if (err && err.wrongPin) {
      pinErr.textContent = 'رمز PIN غير صحيح، حاول مجددًا';
      pinModal.classList.remove('shake');
      void pinModal.offsetWidth;
      pinModal.classList.add('shake');
      state.pinEntry = '';
      updatePinDots();
    } else {
      pinErr.textContent = '';
      closePinModal();
      toast((err && err.friendly) ? err.message : 'تعذر إرسال الطلب، تأكد من الإنترنت وحاول مجددًا', 'err');
    }
  } finally {
    state.busy = false;
    setBtnLoading(pinConfirm, false);
  }
});

/* ---------- شاشة النجاح ---------- */
function showDone(order) {
  $('doneRef').textContent = 'طلب رقم #' + order.order_number;
  $('donePoints').textContent = '+' + order.earned + ' نقطة';
  $('doneBalance').textContent = 'رصيدك الحالي: ' + order.balance + ' نقطة';
  doneOverlay.classList.remove('hidden');
}

$('newOrderBtn').addEventListener('click', () => {
  doneOverlay.classList.add('hidden');
  state.cart.clear();
  renderCart();
  acct.dataset.state = 'home';
  document.querySelector('.products-scroll').scrollTo({ top: 0, behavior: 'smooth' });
});

/* ---------- الإقلاع ---------- */
loadSession();
renderProducts();
renderCart();
updateTopbar();
if (state.customer) renderHome();
acct.dataset.state = state.customer ? 'home' : 'welcome';
