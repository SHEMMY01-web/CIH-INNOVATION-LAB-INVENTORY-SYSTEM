// js/project.js

let localProjects = [];
let projectsCurrentPage = 1;
let projectsPerPage = 6;

document.addEventListener('DOMContentLoaded', async () => {
  const page = window.location.pathname.split('/').pop();

  if (page === 'project.html') {
    await initializeProjectsCatalog();
    hookProjectSubmit();
  } else if (page === 'project_detail.html') {
    await renderProjectDetail();
    
    // Dynamically pre-fill project detail fields and set classification type
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('a[href="#add-modal"]');
      if (btn) {
        const isAsset = btn.textContent.toLowerCase().includes('asset');
        
        // 1. Set modal title dynamically
        const header = document.querySelector('#add-modal h2');
        if (header) {
          header.textContent = isAsset ? 'Add New Asset to Project' : 'Add New Item to Project';
        }

        // 2. Pre-fill and lock project field
        const urlParams = new URLSearchParams(window.location.search);
        const projectName = urlParams.get('name') || 'BDU-DCF';
        const projInput = document.getElementById('add-item-project');
        if (projInput) {
          projInput.value = projectName;
          projInput.readOnly = true;
          projInput.style.background = 'var(--border-color)';
          projInput.style.cursor = 'not-allowed';
        }

        // 3. Tag form type classification
        const form = document.getElementById('add-project-item-form');
        if (form) {
          form.setAttribute('data-target-type', isAsset ? 'asset' : 'item');
        }
      }
    });
  }

  if (typeof initializeInstantSearch === 'function') {
    initializeInstantSearch();
  }
});

async function initializeProjectsCatalog() {
  const grid = document.querySelector('.projects-grid');
  if (!grid) return;

  grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#aaa;">Loading projects...</div>';

  // 1. Fetch all items
  const { data: allItems, error: itemsError } = await window.fetchFromDB('items');

  if (itemsError) {
    console.error('Error loading items:', itemsError.message);
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#f87171;">Failed to load items.</div>';
    return;
  }

  // 2. Fetch projects from projects table
  let dbProjects = [];
  try {
    const { data, error } = await window.fetchFromDB('projects');

    if (error) throw error;
    dbProjects = data;
  } catch (projError) {
    // Graceful self-healing fallback if table doesn't exist yet
    console.warn('Fallback: projects table does not exist. Extracting projects dynamically from items catalog...');
    const uniqueProjNames = Array.from(new Set(allItems.map(i => i.project).filter(Boolean)));
    dbProjects = uniqueProjNames.map(name => ({
      name: name,
      client: name === 'BDU-DCF' ? 'Bahir Dar University' : 'CIH Partner',
      manager: 'Letera Tadele'
    }));

    if (dbProjects.length === 0) {
      dbProjects = [
        { name: 'CIH Lab', client: 'CIH Partner', manager: 'Letera Tadele' },
        { name: 'BDU-DCF', client: 'Bahir Dar University', manager: 'Letera Tadele' }
      ];
    }
  }

  // Map dynamic item count, manager, client and status beautifully
  localProjects = dbProjects.map(proj => {
    const projItems = allItems.filter(i => (i.project || '').trim().toLowerCase() === proj.name.trim().toLowerCase());
    return {
      name: proj.name,
      client: proj.client || 'CIH Partner',
      manager: proj.manager || 'Letera Tadele',
      status: proj.status || 'active',
      itemCount: projItems.length
    };
  });

  // Wire up dropdown change event listener
  const limitSelect = document.querySelector('.showing-entries select');
  if (limitSelect) {
    projectsPerPage = parseInt(limitSelect.value) || 6;
    // Replace listener cleanly
    const newSelect = limitSelect.cloneNode(true);
    limitSelect.replaceWith(newSelect);
    newSelect.addEventListener('change', (e) => {
      projectsPerPage = parseInt(e.target.value) || 6;
      projectsCurrentPage = 1;
      updateProjectsDisplay();
    });
  }

  projectsCurrentPage = 1;
  updateProjectsDisplay();
}

function updateProjectsDisplay() {
  const grid = document.querySelector('.projects-grid');
  if (!grid) return;

  if (localProjects.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#aaa;">No projects found. Add a project to get started!</div>';
    document.querySelectorAll('.total-records').forEach(el => {
      el.textContent = 'Showing 0 to 0 of 0 projects';
    });
    
    const controls = document.querySelector('.pagination-controls');
    if (controls) controls.innerHTML = '';
    return;
  }

  const total = localProjects.length;
  const totalPages = Math.ceil(total / projectsPerPage);
  
  if (projectsCurrentPage > totalPages) {
    projectsCurrentPage = totalPages;
  }
  if (projectsCurrentPage < 1) {
    projectsCurrentPage = 1;
  }

  const startIdx = (projectsCurrentPage - 1) * projectsPerPage;
  const endIdx = Math.min(startIdx + projectsPerPage, total);
  
  const pageItems = localProjects.slice(startIdx, endIdx);

  grid.innerHTML = pageItems.map(proj => {
    const initials = (proj.manager || 'LA')
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    const isCompleted = proj.status === 'completed';
    const statusBadge = isCompleted
      ? `<span style="display:inline-flex; align-items:center; gap:4px; background:#d1fae5; color:#065f46; font-size:0.75rem; font-weight:600; padding:3px 10px; border-radius:999px;"><span class="material-symbols-outlined" style="font-size:inherit; vertical-align:middle; margin-right:2px;">check_circle</span> Completed</span>`
      : `<span style="display:inline-flex; align-items:center; gap:4px; background:#dbeafe; color:#1e40af; font-size:0.75rem; font-weight:600; padding:3px 10px; border-radius:999px;"><span class="material-symbols-outlined" style="font-size:inherit; vertical-align:middle; margin-right:2px;">bolt</span> Active</span>`;

    return `
      <a href="project_detail.html?name=${encodeURIComponent(proj.name)}" class="project-card">
        <div class="project-info">
          <div class="project-info-row" style="justify-content: space-between; align-items: flex-start;">
            <div>
              <div class="project-info-row">
                <span class="project-label">Project:</span>
                <span class="project-value">${proj.name}</span>
              </div>
              <div class="project-info-row">
                <span class="project-label">Client:</span>
                <span class="client-value">${proj.client}</span>
              </div>
            </div>
            <div style="flex-shrink:0; margin-left:8px;">${statusBadge}</div>
          </div>
        </div>
        
        <div class="team-members-row">
          <div class="team-member">
            <div class="member-avatar">${initials}</div>
            <div class="member-details">
              <span class="member-name">${proj.manager}</span>
              <span class="member-role">Project Manager</span>
            </div>
          </div>
        </div>

        <div style="font-size:0.85rem; color:#666; margin: 12px 0 6px 0; display: flex; align-items: center; gap: 5px;">
          <span class="material-symbols-outlined" style="vertical-align:middle; font-size:18px;">inventory_2</span> <strong>${proj.itemCount}</strong> items associated
        </div>

        <div class="progress-bar-container">
          <div class="progress-bar-fill" style="width: ${isCompleted ? '100' : '60'}%; background: ${isCompleted ? '#10b981' : 'var(--primary-color)'};"></div>
        </div>
      </a>`;
  }).join('');

  // Update total records label
  document.querySelectorAll('.total-records').forEach(el => {
    el.textContent = `Showing ${total === 0 ? 0 : startIdx + 1} to ${endIdx} of ${total} projects`;
  });

  // Re-generate pagination buttons dynamically
  const controls = document.querySelector('.pagination-controls');
  if (controls) {
    let html = `<button class="page-btn prev-btn" ${projectsCurrentPage === 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}><span class="material-symbols-outlined" style="font-size:inherit; vertical-align:middle;">chevron_left</span></button>`;
    
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="page-btn num-btn ${i === projectsCurrentPage ? 'active' : ''}">${i}</button>`;
    }
    
    html += `<button class="page-btn next-btn" ${projectsCurrentPage === totalPages ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}><span class="material-symbols-outlined" style="font-size:inherit; vertical-align:middle;">chevron_right</span></button>`;
    controls.innerHTML = html;

    // Bind click events to the new buttons
    controls.querySelector('.prev-btn')?.addEventListener('click', () => {
      if (projectsCurrentPage > 1) {
        projectsCurrentPage--;
        updateProjectsDisplay();
      }
    });

    controls.querySelector('.next-btn')?.addEventListener('click', () => {
      if (projectsCurrentPage < totalPages) {
        projectsCurrentPage++;
        updateProjectsDisplay();
      }
    });

    controls.querySelectorAll('.num-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        projectsCurrentPage = parseInt(e.target.textContent);
        updateProjectsDisplay();
      });
    });
  }
}

/**
 * Handle new project submissions
 */
function hookProjectSubmit() {
  const submitBtn = document.getElementById('project-submit-btn');
  if (!submitBtn) return;

  submitBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const name = document.getElementById('project-name').value.trim();
    const client = document.getElementById('project-client').value.trim();
    const manager = document.getElementById('project-manager').value.trim();
    const status = document.getElementById('project-status')?.value || 'active';

    if (!name) {
      alert('Project Name is required!');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';

      const { error } = await sbClient
        .from('projects')
        .insert([{
          name: name,
          client: client || null,
          manager: manager || null,
          status: status
        }]);

      if (error && (error.message.includes('relation') || error.message.includes('does not exist'))) {
        alert('Notice: To support custom projects, please run the SQL script provided! In the meantime, you can add items with this project name to associate them.');
        window.location.hash = '';
        return;
      }

      if (error) throw error;

      alert('Project created successfully!');
      window.location.hash = ''; // close modal

      // Reset form
      document.getElementById('project-form').reset();

      // Refresh listings
      if (typeof window.invalidateCache === 'function') window.invalidateCache();
      await initializeProjectsCatalog();

    } catch (err) {
      console.error(err);
      alert('Error creating project: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Project';
    }
  });
}

/**
 * Expose dataset updates globally for project_detail tables
 */
window.updateInventoryDataset = function(newDataset) {
  const items = newDataset.filter(i => {
    const t = (i.type ?? '').toLowerCase();
    return !t.startsWith('asset:') && !t.startsWith('tool:');
  });

  const assets = newDataset.filter(i => {
    const t = (i.type ?? '').toLowerCase();
    return t.startsWith('asset:');
  });

  // Render Items table
  const itemsTbody = document.querySelector('#content-items .list-table tbody');
  if (itemsTbody) {
    itemsTbody.innerHTML = items.length
      ? items.map(item => {
          const rawType = item.type ?? '';
          const displayType = rawType.includes(':') ? rawType.split(':')[1] : rawType;
          return `
            <tr>
              <td><input type="checkbox"></td>
              <td class="searchable-name">${item.item_name ?? '—'}</td>
              <td><div class="item-image" style="${item.image_url ? `background-image:url('${item.image_url}'); background-size:cover;` : 'background:#eee;'}"></div></td>
              <td>${item.model ?? '—'}</td>
              <td>${displayType || '—'}</td>
              <td>${item.store || '—'}</td>
              <td>${item.amount ?? 0} pcs</td>
              <td>${item.project ?? '—'}</td>
              <td>${item.status ?? '—'}</td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="9" style="text-align:center;padding:40px;color:#aaa">No items found.</td></tr>`;
  }

  // Render Assets table
  const assetsTbody = document.querySelector('#content-assets .list-table tbody');
  if (assetsTbody) {
    assetsTbody.innerHTML = assets.length
      ? assets.map(asset => {
          const rawType = asset.type ?? '';
          const displayType = rawType.includes(':') ? rawType.split(':')[1] : rawType;
          return `
            <tr>
              <td><input type="checkbox"></td>
              <td class="searchable-name">${asset.item_name ?? '—'}</td>
              <td><div class="item-image" style="${asset.image_url ? `background-image:url('${asset.image_url}'); background-size:cover;` : 'background:#eee;'}"></div></td>
              <td>${asset.model ?? '—'}</td>
              <td>${displayType || '—'}</td>
              <td>${asset.store || '—'}</td>
              <td>${asset.amount ?? 0} pcs</td>
              <td>${asset.project ?? '—'}</td>
              <td>${asset.status ?? '—'}</td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="9" style="text-align:center;padding:40px;color:#aaa">No assets found.</td></tr>`;
  }

  // Update pagination total text
  document.querySelectorAll('.total-records').forEach(el => {
    el.textContent = `Showing 1 to ${newDataset.length} of ${localInventoryCache.length} records`;
  });
};

async function renderProjectDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectName = urlParams.get('name') || 'BDU-DCF';

  // 1. Update project subtitle
  const subtitleEl = document.querySelector('.project-subtitle span');
  if (subtitleEl) {
    subtitleEl.textContent = projectName;
  }

  // 2. Fetch project status from projects table
  try {
    const { data: projData } = await sbClient
      .from('projects')
      .select('status')
      .eq('name', projectName)
      .single();

    if (projData) {
      const isCompleted = projData.status === 'completed';
      const statusBadge = document.getElementById('project-status-badge');

      const badgeHtml = `
        <select id="project-status-select" style="
          margin-left:12px;
          background: ${isCompleted ? '#d1fae5' : '#dbeafe'};
          color: ${isCompleted ? '#065f46' : '#1e40af'};
          font-size: 0.8rem;
          font-weight: 600;
          padding: 4px 24px 4px 12px;
          border-radius: 999px;
          border: 1px solid ${isCompleted ? '#34d399' : '#93c5fd'};
          cursor: pointer;
          appearance: none;
          background-image: url('data:image/svg+xml;utf8,<svg fill=%22${isCompleted ? '%23065f46' : '%231e40af'}%22 height=%2224%22 viewBox=%220 0 24 24%22 width=%2224%22 xmlns=%22http://www.w3.org/2000/svg%22><path d=%22M7 10l5 5 5-5z%22/></svg>');
          background-repeat: no-repeat;
          background-position: right 4px center;
          background-size: 16px;
          outline: none;
        ">
          <option value="active" ${!isCompleted ? 'selected' : ''}><span class="material-symbols-outlined" style="font-size:inherit; vertical-align:middle; margin-right:2px;">bolt</span> Active</option>
          <option value="completed" ${isCompleted ? 'selected' : ''}><span class="material-symbols-outlined" style="font-size:inherit; vertical-align:middle; margin-right:2px;">check_circle</span> Completed</option>
        </select>
      `;

      if (statusBadge) {
        statusBadge.innerHTML = badgeHtml;
      } else {
        const subtitleDiv = document.querySelector('.project-subtitle div');
        if (subtitleDiv) {
          subtitleDiv.insertAdjacentHTML('beforeend', `<span id="project-status-badge">${badgeHtml}</span>`);
        }
      }

      setTimeout(() => {
        const selectEl = document.getElementById('project-status-select');
        if (selectEl) {
          selectEl.addEventListener('change', async (e) => {
            const newStatus = e.target.value;
            selectEl.disabled = true;
            try {
              const { error } = await sbClient
                .from('projects')
                .update({ status: newStatus })
                .eq('name', projectName);
                
              if (error) throw error;
              
              // Re-render to update styling
              await renderProjectDetail();
            } catch (err) {
              console.error(err);
              alert('Error updating project status: ' + err.message);
              selectEl.value = isCompleted ? 'completed' : 'active';
            } finally {
              selectEl.disabled = false;
            }
          });
        }
      }, 0);
    }
  } catch (err) {
    console.warn('Could not fetch project status:', err.message);
  }

  // 3. Fetch and filter items for this project
  const { data: fetchedItems, error } = await window.fetchFromDB('items');
  const allItems = fetchedItems ? fetchedItems.filter(i => i.project === projectName) : [];

  if (error) {
    console.error('Error fetching project items:', error.message);
    return;
  }

  // Populate global cache for instant search integration
  localInventoryCache = allItems;

  window.updateInventoryDataset(localInventoryCache);
}
