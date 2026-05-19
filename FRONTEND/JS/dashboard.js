// js/dashboard.js
// Populates the dashboard with live data from Supabase

async function loadDashboard() {
  // 1. Get current user info
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session) return;

  const email = session.user.email;
  const displayName = email.split('@')[0]; // Use part before @ as display name

  // Update greeting
  const greetingEl = document.querySelector('.topbar-left h1');
  if (greetingEl) greetingEl.textContent = `Hello, ${displayName} 👋`;

  // Update user profile info
  const userNameEl = document.querySelector('.user-info strong');
  if (userNameEl) userNameEl.textContent = displayName;

  // 2. Fetch summary counts
  const { count: totalItems } = await sbClient
    .from('items')
    .select('*', { count: 'exact', head: true });

  const { data: itemsData } = await sbClient
    .from('items')
    .select('amount');

  const totalStock = itemsData ? itemsData.reduce((sum, row) => sum + (row.amount || 0), 0) : 0;

  // Update summary stat cards
  const statValues = document.querySelectorAll('.stat h4');
  if (statValues[0]) statValues[0].textContent = totalStock;   // Quantity in Hand
  if (statValues[2]) statValues[2].textContent = totalItems;   // Total Items

  // 3. Fetch recent items for the dashboard table
  const { data: recentItems, error } = await sbClient
    .from('items')
    .select('item_name, image_url, store, amount')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) { console.error(error); return; }

  const itemsTbody = document.querySelector('.table-card:first-child .data-table tbody');
  if (itemsTbody && recentItems) {
    itemsTbody.innerHTML = recentItems.map(item => `
      <tr>
        <td>${item.item_name ?? '—'}</td>
        <td><div class="img-placeholder" style="${item.image_url ? `background-image:url('${item.image_url}')` : ''}"></div></td>
        <td>${item.store ?? '—'}</td>
        <td>${item.amount ?? 0} pcs</td>
      </tr>
    `).join('');
  }
}

document.addEventListener('DOMContentLoaded', loadDashboard);
