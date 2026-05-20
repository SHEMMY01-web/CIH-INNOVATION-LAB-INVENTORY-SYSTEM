// js/dashboard.js

async function loadDashboard() {
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session) return;

  // Update greeting with user's email prefix
  const email = session.user.email;
  const displayName = email.split('@')[0];
  const greetingEl = document.querySelector('.topbar-left h1');
  if (greetingEl) greetingEl.textContent = `Hello, ${displayName}`;
  const userNameEl = document.querySelector('.user-info strong');
  if (userNameEl) userNameEl.textContent = displayName;

  // ── Fetch all items once ──────────────────────────────────────────────────
  const { data: allItems, error } = await window.fetchFromDB('items');

  if (error) { console.error(error); return; }

  // ── Compute stats using dynamic namespace prefix rules ─────────────────────
  // Filter out any items that are assigned to a project (project is not empty/null)
  const generalItems = allItems.filter(i => !i.project || i.project.trim() === '');
  
  const assets = generalItems.filter(i => (i.type ?? '').toLowerCase().startsWith('asset:'));
  const tools  = generalItems.filter(i => (i.type ?? '').toLowerCase().startsWith('tool:'));
  const items  = generalItems.filter(i => {
    const t = (i.type ?? '').toLowerCase();
    return !t.startsWith('asset:') && !t.startsWith('tool:');
  });

  const totalStock   = generalItems.reduce((s, r) => s + (r.amount ?? 0), 0);
  const uniqueStores = new Set(generalItems.map(i => i.store).filter(Boolean)).size;
  const uniqueTypes  = new Set(generalItems.map(i => {
    const t = i.type ?? '';
    return t.includes(':') ? t.split(':')[1] : t;
  }).filter(Boolean)).size;

  // ── Write stats into IDs ──────────────────────────────────────────────────
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('stat-qty-in-hand',   totalStock);
  set('stat-to-be-received', 0);
  set('stat-suppliers',     uniqueStores);
  set('stat-categories',    uniqueTypes);
  set('stat-total-items',   items.length);
  set('stat-items-pending', 0);
  set('stat-total-assets',  assets.length);
  set('stat-assets-pending', 0);

  // ── Populate recent items mini-table ──────────────────────────────────────
  const itemsTbody = document.querySelector('.table-card:first-child .data-table tbody');
  if (itemsTbody) {
    const recent = items.slice(0, 3);
    itemsTbody.innerHTML = recent.length
      ? recent.map(item => `
          <tr>
            <td>${item.item_name ?? '—'}</td>
            <td><div class="img-placeholder" style="${item.image_url ? `background-image:url('${item.image_url}');background-size:cover` : ''}"></div></td>
            <td>${item.status ?? '—'}</td>
            <td>${item.amount ?? 0} pcs</td>
          </tr>`).join('')
      : `<tr><td colspan="4" style="text-align:center;padding:20px;color:#aaa">No items yet</td></tr>`;
  }

  // ── Populate recent assets mini-table ─────────────────────────────────────
  const assetsTbody = document.querySelector('.table-card:nth-child(2) .data-table tbody');
  if (assetsTbody) {
    const recent = assets.slice(0, 3);
    assetsTbody.innerHTML = recent.length
      ? recent.map(item => `
          <tr>
            <td>${item.item_name ?? '—'}</td>
            <td><div class="img-placeholder" style="${item.image_url ? `background-image:url('${item.image_url}');background-size:cover` : ''}"></div></td>
            <td>${item.status ?? '—'}</td>
            <td>${item.amount ?? 0} pcs</td>
          </tr>`).join('')
      : `<tr><td colspan="4" style="text-align:center;padding:20px;color:#aaa">No assets yet</td></tr>`;
  }
}

document.addEventListener('DOMContentLoaded', loadDashboard);
