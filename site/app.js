const state = {
  data: null,
  search: '',
  sort: 'price-asc',
  activeShops: new Set(),
};

const els = {
  metaRow: document.getElementById('meta-row'),
  shopStatus: document.getElementById('shop-status'),
  errorBanner: document.getElementById('error-banner'),
  search: document.getElementById('search'),
  sort: document.getElementById('sort'),
  shopFilters: document.getElementById('shop-filters'),
  rows: document.getElementById('rows'),
  emptyState: document.getElementById('empty-state'),
};

const currencyFormatters = {};
function formatPrice(price, currency) {
  const cur = currency || 'EUR';
  if (!currencyFormatters[cur]) {
    currencyFormatters[cur] = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: cur });
  }
  return currencyFormatters[cur].format(price);
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

async function loadData() {
  const res = await fetch('data/latest.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load data/latest.json (${res.status})`);
  return res.json();
}

function flattenItems(data) {
  const rows = [];
  for (const shop of data.shops) {
    if (!shop.ok) continue;
    for (const item of shop.items) {
      rows.push({ shop: shop.shop, name: item.name, price: item.price, currency: item.currency, url: item.url });
    }
  }
  return rows;
}

function renderMeta(data) {
  els.metaRow.innerHTML = '';
  const pills = [
    { label: 'Last updated', value: timeAgo(data.generatedAt) },
    { label: 'Bikes listed', value: String(data.totalItems) },
    { label: 'Shops', value: String(data.shops.length) },
  ];
  for (const p of pills) {
    const el = document.createElement('span');
    el.className = 'meta-pill';
    el.innerHTML = `${p.label}: <strong>${p.value}</strong>`;
    els.metaRow.appendChild(el);
  }
}

function renderShopStatus(data) {
  els.shopStatus.innerHTML = '';
  const failed = [];
  for (const shop of data.shops) {
    const chip = document.createElement('span');
    chip.className = `shop-chip ${shop.ok ? 'ok' : 'fail'}`;
    chip.innerHTML = `<span class="dot"></span>${shop.shop} · ${shop.ok ? `${shop.items.length} bikes` : 'unavailable'}`;
    if (!shop.ok) {
      chip.title = shop.error || 'scrape failed';
      failed.push(shop);
    }
    els.shopStatus.appendChild(chip);
  }

  if (failed.length) {
    els.errorBanner.innerHTML = `<div class="error-banner">${failed
      .map((s) => `<strong>${s.shop}</strong> could not be scraped on the last run (${escapeHtml(s.error || 'unknown error')}). Showing data from other shops only.`)
      .join('<br />')}</div>`;
  } else {
    els.errorBanner.innerHTML = '';
  }
}

function renderShopFilters(data) {
  els.shopFilters.innerHTML = '';
  const shops = data.shops.filter((s) => s.ok && s.items.length).map((s) => s.shop);
  for (const shop of shops) {
    const id = `filter-${shop}`;
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" id="${id}" checked /> ${shop}`;
    label.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) state.activeShops.add(shop);
      else state.activeShops.delete(shop);
      renderRows();
    });
    els.shopFilters.appendChild(label);
    state.activeShops.add(shop);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderRows() {
  const rows = flattenItems(state.data)
    .filter((r) => state.activeShops.has(r.shop))
    .filter((r) => !state.search || r.name.toLowerCase().includes(state.search));

  const [key, dir] = state.sort.split('-');
  rows.sort((a, b) => {
    let cmp;
    if (key === 'price') cmp = a.price - b.price;
    else cmp = String(a[key]).localeCompare(String(b[key]));
    return dir === 'desc' ? -cmp : cmp;
  });

  els.rows.innerHTML = '';
  els.emptyState.hidden = rows.length > 0;

  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="shop-badge">${escapeHtml(r.shop)}</span></td>
      <td class="name">${
        r.url
          ? `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.name)}</a>`
          : escapeHtml(r.name)
      }</td>
      <td class="price">${formatPrice(r.price, r.currency)}</td>
    `;
    els.rows.appendChild(tr);
  }
}

function wireControls() {
  els.search.addEventListener('input', (e) => {
    state.search = e.target.value.trim().toLowerCase();
    renderRows();
  });
  els.sort.addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderRows();
  });
  document.querySelectorAll('th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      const [curKey, curDir] = state.sort.split('-');
      const nextDir = curKey === key && curDir === 'asc' ? 'desc' : 'asc';
      state.sort = `${key}-${nextDir}`;
      const matchingOption = Array.from(els.sort.options).find((o) => o.value === state.sort);
      if (matchingOption) els.sort.value = state.sort;
      renderRows();
    });
  });
}

async function main() {
  wireControls();
  try {
    state.data = await loadData();
  } catch (err) {
    els.errorBanner.innerHTML = `<div class="error-banner">Could not load price data: ${escapeHtml(err.message)}</div>`;
    els.emptyState.hidden = false;
    return;
  }
  renderMeta(state.data);
  renderShopStatus(state.data);
  renderShopFilters(state.data);
  renderRows();
}

main();
