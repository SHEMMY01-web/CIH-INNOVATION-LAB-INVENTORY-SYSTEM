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
 * Fetch inventory data from Supabase, filtered by type if needed
 */
async function fetchInventoryInitial() {
  showTableSkeleton();

  const typeFilter = getPageTypeFilter();
  let query = sbClient.from('items').select('*').order('item_name', { ascending: true });

  if (typeFilter) {
    query = query.ilike('type', typeFilter); // case-insensitive match
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching inventory:', error.message);
    return;
  }

  localInventoryCache = data;
  renderInventoryTable(localInventoryCache);

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
