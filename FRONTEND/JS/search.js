// js/search.js

function initializeInstantSearch() {
  const inputs = document.querySelectorAll('.table-search input, .search-box input');
  if (inputs.length === 0) return;

  inputs.forEach(searchInput => {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const page = window.location.pathname.split('/').pop();

      // ── Scenario A: Project Card Grid Filtering (project.html) ────────────────
      if (page === 'project.html') {
        const cards = document.querySelectorAll('.project-card');
        cards.forEach(card => {
          const projName = (card.querySelector('.project-value')?.textContent ?? '').toLowerCase();
          const clientName = (card.querySelector('.client-value')?.textContent ?? '').toLowerCase();
          
          if (projName.includes(query) || clientName.includes(query)) {
            card.style.display = '';
          } else {
            card.style.display = 'none';
          }
        });
        return;
      }

      // ── Scenario B: Dashboard Simple DOM Filtering (index.html/dashboard.html) ──
      if (page === 'index.html' || page === 'dashboard.html' || page === '') {
        const rows = document.querySelectorAll('.data-table tbody tr');
        rows.forEach(row => {
          const text = row.textContent.toLowerCase();
          if (text.includes(query)) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
        return;
      }

      // ── Scenario C: Requests Page Filtering (request.html) ────────────────────
      if (page === 'request.html' && window.globalTransactions) {
        if (query === '') {
          setupTransactionTabPagination('#content-items', window.globalTransactions.requested);
          setupTransactionTabPagination('#content-assets', window.globalTransactions.returned);
          return;
        }

        const filterTx = (txList) => {
          return txList.filter(tx => {
            const name = (tx.items?.item_name ?? '').toLowerCase();
            const model = (tx.items?.model ?? '').toLowerCase();
            const proj = (tx.project ?? '').toLowerCase();
            const req = (tx.requester ?? '').toLowerCase();
            return name.includes(query) || model.includes(query) || proj.includes(query) || req.includes(query);
          });
        };

        setupTransactionTabPagination('#content-items', filterTx(window.globalTransactions.requested));
        setupTransactionTabPagination('#content-assets', filterTx(window.globalTransactions.returned));
        return;
      }

      // ── Scenario D: Stateful Database Table Filtering (All list tables) ───────
      // If query is empty: restore full clean dataset
      if (query === '') {
        if (typeof window.updateInventoryDataset === 'function' && typeof localInventoryCache !== 'undefined') {
          window.updateInventoryDataset(localInventoryCache);
        }
        return;
      }

      if (typeof localInventoryCache !== 'undefined' && localInventoryCache) {
        const matches = localInventoryCache.filter(item => {
          const name = (item.item_name ?? '').toLowerCase();
          const model = (item.model ?? '').toLowerCase();
          const store = (item.store ?? '').toLowerCase();
          const type = (item.type ?? '').toLowerCase();
          const project = (item.project ?? '').toLowerCase();
          
          return name.includes(query) || 
                 model.includes(query) || 
                 store.includes(query) || 
                 type.includes(query) ||
                 project.includes(query);
        });

        if (typeof window.updateInventoryDataset === 'function') {
          window.updateInventoryDataset(matches);
        }
      }
    });
  });
}
