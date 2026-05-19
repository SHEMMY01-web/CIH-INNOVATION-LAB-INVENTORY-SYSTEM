// js/inventory.js

let localInventoryCache = []; // Global cache

/**
 * Fetch data ONCE on dashboard load
 */
async function fetchInventoryInitial() {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('item_name', { ascending: true });

  if (error) {
    console.error('Error fetching inventory:', error.message);
    return;
  }

  // Store in local cache
  localInventoryCache = data;
  
  // Render the DOM table
  renderInventoryTable(localInventoryCache);
  
  // Trigger search configuration here now that elements exist!
  if (typeof initializeInstantSearch === 'function') {
      initializeInstantSearch(); 
  }
}

/**
 * Helper to render HTML table rows
 */
function renderInventoryTable(itemsArray) {
  const tbody = document.querySelector('.list-table tbody');
  if (!tbody) return;
  
  tbody.innerHTML = ''; 
  
  const rowsHTML = itemsArray.map(item => `
    <tr data-id="${item.id}" class="inventory-row">
      <td><input type="checkbox"></td>
      <td class="searchable-name">${item.item_name}</td>
      <td><div class="item-image" style="background-image: url('${item.image_url || ''}')"></div></td>
      <td>${item.model}</td>
      <td>${item.type}</td>
      <td>${item.store}</td>
      <td>${item.amount} pcs</td>
      <td>${item.project}</td>
      <td>${item.status}</td>
    </tr>
  `).join('');
  
  tbody.innerHTML = rowsHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  // Only fetch inventory on pages that have a list table
  if (document.querySelector('.list-table')) {
      fetchInventoryInitial();
  }
});
