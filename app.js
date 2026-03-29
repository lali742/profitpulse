/* ============================================
   ProfitPulse — App Logic
   ============================================ */

// ── State ──
let products = [];
let confirmCallback = null;
let sortDirection = { column: null, asc: true };

const CATEGORIES = ['Marketing', 'Shipping', 'Packaging', 'Storage', 'Other'];
const CAT_COLORS = {
  Marketing: '#6C5CE7',
  Shipping: '#00B894',
  Packaging: '#FDCB6E',
  Storage: '#74B9FF',
  Other: '#A29BFE'
};

// ── Persistence ──
function save() {
  localStorage.setItem('profitpulse_products', JSON.stringify(products));
}

function load() {
  try {
    const data = localStorage.getItem('profitpulse_products');
    products = data ? JSON.parse(data) : [];
  } catch {
    products = [];
  }
}

// ── Utilities ──
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  let str;
  if (abs >= 10000000) str = (n / 10000000).toFixed(2) + 'Cr';
  else if (abs >= 100000) str = (n / 100000).toFixed(2) + 'L';
  else if (abs >= 1000) str = n.toLocaleString('en-IN');
  else str = n.toFixed(abs % 1 !== 0 ? 2 : 0);
  return '₹' + str;
}

function fmtShort(n) {
  if (n === undefined || n === null || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr';
  if (abs >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
  if (abs >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K';
  return '₹' + n.toFixed(0);
}

function pct(v) {
  if (!isFinite(v) || isNaN(v)) return '0%';
  return v.toFixed(1) + '%';
}

// ── Calculations ──
function calcProduct(p) {
  const totalSpend = (p.spendItems || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const gross = (Number(p.revenue) || 0) - (Number(p.cogs) || 0);
  const net = gross - totalSpend;
  const margin = (Number(p.revenue) || 0) > 0 ? (net / p.revenue) * 100 : 0;
  return { totalSpend, gross, net, margin };
}

function calcTotals() {
  let revenue = 0, cogs = 0, spend = 0;
  products.forEach(p => {
    revenue += Number(p.revenue) || 0;
    cogs += Number(p.cogs) || 0;
    spend += calcProduct(p).totalSpend;
  });
  const gross = revenue - cogs;
  const net = gross - spend;
  const margin = revenue > 0 ? (net / revenue) * 100 : 0;
  return { revenue, cogs, gross, spend, net, margin };
}

// ── Toast ──
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

// ── Navigation ──
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelector(`[data-view="${name}"]`).classList.add('active');

  // Show FAB only on products tab
  const fab = document.getElementById('fab-add-product');
  if (fab) fab.style.display = name === 'products' ? 'flex' : 'none';

  // Refresh view
  if (name === 'overview') renderOverview();
  else if (name === 'products') renderProducts();
  else if (name === 'analysis') renderAnalysis();
}

// ── Modals ──
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function showConfirm(msg, cb) {
  document.getElementById('confirm-message').textContent = msg;
  confirmCallback = cb;
  openModal('modal-confirm');
}

// ── RENDER: Overview ──
function renderOverview() {
  const t = calcTotals();

  // Update summary cards with animation
  animateValue('val-revenue', t.revenue);
  animateValue('val-cogs', t.cogs);
  animateValue('val-gross', t.gross);
  animateValue('val-spend', t.spend);
  animateValue('val-net', t.net);
  document.getElementById('val-margin').textContent = pct(t.margin);

  // Dynamic coloring for net & margin
  ['card-net', 'card-margin'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('positive', 'negative');
    el.classList.add(t.net >= 0 ? 'positive' : 'negative');
  });

  renderRankingChart();
  renderCategoryBars();
}

function animateValue(elementId, value) {
  const el = document.getElementById(elementId);
  el.textContent = fmt(value);
  el.classList.remove('pulse');
  void el.offsetWidth; // trigger reflow
  el.classList.add('pulse');
}

// ── RENDER: Product Ranking Chart ──
function renderRankingChart() {
  const canvas = document.getElementById('canvas-ranking');
  const empty = document.getElementById('ranking-empty');

  if (products.length === 0) {
    canvas.style.display = 'none';
    empty.classList.remove('hidden');
    return;
  }
  canvas.style.display = 'block';
  empty.classList.add('hidden');

  const ctx = canvas.getContext('2d');
  const container = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;

  const sorted = products.map(p => ({
    name: p.name,
    net: calcProduct(p).net
  })).sort((a, b) => b.net - a.net);

  const barH = 32;
  const gap = 8;
  const labelW = 90;
  const valueW = 70;
  const padTop = 8;
  const padBottom = 8;
  const totalH = padTop + sorted.length * (barH + gap) - gap + padBottom;

  canvas.style.height = totalH + 'px';
  canvas.width = container.clientWidth * dpr;
  canvas.height = totalH * dpr;
  ctx.scale(dpr, dpr);

  const w = container.clientWidth;
  const maxAbs = Math.max(...sorted.map(s => Math.abs(s.net)), 1);
  const barArea = w - labelW - valueW - 12;

  sorted.forEach((item, i) => {
    const y = padTop + i * (barH + gap);
    const barW = (Math.abs(item.net) / maxAbs) * barArea;
    const isPos = item.net >= 0;

    // Label
    ctx.fillStyle = '#9594B0';
    ctx.font = '500 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const displayName = item.name.length > 10 ? item.name.slice(0, 10) + '…' : item.name;
    ctx.fillText(displayName, 4, y + barH / 2);

    // Bar
    const radius = 6;
    const bx = labelW;
    const by = y + 4;
    const bh = barH - 8;
    const bw = Math.max(barW, 4);

    ctx.fillStyle = isPos ? '#00B894' : '#FF6B6B';
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, radius);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, radius);
    ctx.strokeStyle = isPos ? '#00B894' : '#FF6B6B';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Fill bar with gradient-like effect
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = isPos ? '#00B894' : '#FF6B6B';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, radius);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Value
    ctx.fillStyle = isPos ? '#00B894' : '#FF6B6B';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(fmtShort(item.net), bx + bw + 8, y + barH / 2);
  });
}

// ── RENDER: Category Spend Bars ──
function renderCategoryBars() {
  const canvas = document.getElementById('canvas-category-bars');
  const empty = document.getElementById('category-empty');

  const catTotals = {};
  CATEGORIES.forEach(c => catTotals[c] = 0);
  products.forEach(p => {
    (p.spendItems || []).forEach(si => {
      catTotals[si.category] = (catTotals[si.category] || 0) + (Number(si.amount) || 0);
    });
  });

  const hasData = Object.values(catTotals).some(v => v > 0);
  if (!hasData) {
    canvas.style.display = 'none';
    empty.classList.remove('hidden');
    return;
  }
  canvas.style.display = 'block';
  empty.classList.add('hidden');

  const ctx = canvas.getContext('2d');
  const container = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;

  const barH = 32;
  const gap = 8;
  const labelW = 85;
  const valueW = 70;
  const padTop = 8;
  const padBottom = 8;
  const totalH = padTop + CATEGORIES.length * (barH + gap) - gap + padBottom;

  canvas.style.height = totalH + 'px';
  canvas.width = container.clientWidth * dpr;
  canvas.height = totalH * dpr;
  ctx.scale(dpr, dpr);

  const w = container.clientWidth;
  const maxVal = Math.max(...Object.values(catTotals), 1);
  const barArea = w - labelW - valueW - 12;

  CATEGORIES.forEach((cat, i) => {
    const y = padTop + i * (barH + gap);
    const val = catTotals[cat];
    const barW = Math.max((val / maxVal) * barArea, 0);
    const color = CAT_COLORS[cat];

    // Label
    ctx.fillStyle = '#9594B0';
    ctx.font = '500 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(cat, 4, y + barH / 2);

    // Bar
    if (barW > 0) {
      const radius = 6;
      const bx = labelW;
      const by = y + 4;
      const bh = barH - 8;
      const bw = Math.max(barW, 4);

      ctx.globalAlpha = 0.25;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, radius);
      ctx.fill();

      ctx.globalAlpha = 0.7;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, radius);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Value
      ctx.fillStyle = '#E8E8F0';
      ctx.font = '600 12px Inter, sans-serif';
      ctx.fillText(fmtShort(val), bx + bw + 8, y + barH / 2);
    }
  });
}

// ── RENDER: Products ──
function renderProducts() {
  const list = document.getElementById('products-list');

  if (products.length === 0) {
    list.innerHTML = `
      <div class="products-empty">
        <div class="products-empty-icon">📦</div>
        <p>No products yet.<br/>Tap + to add your first product.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = products.map(p => {
    const c = calcProduct(p);
    const isPos = c.net >= 0;
    const spendItemsHTML = (p.spendItems || []).length > 0
      ? (p.spendItems || []).map(si => `
        <div class="spend-item">
          <div class="spend-category-dot dot-${si.category.toLowerCase()}"></div>
          <div class="spend-item-info">
            <div class="spend-item-category">${si.category}</div>
            ${si.note ? `<div class="spend-item-note">${escapeHtml(si.note)}</div>` : ''}
          </div>
          <div class="spend-item-amount">${fmt(si.amount)}</div>
          <button class="spend-item-delete" onclick="deleteSpendItem('${p.id}','${si.id}')" aria-label="Delete spend item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `).join('')
      : '<p class="no-spend-items">No spend items yet</p>';

    return `
      <div class="product-card" id="product-${p.id}">
        <div class="product-card-header" onclick="toggleProduct('${p.id}')">
          <div class="product-info">
            <div class="product-name">${escapeHtml(p.name)}</div>
            <div class="product-meta">
              <span>Rev: ${fmtShort(p.revenue)}</span>
              <span>COGS: ${fmtShort(p.cogs)}</span>
            </div>
          </div>
          <span class="product-profit-badge ${isPos ? 'positive' : 'negative'}">${fmtShort(c.net)}</span>
          <div class="product-actions">
            <button onclick="event.stopPropagation(); editProduct('${p.id}')" aria-label="Edit product">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-delete" onclick="event.stopPropagation(); confirmDeleteProduct('${p.id}')" aria-label="Delete product">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
          <svg class="chevron-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="product-detail">
          <div class="product-detail-inner">
            <div class="product-stats">
              <div class="product-stat">
                <span class="stat-label">Gross</span>
                <span class="stat-value ${c.gross >= 0 ? 'positive' : 'negative'}">${fmtShort(c.gross)}</span>
              </div>
              <div class="product-stat">
                <span class="stat-label">Spend</span>
                <span class="stat-value">${fmtShort(c.totalSpend)}</span>
              </div>
              <div class="product-stat">
                <span class="stat-label">Margin</span>
                <span class="stat-value ${c.margin >= 0 ? 'positive' : 'negative'}">${pct(c.margin)}</span>
              </div>
            </div>
            <div class="spend-items-header">
              <h3>Spend Items</h3>
              <button class="btn-add-spend" onclick="openSpendModal('${p.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Spend
              </button>
            </div>
            ${spendItemsHTML}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function toggleProduct(id) {
  const card = document.getElementById('product-' + id);
  card.classList.toggle('expanded');
}

// ── PRODUCT CRUD ──
function openAddProduct() {
  document.getElementById('modal-product-title').textContent = 'Add Product';
  document.getElementById('form-product').reset();
  document.getElementById('input-product-id').value = '';
  document.getElementById('preview-gross').textContent = '₹0';
  openModal('modal-product');
  setTimeout(() => document.getElementById('input-product-name').focus(), 100);
}

function editProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  document.getElementById('modal-product-title').textContent = 'Edit Product';
  document.getElementById('input-product-name').value = p.name;
  document.getElementById('input-revenue').value = p.revenue;
  document.getElementById('input-cogs').value = p.cogs;
  document.getElementById('input-product-id').value = p.id;
  updateGrossPreview();
  openModal('modal-product');
}

function saveProduct(e) {
  e.preventDefault();
  const name = document.getElementById('input-product-name').value.trim();
  const revenue = parseFloat(document.getElementById('input-revenue').value) || 0;
  const cogs = parseFloat(document.getElementById('input-cogs').value) || 0;
  const id = document.getElementById('input-product-id').value;

  if (!name) return;

  if (id) {
    // Edit
    const p = products.find(x => x.id === id);
    if (p) {
      p.name = name;
      p.revenue = revenue;
      p.cogs = cogs;
    }
    toast('Product updated ✓');
  } else {
    // Add
    products.push({
      id: uid(),
      name,
      revenue,
      cogs,
      spendItems: []
    });
    toast('Product added ✓');
  }

  save();
  closeModal('modal-product');
  renderProducts();
}

function confirmDeleteProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  showConfirm(`Delete "${p.name}" and all its spend items?`, () => {
    products = products.filter(x => x.id !== id);
    save();
    renderProducts();
    toast('Product deleted');
  });
}

function updateGrossPreview() {
  const rev = parseFloat(document.getElementById('input-revenue').value) || 0;
  const cogs = parseFloat(document.getElementById('input-cogs').value) || 0;
  const gross = rev - cogs;
  const el = document.getElementById('preview-gross');
  el.textContent = fmt(gross);
  el.style.color = gross >= 0 ? 'var(--green)' : 'var(--red)';
}

// ── SPEND ITEM CRUD ──
function openSpendModal(productId) {
  document.getElementById('form-spend').reset();
  document.getElementById('input-spend-product-id').value = productId;
  openModal('modal-spend');
  setTimeout(() => document.getElementById('input-spend-category').focus(), 100);
}

function saveSpendItem(e) {
  e.preventDefault();
  const productId = document.getElementById('input-spend-product-id').value;
  const category = document.getElementById('input-spend-category').value;
  const amount = parseFloat(document.getElementById('input-spend-amount').value) || 0;
  const note = document.getElementById('input-spend-note').value.trim();

  if (!category || amount <= 0) return;

  const p = products.find(x => x.id === productId);
  if (!p) return;

  if (!p.spendItems) p.spendItems = [];
  p.spendItems.push({
    id: uid(),
    category,
    amount,
    note,
    date: new Date().toISOString()
  });

  save();
  closeModal('modal-spend');
  renderProducts();
  toast('Spend item added ✓');
}

function deleteSpendItem(productId, spendId) {
  showConfirm('Delete this spend item?', () => {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    p.spendItems = (p.spendItems || []).filter(s => s.id !== spendId);
    save();
    renderProducts();
    toast('Spend item deleted');
  });
}

// ── RENDER: Spend Analysis ──
function renderAnalysis() {
  renderDonutChart();
  renderSpendByProduct();
  renderSpendTable();
  populateProductFilter();
}

// Donut chart
function renderDonutChart() {
  const canvas = document.getElementById('canvas-donut');
  const empty = document.getElementById('donut-empty');
  const legend = document.getElementById('category-legend');

  const catTotals = {};
  let totalSpend = 0;
  CATEGORIES.forEach(c => catTotals[c] = 0);
  products.forEach(p => {
    (p.spendItems || []).forEach(si => {
      catTotals[si.category] = (catTotals[si.category] || 0) + (Number(si.amount) || 0);
      totalSpend += Number(si.amount) || 0;
    });
  });

  if (totalSpend === 0) {
    canvas.style.display = 'none';
    empty.classList.remove('hidden');
    legend.innerHTML = '';
    return;
  }
  canvas.style.display = 'block';
  empty.classList.add('hidden');

  const ctx = canvas.getContext('2d');
  const container = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const size = Math.min(container.clientWidth - 32, 220);

  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.scale(dpr, dpr);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.58;
  let startAngle = -Math.PI / 2;

  CATEGORIES.forEach(cat => {
    const val = catTotals[cat];
    if (val <= 0) return;
    const sliceAngle = (val / totalSpend) * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = CAT_COLORS[cat];
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Slice border
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.strokeStyle = '#0F0F23';
    ctx.lineWidth = 2;
    ctx.stroke();

    startAngle += sliceAngle;
  });

  // Inner circle (donut hole)
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = '#161633';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Center text
  ctx.fillStyle = '#E8E8F0';
  ctx.font = '700 16px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fmtShort(totalSpend), cx, cy - 6);
  ctx.fillStyle = '#6B6A85';
  ctx.font = '500 10px Inter, sans-serif';
  ctx.fillText('Total Spend', cx, cy + 12);

  // Legend
  legend.innerHTML = CATEGORIES.filter(c => catTotals[c] > 0).map(cat => {
    const share = ((catTotals[cat] / totalSpend) * 100).toFixed(1);
    return `
      <div class="legend-item">
        <div class="legend-dot" style="background:${CAT_COLORS[cat]}"></div>
        <span>${cat}</span>
        <span class="legend-value">${share}%</span>
      </div>
    `;
  }).join('');
}

// Spend by Product chart
function renderSpendByProduct() {
  const canvas = document.getElementById('canvas-spend-product');
  const empty = document.getElementById('spend-product-empty');

  const productSpends = products
    .map(p => ({
      name: p.name,
      total: calcProduct(p).totalSpend
    }))
    .filter(p => p.total > 0)
    .sort((a, b) => b.total - a.total);

  if (productSpends.length === 0) {
    canvas.style.display = 'none';
    empty.classList.remove('hidden');
    return;
  }
  canvas.style.display = 'block';
  empty.classList.add('hidden');

  const ctx = canvas.getContext('2d');
  const container = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;

  const barH = 32;
  const gap = 8;
  const labelW = 90;
  const valueW = 70;
  const padY = 8;
  const totalH = padY + productSpends.length * (barH + gap) - gap + padY;

  canvas.style.height = totalH + 'px';
  canvas.width = container.clientWidth * dpr;
  canvas.height = totalH * dpr;
  ctx.scale(dpr, dpr);

  const w = container.clientWidth;
  const maxVal = Math.max(...productSpends.map(p => p.total), 1);
  const barArea = w - labelW - valueW - 12;

  const barColors = ['#FF6B6B', '#FDCB6E', '#74B9FF', '#A29BFE', '#00B894'];

  productSpends.forEach((item, i) => {
    const y = padY + i * (barH + gap);
    const barW = Math.max((item.total / maxVal) * barArea, 4);
    const color = barColors[i % barColors.length];

    // Label
    ctx.fillStyle = '#9594B0';
    ctx.font = '500 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const displayName = item.name.length > 10 ? item.name.slice(0, 10) + '…' : item.name;
    ctx.fillText(displayName, 4, y + barH / 2);

    // Bar
    const radius = 6;
    const bx = labelW;
    const by = y + 4;
    const bh = barH - 8;

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(bx, by, barW, bh, radius);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Value
    ctx.fillStyle = '#E8E8F0';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText(fmtShort(item.total), bx + barW + 8, y + barH / 2);
  });
}

// Spend table
function renderSpendTable() {
  const tbody = document.getElementById('spend-table-body');
  const empty = document.getElementById('table-empty');
  const filterCat = document.getElementById('filter-category').value;
  const filterProd = document.getElementById('filter-product').value;

  let items = [];
  products.forEach(p => {
    (p.spendItems || []).forEach(si => {
      items.push({
        product: p.name,
        productId: p.id,
        category: si.category,
        amount: Number(si.amount) || 0,
        note: si.note || ''
      });
    });
  });

  // Filters
  if (filterCat !== 'all') items = items.filter(i => i.category === filterCat);
  if (filterProd !== 'all') items = items.filter(i => i.productId === filterProd);

  // Sort
  if (sortDirection.column) {
    items.sort((a, b) => {
      let va = a[sortDirection.column];
      let vb = b[sortDirection.column];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDirection.asc ? -1 : 1;
      if (va > vb) return sortDirection.asc ? 1 : -1;
      return 0;
    });
  }

  if (items.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = items.map(i => `
    <tr>
      <td>${escapeHtml(i.product)}</td>
      <td><span class="spend-category-dot dot-${i.category.toLowerCase()}" style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle;"></span>${i.category}</td>
      <td>${fmt(i.amount)}</td>
      <td>${escapeHtml(i.note) || '—'}</td>
    </tr>
  `).join('');
}

function populateProductFilter() {
  const select = document.getElementById('filter-product');
  const val = select.value;
  select.innerHTML = '<option value="all">All Products</option>';
  products.forEach(p => {
    select.innerHTML += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
  });
  select.value = val || 'all';
}

// ── CSV Export ──
function exportCSV() {
  let items = [];
  products.forEach(p => {
    const c = calcProduct(p);
    (p.spendItems || []).forEach(si => {
      items.push({
        Product: p.name,
        Revenue: p.revenue,
        COGS: p.cogs,
        GrossProfit: c.gross,
        SpendCategory: si.category,
        SpendAmount: si.amount,
        SpendNote: si.note || '',
        NetProfit: c.net,
        Margin: pct(c.margin)
      });
    });
    if ((p.spendItems || []).length === 0) {
      items.push({
        Product: p.name,
        Revenue: p.revenue,
        COGS: p.cogs,
        GrossProfit: c.gross,
        SpendCategory: '',
        SpendAmount: '',
        SpendNote: '',
        NetProfit: c.net,
        Margin: pct(c.margin)
      });
    }
  });

  if (items.length === 0) {
    toast('No data to export');
    return;
  }

  const headers = Object.keys(items[0]);
  const csv = [
    headers.join(','),
    ...items.map(row => headers.map(h => {
      let v = row[h];
      if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) {
        v = '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `profitpulse_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV exported ✓');
}

// ── Event Listeners ──
document.addEventListener('DOMContentLoaded', () => {
  load();

  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Product form
  document.getElementById('form-product').addEventListener('submit', saveProduct);
  document.getElementById('fab-add-product').addEventListener('click', openAddProduct);

  // Gross profit preview
  document.getElementById('input-revenue').addEventListener('input', updateGrossPreview);
  document.getElementById('input-cogs').addEventListener('input', updateGrossPreview);

  // Spend form
  document.getElementById('form-spend').addEventListener('submit', saveSpendItem);

  // Modal close buttons
  document.getElementById('modal-product-close').addEventListener('click', () => closeModal('modal-product'));
  document.getElementById('modal-spend-close').addEventListener('click', () => closeModal('modal-spend'));

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });

  // Confirm dialog
  document.getElementById('btn-confirm-yes').addEventListener('click', () => {
    closeModal('modal-confirm');
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  });
  document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
    closeModal('modal-confirm');
    confirmCallback = null;
  });

  // Table sorting
  document.querySelectorAll('#spend-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (sortDirection.column === col) {
        sortDirection.asc = !sortDirection.asc;
      } else {
        sortDirection.column = col;
        sortDirection.asc = true;
      }
      renderSpendTable();
    });
  });

  // Table filters
  document.getElementById('filter-category').addEventListener('change', renderSpendTable);
  document.getElementById('filter-product').addEventListener('change', renderSpendTable);

  // Export
  document.getElementById('export-btn').addEventListener('click', exportCSV);

  // Handle window resize for charts
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const activeView = document.querySelector('.view.active');
      if (activeView.id === 'view-overview') renderOverview();
      else if (activeView.id === 'view-analysis') renderAnalysis();
    }, 200);
  });

  // Initial render
  renderOverview();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
