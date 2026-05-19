// js/search.js

function initializeInstantSearch() {
  const searchInput = document.querySelector('.table-search input');
  const tbody = document.querySelector('.list-table tbody');
  
  if (!searchInput || !tbody) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    // IF QUERY IS EMPTY: Re-render clean from cache to preserve sort order
    if (query === '') {
        renderInventoryTable(localInventoryCache);
        return;
    }

    const rows = Array.from(tbody.querySelectorAll('tr.inventory-row'));
    
    const exactMatches = document.createDocumentFragment();
    const partialMatches = document.createDocumentFragment();
    const hiddenRows = document.createDocumentFragment();

    rows.forEach(row => {
      const itemNameCell = row.querySelector('.searchable-name');
      if (!itemNameCell) return;
      
      const itemName = itemNameCell.textContent.toLowerCase();

      if (itemName.startsWith(query)) {
        // Prefix match goes to the very top
        row.style.display = '';
        exactMatches.appendChild(row);
      } else if (itemName.includes(query)) {
        // Partial match stays visible
        row.style.display = '';
        partialMatches.appendChild(row);
      } else {
        // No match, hide it
        row.style.display = 'none';
        hiddenRows.appendChild(row);
      }
    });

    // Re-append to DOM safely
    tbody.innerHTML = '';
    tbody.appendChild(exactMatches);
    tbody.appendChild(partialMatches);
    tbody.appendChild(hiddenRows);
  });
}
