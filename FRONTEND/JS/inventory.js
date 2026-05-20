// js/inventory.js

let localInventoryCache = [];

// Detect which page we are on and apply the correct type filter
const PAGE_TYPE_MAP = {
  'items.html':   null,        // Show all items (or filter by 'Item' type if your DB uses that)
  'assets.html':  'Asset',
  'tools.html':   'Tool',
  'project_detail.html': null, // Project detail shows its own filtered data
  'request.html': null,
};

function getPageTypeFilter() {
  const page = window.location.pathname.split('/').pop();
  return PAGE_TYPE_MAP.hasOwnProperty(page) ? PAGE_TYPE_MAP[page] : null;
}

/**
 * Show a skeleton loading state in the table while data is fetching
 */
function showTableSkeleton() {
  const tbody = document.querySelector('.list-table tbody');
  if (!tbody) return;
  const skeletonRow = `
    <tr class="skeleton-row">
      ${Array(9).fill('<td><div style="height:16px;background:#eee;border-radius:4px;animation:pulse 1.2s infinite;"></div></td>').join('')}
    </tr>`;
  tbody.innerHTML = Array(5).fill(skeletonRow).join('');
}

/**
 * Fetch inventory data from Supabase and filter locally
 */
async function fetchInventoryInitial() {
  const page = window.location.pathname.split('/').pop();

  if (page === 'request.html') {
    // ── Handle requests page separately (renders transactions) ─────────────────
    const tbodies = document.querySelectorAll('.list-table tbody');
    tbodies.forEach(tb => {
      const skeletonRow = `<tr class="skeleton-row">${Array(9).fill('<td><div style="height:16px;background:#eee;border-radius:4px;animation:pulse 1.2s infinite;"></div></td>').join('')}</tr>`;
      tb.innerHTML = Array(4).fill(skeletonRow).join('');
    });

    const { data: txs, error } = await sbClient
      .from('transactions')
      .select('*, items(*)')
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error.message);
      return;
    }

    // Render Requested (checkout)
    const requestedTbody = document.querySelector('#content-items .list-table tbody');
    if (requestedTbody) {
      const requested = txs.filter(t => t.transaction_type === 'checkout' || t.transaction_type === 'request');
      requestedTbody.innerHTML = requested.length
        ? requested.map(tx => `
            <tr>
              <td><input type="checkbox"></td>
              <td class="searchable-name">${tx.items?.item_name ?? '—'}</td>
              <td><div class="item-image" style="${tx.items?.image_url ? `background-image:url('${tx.items.image_url}'); background-size:cover;` : 'background:#eee;'}"></div></td>
              <td>${tx.items?.model ?? '—'}</td>
              <td>${tx.items?.type ?? '—'}</td>
              <td>${tx.items?.store ?? '—'}</td>
              <td>${tx.amount ?? 0} pcs</td>
              <td>${tx.project ?? '—'}</td>
              <td>${tx.requester ?? '—'}</td>
            </tr>`).join('')
        : `<tr><td colspan="9" style="text-align:center;padding:40px;color:#aaa">No requested items found.</td></tr>`;
    }

    // Render Returned
    const returnedTbody = document.querySelector('#content-assets .list-table tbody');
    if (returnedTbody) {
      const returned = txs.filter(t => t.transaction_type === 'return');
      returnedTbody.innerHTML = returned.length
        ? returned.map(tx => `
            <tr>
              <td><input type="checkbox"></td>
              <td class="searchable-name">${tx.items?.item_name ?? '—'}</td>
              <td><div class="item-image" style="${tx.items?.image_url ? `background-image:url('${tx.items.image_url}'); background-size:cover;` : 'background:#eee;'}"></div></td>
              <td>${tx.items?.model ?? '—'}</td>
              <td>${tx.items?.type ?? '—'}</td>
              <td>${tx.items?.store ?? '—'}</td>
              <td>${tx.amount ?? 0} pcs</td>
              <td>${tx.project ?? '—'}</td>
              <td>${tx.requester ?? '—'}</td>
            </tr>`).join('')
        : `<tr><td colspan="9" style="text-align:center;padding:40px;color:#aaa">No returned items found.</td></tr>`;
    }

    if (typeof updatePaginationText === 'function') {
      updatePaginationText(txs.length, txs.length);
    }
    return;
  }

  // ── Standard catalog tables ──────────────────────────────────────────────
  showTableSkeleton();

  const { data, error } = await sbClient
    .from('items')
    .select('*')
    .order('item_name', { ascending: true });

  if (error) {
    console.error('Error fetching inventory:', error.message);
    return;
  }

  const typeFilter = getPageTypeFilter();

  // Filter locally
  let filteredData = data;
  if (typeFilter) {
    filteredData = data.filter(i => (i.type ?? '').toLowerCase() === typeFilter.toLowerCase());
  } else if (page === 'items.html') {
    // Items page shows everything that is NOT an Asset and NOT a Tool
    filteredData = data.filter(i => {
      const t = (i.type ?? '').toLowerCase();
      return t !== 'asset' && t !== 'tool';
    });
  }

  // Set the cache to the page-filtered subset so search resets work correctly
  localInventoryCache = filteredData;
  renderInventoryTable(localInventoryCache);

  // Update pagination text dynamically
  if (typeof updatePaginationText === 'function') {
    const perPage = parseInt(document.querySelector('.showing-entries select')?.value) || localInventoryCache.length;
    updatePaginationText(localInventoryCache.length, Math.min(perPage, localInventoryCache.length));
  }

  if (typeof initializeInstantSearch === 'function') {
    initializeInstantSearch();
  }
}

/**
 * Dynamically renders rows in .list-table tbody
 */
function renderInventoryTable(itemsArray) {
  const tbody = document.querySelector('.list-table tbody');
  if (!tbody) return;

  if (!itemsArray || itemsArray.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding:40px; color:#aaa; font-size:0.95rem;">
          No items found.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = itemsArray.map(item => `
    <tr data-id="${item.id}" class="inventory-row">
      <td><input type="checkbox"></td>
      <td class="searchable-name">${item.item_name ?? '—'}</td>
      <td>
        <div class="item-image" style="${item.image_url ? `background-image:url('${item.image_url}'); background-size:cover;` : 'background:#eee;'}"></div>
      </td>
      <td>${item.model ?? '—'}</td>
      <td>${item.type ?? '—'}</td>
      <td>${item.store ?? '—'}</td>
      <td>${item.amount ?? 0} pcs</td>
      <td>${item.project ?? '—'}</td>
      <td>${item.status ?? '—'}</td>
    </tr>
  `).join('');
}

// Keyframe animation for skeleton loader
const style = document.createElement('style');
style.textContent = `@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.list-table')) {
    fetchInventoryInitial();
  }
});
