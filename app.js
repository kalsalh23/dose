'use strict';

/* ============================================================
   Dose Coffee & More — Kiosk App Logic (واجهة كشك بلا جلسات)
   التدفق: اكتب اسمك ← اختر من الاقتراحات ← اطلب الآن ← PIN ← عودة للحالة الطبيعية
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

/* ---------- الحالة (لا جلسات ولا تخزين أسماء) ---------- */
const state = {
  cat: 'hot',
  cart: new Map(),   // productId -> qty
  customer: null,    // {id, name} اختيار الاسم للطلب الحالي فقط
  pinEntry: '',
  busy: false,
};
const DEVICE_KEY = 'dose_device_v1';

/* ---------- عناصر ---------- */
const $ = id => document.getElementById(id);
const grid = $('grid'), catsEl = $('cats'), cartChips = $('cartChips'), cartMeta = $('cartMeta');
const sendBtn = $('sendBtn');
const acct = $('acct'), accountBtn = $('accountBtn');
const nameSearch = $('nameSearch'), suggestEl = $('suggest');
const selectedName = $('selectedName'), selectedNameVal = $('selectedNameVal');
const searchField = document.querySelector('.search-field');
const pinOverlay = $('pinOverlay'), pinDisplay = $('pinDisplay'), pinErr = $('pinErr');
const pinConfirm = $('pinConfirm'), pinSummary = $('pinSummary'), pinModal = pinOverlay.querySelector('.modal');
const doneOverlay = $('doneOverlay');
const toasts = $('toasts');

/* ---------- أدوات ---------- */
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

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

function itemsWord(n) {
  if (n === 1) return 'صنف واحد';
  if (n === 2) return 'صنفان';
  if (n <= 10) return n + ' أصناف';
  return n + ' صنفًا';
}

/* ---------- لوح الحساب (يسار) ---------- */
function isNarrow() { return window.matchMedia('(max-width:1080px)').matches; }

function showAccount(view) {
  acct.dataset.state = view;
  if (isNarrow()) document.body.classList.add('acct-open');
}
function closeAccountOverlay() {
  if (isNarrow()) document.body.classList.remove('acct-open');
}

accountBtn.addEventListener('click', () => {
  if (state.customer) { deselectCustomer(); }
  showAccount('signup');
});
$('cancelSignup').addEventListener('click', () => {
  acct.dataset.state = 'lookup';
  closeAccountOverlay();
});

/* ---------- المنتجات ---------- */
function renderProducts() {
  const list = PRODUCTS.filter(p => p.cat === state.cat);
  grid.innerHTML = list.map((p, i) => `
    <article class="card" data-add="${p.id}" style="--d:${i * 40}ms" role="button" tabindex="0" aria-label="أضف ${p.ar} إلى الطلب">
      <div class="card-img">
        <img src="${p.img}" alt="${p.ar}" loading="lazy"
             onerror="this.closest('.card-img').classList.add('noimg')">
        <span class="qty-badge hidden" data-qty="${p.id}"></span>
      </div>
      <div class="card-body">
        <div class="card-title">
          <h3>${p.ar}</h3>
          <span class="latin">${p.en}</span>
        </div>
      </div>
    </article>
  `).join('');
  updateCardStates();
}

/* مزامنة شارات الكمية وحالة التحديد على البطاقات */
function updateCardStates() {
  grid.querySelectorAll('.card').forEach(card => {
    const id = card.dataset.add;
    const qty = state.cart.get(id) || 0;
    card.classList.toggle('selected', qty > 0);
    const badge = card.querySelector('.qty-badge');
    if (badge) {
      badge.textContent = '×' + qty;
      badge.classList.toggle('hidden', qty === 0);
    }
  });
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
  const { items, count } = cartItems();
  if (!items.length) {
    cartChips.innerHTML = '<span class="cart-empty-hint">اضغط على أي منتج لإضافته إلى طلبك</span>';
    cartMeta.innerHTML = '';
    sendBtn.disabled = true;
    sendBtn.dataset.disabled = '1';
    updateCardStates();
    return;
  }
  sendBtn.disabled = false;
  sendBtn.dataset.disabled = '0';
  cartChips.innerHTML = items.map(it => `
    <span class="chip">${it.product_ar}<b>×${it.qty}</b>
      <button data-dec="${it.product_en}" aria-label="إنقاص ${it.product_ar}">×</button>
    </span>`).join('') +
    (count > 1 ? '<button class="chip" data-clear="1" style="color:var(--faint)">تفريغ الطلب</button>' : '');
  cartMeta.textContent = itemsWord(count) + ' في طلبك';
  updateCardStates();
}

grid.addEventListener('click', e => {
  const card = e.target.closest('.card[data-add]');
  if (!card) return;
  const id = card.dataset.add;
  state.cart.set(id, (state.cart.get(id) || 0) + 1);
  card.style.transform = 'scale(.965)';
  setTimeout(() => card.style.transform = '', 140);
  renderCart();
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

/* ---------- البحث عن الاسم والاقتراحات ---------- */
let searchTimer = null;

function renderSuggest(res) {
  if (res === 'idle')   { suggestEl.innerHTML = '<p class="sug-hint">ابدأ بكتابة أول حروف اسمك…</p>'; return; }
  if (res === 'loading'){ suggestEl.innerHTML = '<p class="sug-hint">جارٍ البحث…</p>'; return; }
  if (res === 'empty')  { suggestEl.innerHTML = '<p class="sug-hint">لا يوجد اسم مطابق — إن لم تكن مسجلًا اضغط «لا أملك حساب» بالأعلى</p>'; return; }
  if (res === 'error')  { suggestEl.innerHTML = '<p class="sug-hint">تعذر البحث، تحقق من الإنترنت وحاول مجددًا</p>'; return; }
  suggestEl.innerHTML = res.rows.map(r =>
    `<button type="button" class="sug-item" data-cid="${r.id}"><span>${esc(r.full_name)}</span><small>${esc(r.mask || '')}</small></button>`
  ).join('');
}

nameSearch.addEventListener('input', () => {
  const q = nameSearch.value.trim();
  clearTimeout(searchTimer);
  if (q.length < 2) { renderSuggest('idle'); return; }
  renderSuggest('loading');
  searchTimer = setTimeout(async () => {
    try {
      const data = await rpc('search_customers', { p_query: q });
      const rows = Array.isArray(data) ? data : (data ? [data] : []);
      renderSuggest(rows.length ? { rows } : 'empty');
    } catch (err) {
      renderSuggest(err && err.friendly ? 'error' : 'error');
    }
  }, 260);
});

suggestEl.addEventListener('click', e => {
  const b = e.target.closest('.sug-item');
  if (!b) return;
  selectCustomer(b.dataset.cid, b.querySelector('span').textContent.trim());
});

function selectCustomer(id, name) {
  state.customer = { id, name };
  selectedNameVal.textContent = name;
  searchField.classList.add('hidden');
  suggestEl.classList.add('hidden');
  selectedName.classList.remove('hidden');
  $('pinWho').textContent = 'أدخل رمز PIN الخاص باسم ' + name + ' لتأكيد طلبك';
  toast('مرحبًا ' + name + ' — اختر منتجاتك واضغط «اطلب الآن»', 'ok');
}

function deselectCustomer() {
  state.customer = null;
  selectedName.classList.add('hidden');
  searchField.classList.remove('hidden');
  suggestEl.classList.remove('hidden');
  nameSearch.value = '';
  renderSuggest('idle');
}

$('changeName').addEventListener('click', deselectCustomer);

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
    await rpc('create_customer', {
      p_full_name: name,
      p_phone: phone,
      p_pin_hash: pinHash,
      p_device_id: getDeviceId(),
    });
    form.reset();
    acct.dataset.state = 'lookup';
    closeAccountOverlay();
    renderSuggest('idle');
    toast('تم إنشاء حسابك بنجاح — اكتب اسمك الآن واطلب', 'ok');
  } catch (err) {
    const m = (err && err.message) || '';
    if (err && err.friendly) $('signupErr').textContent = err.message;
    else if (m.includes('phone_exists')) $('signupErr').textContent = 'هذا الرقم مسجّل مسبقًا — اكتب اسمك في البطاقة واطلب مباشرة';
    else if (m.includes('Failed to fetch') || m.includes('network')) $('signupErr').textContent = 'تعذر الاتصال بالخدمة، تأكد من الإنترنت وحاول مجددًا';
    else $('signupErr').textContent = 'حدث خطأ غير متوقع، حاول مجددًا';
  } finally {
    state.busy = false;
    setBtnLoading(btn, false);
  }
});

/* ---------- إرسال الطلب ---------- */
sendBtn.addEventListener('click', () => {
  const { items } = cartItems();
  if (!items.length) { toast('أضف منتجات إلى طلبك أولًا'); return; }
  if (!state.customer) {
    toast('اختر اسمك أولًا من البطاقة اليسرى');
    showAccount('lookup');
    acct.classList.add('pulse');
    setTimeout(() => acct.classList.remove('pulse'), 2400);
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
  const { items } = cartItems();
  pinSummary.textContent = 'طلبك: ' + items.map(i => `${i.product_ar} ×${i.qty}`).join('، ');
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

    const v = await rpc('verify_pin_by_id', { p_customer_id: state.customer.id, p_pin: state.pinEntry });
    const row = Array.isArray(v) ? v[0] : v;
    if (!row || !row.id) throw { wrongPin: true };

    const o = await rpc('create_order', {
      p_customer_id: state.customer.id,
      p_items: items,
      p_total_points: total,
    });

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

/* ---------- شاشة النجاح ثم العودة للحالة الطبيعية ---------- */
function showDone(order) {
  $('doneRef').textContent = 'طلب رقم #' + order.order_number;
  $('donePoints').textContent = '+' + order.earned + ' نقطة';
  doneOverlay.classList.remove('hidden');
}

$('newOrderBtn').addEventListener('click', () => {
  doneOverlay.classList.add('hidden');
  resetKiosk();
});

function resetKiosk() {
  state.cart.clear();
  renderCart();
  deselectCustomer();
  acct.dataset.state = 'lookup';
  closeAccountOverlay();
  document.querySelector('.products-scroll').scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- الإقلاع ---------- */
renderProducts();
renderCart();
renderSuggest('idle');
