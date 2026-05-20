// js/inventory.js

let localInventoryCache = [];
let currentFilteredData = [];
let currentPage = 1;
let itemsPerPage = 10;

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
 * Renders only the sliced subset for the current active page
 */
function renderPaginatedTable() {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageData = currentFilteredData.slice(startIndex, endIndex);

  renderInventoryTable(pageData);
  updatePaginationControls();
}

/**
 * Re-computes and renders pagination text & page buttons dynamically
 */
function updatePaginationControls() {
  const totalRecords = currentFilteredData.length;
  const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;

  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalRecords);

  // 1. Update "Showing X to Y of Z records"
  const startText = totalRecords === 0 ? 0 : startIndex + 1;
  document.querySelectorAll('.total-records').forEach(el => {
    el.textContent = `Showing ${startText} to ${endIndex} of ${totalRecords} records`;
  });

  // 2. Generate page numbers dynamically
  const container = document.querySelector('.pagination-controls');
  if (!container) return;

  let html = `<button class="page-btn prev-btn" ${currentPage === 1 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}><span class="material-symbols-outlined" style="font-size:inherit; vertical-align:middle;">chevron_left</span></button>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn num-btn ${i === currentPage ? 'active' : ''}">${i}</button>`;
  }
  html += `<button class="page-btn next-btn" ${currentPage === totalPages ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}><span class="material-symbols-outlined" style="font-size:inherit; vertical-align:middle;">chevron_right</span></button>`;
  container.innerHTML = html;

  // Add click handlers
  container.querySelector('.prev-btn')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderPaginatedTable();
    }
  });

  container.querySelector('.next-btn')?.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderPaginatedTable();
    }
  });

  container.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentPage = parseInt(e.target.textContent);
      renderPaginatedTable();
    });
  });
}

/**
 * Expose dataset updates globally so search.js can reset pagination on filter
 */
window.updateInventoryDataset = function(newDataset) {
  currentFilteredData = newDataset;
  currentPage = 1;
  renderPaginatedTable();
};

/**
 * Render dynamic pagination controls and entries specifically for the Requests tabs
 */
function setupTransactionTabPagination(tabSelector, transactionsList) {
  const tabContainer = document.querySelector(tabSelector);
  if (!tabContainer) return;

  let tPage = 1;
  let tLimit = 6;

  const limitSelect = tabContainer.querySelector('.showing-entries select');
  if (limitSelect) {
    tLimit = parseInt(limitSelect.value) || 6;
    // Remove duplicate listeners
    const newSelect = limitSelect.cloneNode(true);
    limitSelect.replaceWith(newSelect);
    newSelect.addEventListener('change', (e) => {
      tLimit = parseInt(e.target.value) || 6;
      tPage = 1;
      render();
    });
  }

  function render() {
    const tbody = tabContainer.querySelector('.list-table tbody');
    if (!tbody) return;

    const totalRecords = transactionsList.length;
    const totalPages = Math.ceil(totalRecords / tLimit) || 1;

    if (tPage > totalPages) tPage = totalPages;

    const startIndex = (tPage - 1) * tLimit;
    const endIndex = Math.min(startIndex + tLimit, totalRecords);
    const pageData = transactionsList.slice(startIndex, endIndex);

    if (pageData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:40px; color:#aaa; font-size:0.95rem;">
            No transactions found.
          </td>
        </tr>`;
    } else {
      tbody.innerHTML = pageData.map(tx => {
        const rawType = tx.items?.type ?? '';
        const displayType = rawType.includes(':') ? rawType.split(':')[1] : rawType;
        const displayImage = tx.image_url || tx.items?.image_url || '';
        // Omitted Store column
        return `
          <tr>
            <td><input type="checkbox"></td>
            <td class="searchable-name">${tx.items?.item_name ?? '—'}</td>
            <td>
              <div class="item-image" style="${displayImage ? `background-image:url('${displayImage}'); background-size:cover;` : 'background:#eee;'}"></div>
            </td>
            <td>${tx.items?.model ?? '—'}</td>
            <td>${displayType || '—'}</td>
            <td>${tx.amount ?? 0} ${tx.items?.store || 'pcs'}</td>
            <td>${tx.project ?? '—'}</td>
            <td>${tx.requester ?? '—'}</td>
          </tr>`;
      }).join('');
    }

    // Dynamic record counts text
    const totalText = tabContainer.querySelector('.total-records');
    if (totalText) {
      const startText = totalRecords === 0 ? 0 : startIndex + 1;
      totalText.textContent = `Showing ${startText} to ${endIndex} of ${totalRecords} records`;
    }

    // Dynamic pagination button generation
    const pageControls = tabContainer.querySelector('.pagination-controls');
    if (pageControls) {
      let html = `<button class="page-btn prev-btn" ${tPage === 1 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}><span class="material-symbols-outlined" style="font-size:inherit; vertical-align:middle;">chevron_left</span></button>`;
      for (let i = 1; i <= totalPages; i++) {
        html += `<button class="page-btn num-btn ${i === tPage ? 'active' : ''}">${i}</button>`;
      }
      html += `<button class="page-btn next-btn" ${tPage === totalPages ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}><span class="material-symbols-outlined" style="font-size:inherit; vertical-align:middle;">chevron_right</span></button>`;
      pageControls.innerHTML = html;

      // Event Listeners
      pageControls.querySelector('.prev-btn')?.addEventListener('click', () => {
        if (tPage > 1) {
          tPage--;
          render();
        }
      });
      pageControls.querySelector('.next-btn')?.addEventListener('click', () => {
        if (tPage < totalPages) {
          tPage++;
          render();
        }
      });
      pageControls.querySelectorAll('.num-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          tPage = parseInt(e.target.textContent);
          render();
        });
      });
    }
  }

  render();
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
      const skeletonRow = `<tr class="skeleton-row">${Array(8).fill('<td><div style="height:16px;background:#eee;border-radius:4px;animation:pulse 1.2s infinite;"></div></td>').join('')}</tr>`;
      tb.innerHTML = Array(4).fill(skeletonRow).join('');
    });

    const { data: txs, error } = await window.fetchFromDB('transactions');

    if (error) {
      console.error('Error fetching transactions:', error.message);
      return;
    }

    const requested = txs.filter(t => t.transaction_type === 'checkout' || t.transaction_type === 'request');
    const returned = txs.filter(t => t.transaction_type === 'return');

    window.globalTransactions = { requested, returned };

    setupTransactionTabPagination('#content-items', requested);
    setupTransactionTabPagination('#content-assets', returned);
    
    if (typeof initializeInstantSearch === 'function') {
      initializeInstantSearch();
    }
    return;
  }

  // ── Standard catalog tables ──────────────────────────────────────────────
  showTableSkeleton();

  const { data: unsortedData, error } = await window.fetchFromDB('items');
  const data = unsortedData ? unsortedData.slice().sort((a, b) => (a.item_name || '').localeCompare(b.item_name || '')) : [];

  if (error) {
    console.error('Error fetching inventory:', error.message);
    return;
  }

  // Filter locally based on custom prefix classification rules and hide project items
  let filteredData = data;
  if (page === 'assets.html') {
    filteredData = data.filter(i => (i.type ?? '').toLowerCase().startsWith('asset:') && (!i.project || i.project.trim() === ''));
  } else if (page === 'items.html') {
    filteredData = data.filter(i => {
      const t = (i.type ?? '').toLowerCase();
      return !t.startsWith('asset:') && !t.startsWith('tool:') && (!i.project || i.project.trim() === '');
    });
  }

  localInventoryCache = filteredData;
  
  // Set entries count based on select dropdown (Skip for project detail, handled in project.js)
  if (page !== 'project_detail.html') {
    const limitSelect = document.querySelector('.showing-entries select');
    if (limitSelect) {
      itemsPerPage = parseInt(limitSelect.value) || 10;
      limitSelect.addEventListener('change', (e) => {
        itemsPerPage = parseInt(e.target.value) || 10;
        currentPage = 1;
        renderPaginatedTable();
      });
    }
  }

  window.updateInventoryDataset(localInventoryCache);

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

  // Inject Actions header dynamically into the head row if not already present
  const theadRow = document.querySelector('.list-table thead tr');
  if (theadRow && !theadRow.querySelector('.actions-header')) {
    const th = document.createElement('th');
    th.className = 'actions-header';
    th.textContent = 'Actions';
    theadRow.appendChild(th);
  }

  if (!itemsArray || itemsArray.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding:40px; color:#aaa; font-size:0.95rem;">
          No items found.
        </td>
      </tr>`;
    return;
  }

  const page = window.location.pathname.split('/').pop();

  tbody.innerHTML = itemsArray.map(item => {
    const rawType = item.type ?? '';
    const displayType = rawType.includes(':') ? rawType.split(':')[1] : rawType;
    
    // assets.html and items.html omit Store and Project columns!
    if (page === 'assets.html' || page === 'items.html') {
      return `
        <tr data-id="${item.id}" class="inventory-row">
          <td><input type="checkbox"></td>
          <td class="searchable-name">${item.item_name ?? '—'}</td>
          <td>
            <div class="item-image" style="${item.image_url ? `background-image:url('${item.image_url}'); background-size:cover;` : 'background:#eee;'}"></div>
          </td>
          <td>${item.model ?? '—'}</td>
          <td>${displayType || '—'}</td>
          <td>${item.amount ?? 0} ${item.store || 'pcs'}</td>
          <td>${item.status ?? '—'}</td>
          <td style="white-space:nowrap;">
            <button class="view-img-btn" data-img="${item.image_url || ''}" data-name="${item.item_name ?? ''}" style="background:#0ea5e9; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:500; display:inline-flex; align-items:center; gap:4px; margin-right:6px; transition:opacity 0.2s;"><span class="material-symbols-outlined" style="font-size:16px;">image</span> View</button>
            <button class="edit-row-btn" data-id="${item.id}" style="background:#4f46e5; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:500; display:inline-flex; align-items:center; gap:4px; transition:opacity 0.2s;"><span class="material-symbols-outlined" style="font-size:16px;">edit</span> Edit</button>
          </td>
        </tr>`;
    }

    return `
      <tr data-id="${item.id}" class="inventory-row">
        <td><input type="checkbox"></td>
        <td class="searchable-name">${item.item_name ?? '—'}</td>
        <td>
          <div class="item-image" style="${item.image_url ? `background-image:url('${item.image_url}'); background-size:cover;` : 'background:#eee;'}"></div>
        </td>
        <td>${item.model ?? '—'}</td>
        <td>${displayType || '—'}</td>
        <td>${item.store ?? '—'}</td>
        <td>${item.amount ?? 0} ${item.store || 'pcs'}</td>
        <td>${item.project ?? '—'}</td>
        <td>${item.status ?? '—'}</td>
        <td style="white-space:nowrap;">
          <button class="view-img-btn" data-img="${item.image_url || ''}" data-name="${item.item_name ?? ''}" style="background:#0ea5e9; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:500; display:inline-flex; align-items:center; gap:4px; margin-right:6px; transition:opacity 0.2s;"><span class="material-symbols-outlined" style="font-size:16px;">image</span> View</button>
          <button class="edit-row-btn" data-id="${item.id}" style="background:#4f46e5; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:500; display:inline-flex; align-items:center; gap:4px; transition:opacity 0.2s;"><span class="material-symbols-outlined" style="font-size:16px;">edit</span> Edit</button>
        </td>
      </tr>`;
  }).join('');
}

// Keyframe animation for skeleton loader
const style = document.createElement('style');
style.textContent = `@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.list-table')) {
    fetchInventoryInitial();
  }

  // ── Inject image lightbox modal once ────────────────────────────────────
  if (!document.getElementById('img-lightbox')) {
    const lb = document.createElement('div');
    lb.id = 'img-lightbox';
    lb.style.cssText = `
      display:none; position:fixed; inset:0; z-index:9999;
      background:rgba(0,0,0,0.75); backdrop-filter:blur(4px);
      justify-content:center; align-items:center; flex-direction:column; gap:16px;
    `;
    lb.innerHTML = `
      <div style="position:relative; max-width:90vw; max-height:85vh; background:var(--card-bg,#fff);
                  border-radius:16px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.4);">
        <div style="display:flex; align-items:center; justify-content:space-between;
                    padding:14px 20px; border-bottom:1px solid var(--border-color,#eee);">
          <span id="lb-title" style="font-weight:600; font-size:1rem; color:var(--text-color,#111);">—</span>
          <button id="lb-close" style="background:none; border:none; cursor:pointer; font-size:22px;
                                       color:var(--text-color,#555); line-height:1;">&times;</button>
        </div>
        <div style="padding:20px; display:flex; justify-content:center; align-items:center; min-height:200px;">
          <img id="lb-img" src="" alt="Item Image"
               style="max-width:75vw; max-height:70vh; object-fit:contain; border-radius:8px;
                      display:block;">
          <div id="lb-no-img" style="display:none; text-align:center; padding:40px; color:#aaa;">
            <span class="material-symbols-outlined" style="font-size:64px; color:#ddd;">broken_image</span>
            <p style="margin-top:8px; font-size:0.9rem;">No image uploaded for this item.</p>
          </div>
        </div>
      </div>`;
    document.body.appendChild(lb);

    // Open lightbox
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('.view-img-btn');
      if (!btn) return;

      const imgUrl = btn.dataset.img;
      const name   = btn.dataset.name || 'Item';

      document.getElementById('lb-title').textContent = name;
      const imgEl   = document.getElementById('lb-img');
      const noImgEl = document.getElementById('lb-no-img');

      if (imgUrl) {
        imgEl.src = imgUrl;
        imgEl.style.display = 'block';
        noImgEl.style.display = 'none';
      } else {
        imgEl.style.display = 'none';
        noImgEl.style.display = 'block';
      }

      lb.style.display = 'flex';
    });

    // Close lightbox on × or backdrop click
    document.getElementById('lb-close').addEventListener('click', () => {
      lb.style.display = 'none';
    });
    lb.addEventListener('click', (e) => {
      if (e.target === lb) lb.style.display = 'none';
    });
  }
});
