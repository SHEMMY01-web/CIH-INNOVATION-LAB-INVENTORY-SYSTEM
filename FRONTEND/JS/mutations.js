// js/mutations.js

// ── Notification Popup (replaces alert) ──────────────────────────────────────
const NOTIFY_ICONS = {
  success: 'check_circle',
  error:   'error',
  warning: 'warning',
  info:    'info'
};
const NOTIFY_TITLES = {
  success: 'Success',
  error:   'Error',
  warning: 'Warning',
  info:    'Notice'
};

/**
 * Show a styled notification popup modal.
 * @param {string} message   – The message text to display.
 * @param {'success'|'error'|'warning'|'info'} type – Visual variant (default: 'info').
 */
function showNotify(message, type = 'info') {
  // Remove any existing notification overlay
  const existing = document.getElementById('notify-popup');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'notify-popup';
  overlay.className = 'notify-overlay';
  overlay.innerHTML = `
    <div class="notify-panel">
      <div class="notify-icon ${type}">
        <span class="material-symbols-outlined">${NOTIFY_ICONS[type] || 'info'}</span>
      </div>
      <div class="notify-title">${NOTIFY_TITLES[type] || 'Notice'}</div>
      <div class="notify-message">${message}</div>
      <button class="notify-btn ${type}" id="notify-ok-btn">OK</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Trigger open animation on next frame
  requestAnimationFrame(() => overlay.classList.add('open'));

  // Close handlers
  const close = () => {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 280);
  };

  overlay.querySelector('#notify-ok-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

/**
 * Convert a file object to a Base64 string for database storage
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Populate all dropdown select elements inside #add-modal dynamically
 */
function populateAddModalDropdowns() {
  const modal = document.querySelector('#add-modal');
  if (!modal) return;

  const rawPage = window.location.pathname.split('/').pop();
  const page = (rawPage && !rawPage.endsWith('.html')) ? rawPage + '.html' : rawPage;

  // Robust helper to find select element by label text case-insensitively
  const findSelectByLabel = (text) => {
    const group = Array.from(modal.querySelectorAll('.form-group')).find(fg => 
      fg.querySelector('label')?.textContent.toLowerCase().includes(text.toLowerCase())
    );
    return group?.querySelector('select');
  };

  // 1. Replace Type select element with a custom text input if it exists
  const typeGroup = Array.from(modal.querySelectorAll('.form-group')).find(fg => 
    fg.querySelector('label')?.textContent.toLowerCase().includes('type')
  );
  const typeSelect = typeGroup?.querySelector('select');
  if (typeSelect) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = page === 'assets.html' ? 'Enter asset type (e.g. Laptop)' : 'Enter item type (e.g. Stationery)';
    input.style.cssText = 'width: 100%; padding: 12px 16px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px; background: var(--card-background); color: var(--text-color); margin-top: 5px;';
    typeSelect.replaceWith(input);
  }

  // 2. Status/Availability selection
  const statusSelect = findSelectByLabel('status') || findSelectByLabel('availability');
  if (statusSelect) {
    statusSelect.innerHTML = `
      <option value="">Choose Availability</option>
      <option value="available">Available</option>
      <option value="unavailable">Unavailable</option>
    `;
  }

  // 3. Unit of Measurement selection
  const uomSelect = findSelectByLabel('unit');
  if (uomSelect) {
    uomSelect.innerHTML = `
      <option value="">Choose Unit</option>
      <option value="pcs">pcs</option>
      <option value="box">box</option>
      <option value="meters">meters</option>
    `;
  }

  // 4. Currency selection
  const currencySelect = findSelectByLabel('currency');
  if (currencySelect) {
    currencySelect.innerHTML = `
      <option value="">Choose Currency</option>
      <option value="USD">USD ($)</option>
      <option value="GHS">GHS (₵)</option>
      <option value="EUR">EUR (€)</option>
    `;
  }

  // 5. Store selection
  const storeSelect = findSelectByLabel('store') || findSelectByLabel('account');
  if (storeSelect) {
    storeSelect.innerHTML = `
      <option value="">Choose Account</option>
      <option value="HQ main">HQ main</option>
      <option value="22 House Store">22 House Store</option>
      <option value="Tafo House Store">Tafo House Store</option>
    `;
  }

  // 6. Project selection replaced dynamically with a text input field so the user can type it
  const projectGroup = Array.from(modal.querySelectorAll('.form-group')).find(fg => 
    fg.querySelector('label')?.textContent.toLowerCase().includes('project')
  );
  const projectSelect = projectGroup?.querySelector('select');
  if (projectSelect) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter project name (e.g. CIH Lab)';
    input.style.cssText = 'width: 100%; padding: 12px 16px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px; background: var(--card-background); color: var(--text-color); margin-top: 5px;';
    projectSelect.replaceWith(input);
  }

  // 7. Department selection
  const deptSelect = findSelectByLabel('department');
  if (deptSelect) {
    deptSelect.innerHTML = `
      <option value="">Choose department</option>
      <option value="Engineering">Engineering</option>
      <option value="Operations">Operations</option>
      <option value="Management">Management</option>
    `;
  }

  // 8. Category selection
  const catSelect = findSelectByLabel('category');
  if (catSelect) {
    catSelect.innerHTML = `
      <option value="">Choose category</option>
      <option value="Electronics">Electronics</option>
      <option value="Hardware">Hardware</option>
      <option value="Consumables">Consumables</option>
    `;
  }

  // 9. Manufacturer selection
  const mfgSelect = findSelectByLabel('manufacturer');
  if (mfgSelect) {
    mfgSelect.innerHTML = `
      <option value="">Choose manufacturer</option>
      <option value="Generic">Generic</option>
      <option value="Custom">Custom</option>
    `;
  }
}

/**
 * Handle adding a new item dynamically from any add-modal form group layout
 */
function hookAddModalSubmit() {
  const modal = document.querySelector('#add-modal');
  if (!modal) return;

  const addBtn = modal.querySelector('.modal-btn');
  if (!addBtn) return;

  addBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const rawPage = window.location.pathname.split('/').pop();
    const page = (rawPage && !rawPage.endsWith('.html')) ? rawPage + '.html' : rawPage;
    const formGroups = Array.from(modal.querySelectorAll('.form-group'));
    let itemData = {
      item_name: '',
      model: '',
      type: '',
      store: '',
      amount: 0,
      perfectly_working: 0,
      not_working: 0,
      to_be_received: 0,
      supplier: '',
      project: '',
      status: 'available',
      image_url: ''
    };

    for (const fg of formGroups) {
      const label = fg.querySelector('label')?.textContent.toLowerCase() ?? '';
      const input = fg.querySelector('input');
      const select = fg.querySelector('select');

      if (label.includes('name')) {
        itemData.item_name = input?.value.trim() || '';
      } else if (label.includes('serial') || label.includes('model') || label.includes('number')) {
        itemData.model = input?.value.trim() || '';
      } else if (label.includes('type')) {
        const customType = input?.value.trim() || '';
        const formTargetType = document.getElementById('add-project-item-form')?.getAttribute('data-target-type');
        
        if (page === 'assets.html' || formTargetType === 'asset') {
          itemData.type = `asset:${customType}`;
        } else if (page === 'tools.html' || formTargetType === 'tool') {
          itemData.type = `tool:${customType}`;
        } else {
          itemData.type = `item:${customType}`;
        }
      } else if (label.includes('measurement') || label.includes('unit')) {
        itemData.store = input?.value || select?.value || '';
      } else if (label.includes('amount')) {
        itemData.amount = parseInt(input?.value) || 0;
      } else if (label.includes('perfectly')) {
        itemData.perfectly_working = parseInt(input?.value) || 0;
      } else if (label.includes('condition') || label.includes('not working')) {
        itemData.not_working = parseInt(input?.value) || 0;
      } else if (label.includes('received')) {
        itemData.to_be_received = parseInt(input?.value) || 0;
      } else if (label.includes('supplier')) {
        itemData.supplier = input?.value.trim() || '';
      } else if (label.includes('project')) {
        itemData.project = input?.value.trim() || select?.value || '';
      } else if (label.includes('status') || label.includes('availability')) {
        itemData.status = select?.value || 'available';
      } else if (label.includes('image')) {
        if (input && input.files && input.files[0]) {
          try {
            itemData.image_url = await fileToBase64(input.files[0]);
          } catch (err) {
            console.error('Failed to convert image:', err);
          }
        }
      }
    }

    if (!itemData.item_name) {
      showNotify('Item Name is required!', 'warning');
      return;
    }

    try {
      addBtn.disabled = true;
      addBtn.textContent = 'Adding...';

      // --- DUPLICATE CHECKING LOGIC ---
      const normalizedName = itemData.item_name.replace(/\s+/g, '').toLowerCase();
      const { data: existingItems } = await sbClient.from('items').select('item_name');
      const duplicate = existingItems?.find(i => (i.item_name || '').replace(/\s+/g, '').toLowerCase() === normalizedName);
      if (duplicate) {
        showNotify(`An item with a similar name ("${duplicate.item_name}") already exists. To prevent duplicates, please update the existing item or use its exact name.`, 'warning');
        addBtn.disabled = false;
        addBtn.textContent = 'Add';
        return;
      }

      // --- PROJECT ASSIGNMENT LOGIC ---
      if (page === 'project_detail.html' && itemData.project) {
        // Find general item with same name (where project is null or empty)
        const { data: allItems } = await sbClient
          .from('items')
          .select('*')
          .ilike('item_name', itemData.item_name);
          
        const generalItem = allItems?.find(i => !i.project || i.project.trim() === '');
        
        // Strict Validation: Item MUST exist in general catalog
        if (!generalItem) {
          showNotify(`Access Denied: '${itemData.item_name}' does not exist in the general inventory. Please add it to the main catalog before assigning it to a project.`, 'error');
          addBtn.disabled = false;
          addBtn.textContent = 'Save';
          return;
        }

        // If it's an item (consumable, not asset or tool), subtract from general catalog
        if (!itemData.type.startsWith('asset:') && !itemData.type.startsWith('tool:')) {
          if (itemData.amount > generalItem.amount) {
            showNotify(`Access Denied: Insufficient stock. You want to assign ${itemData.amount}, but only ${generalItem.amount} are available in the general inventory.`, 'error');
            addBtn.disabled = false;
            addBtn.textContent = 'Save';
            return;
          }

          // Subtract the amount, floor at 0
          const newAmount = Math.max(0, generalItem.amount - itemData.amount);
          const { error: updErr } = await sbClient
            .from('items')
            .update({ amount: newAmount })
            .eq('id', generalItem.id);
            
          if (updErr) console.error("Error subtracting amount from general inventory:", updErr);
        }
      }
      // --------------------------------

      const { error } = await sbClient
        .from('items')
        .insert([itemData]);

      if (error) throw error;

      showNotify('Item added successfully!', 'success');
      window.location.hash = ''; // close modal

      // Clear input fields
      formGroups.forEach(fg => {
        const input = fg.querySelector('input');
        if (input) input.value = '';
        const display = fg.querySelector('.file-input-display');
        if (display) display.innerHTML = `Choose file <span><span class="material-symbols-outlined" style="vertical-align:middle; font-size:18px;">attach_file</span></span>`;
      });

      // Clear cache to ensure new data is loaded
      if (typeof window.invalidateCache === 'function') window.invalidateCache();

      // Force a full reload to reflect changes automatically
      window.location.reload();
      
    } catch (err) {
      console.error(err);
      showNotify('Error adding item: ' + err.message, 'error');
    } finally {
      addBtn.disabled = false;
      addBtn.textContent = 'Add';
    }
  });
}

/**
 * Dynamic Injection of the unified Edit Item Modal
 */
function injectEditModal() {
  if (document.getElementById('edit-modal')) return;

  const modalHtml = `
    <div id="edit-modal" class="side-modal-overlay">
      <div class="side-modal-panel">
        <div class="modal-header">
          <h2>Edit Item Details</h2>
          <button class="close-btn" style="background:none; border:none; color:var(--text-color); font-size:24px; cursor:pointer;" onclick="const m = document.getElementById('edit-modal'); m.classList.remove('open'); setTimeout(() => { m.style.display='none'; }, 300);">&times;</button>
        </div>
        
        <div class="modal-body" style="padding-top:20px;">
          <form id="edit-form" class="form-grid">
            <input type="hidden" id="edit-item-id">
            
            <div class="form-group">
              <label>Item Name <span class="required">*</span></label>
              <input type="text" id="edit-item-name" placeholder="Enter item name">
            </div>

            <div class="form-group">
              <label>Model / Serial Number</label>
              <input type="text" id="edit-item-model" placeholder="Enter model">
            </div>

            <div class="form-group">
              <label>Type <span class="required">*</span></label>
              <input type="text" id="edit-item-type" placeholder="Enter type">
            </div>

            <div class="form-group">
              <label>Amount <span class="required">*</span></label>
              <input type="number" id="edit-item-amount" placeholder="Enter amount">
            </div>

            <div class="form-group">
              <label>Status <span class="required">*</span></label>
              <select id="edit-item-status">
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>

            <div class="form-group" id="edit-store-group">
              <label>Measurement Unit</label>
              <input type="text" id="edit-item-store" placeholder="e.g. pcs, meters" list="measurement-options">
            </div>

            <div class="form-group">
              <label>Perfectly Working</label>
              <input type="number" id="edit-item-perfectly-working" placeholder="Amount perfectly working" value="0">
            </div>

            <div class="form-group">
              <label>Not in Good Condition</label>
              <input type="number" id="edit-item-not-working" placeholder="Amount not working" value="0">
            </div>

            <div class="form-group">
              <label>To Be Received</label>
              <input type="number" id="edit-item-to-be-received" placeholder="Amount to be received" value="0">
            </div>

            <div class="form-group">
              <label>Supplier</label>
              <input type="text" id="edit-item-supplier" placeholder="Enter supplier name">
            </div>

            <div class="form-group" id="edit-project-group">
              <label>Project</label>
              <input type="text" id="edit-item-project" placeholder="Enter project name">
            </div>

            <div class="form-group">
              <label>Image</label>
              <div class="file-input-wrapper">
                <input type="file" id="edit-item-image">
                <div class="file-input-display" id="edit-item-image-display">
                  Choose file <span><span class="material-symbols-outlined" style="vertical-align:middle; font-size:18px;">attach_file</span></span>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" onclick="const m = document.getElementById('edit-modal'); m.classList.remove('open'); setTimeout(() => { m.style.display='none'; }, 300);">Cancel</button>
          <button class="btn-primary" id="edit-save-btn">Save Changes</button>
        </div>
      </div>
    </div>
  `;

  const div = document.createElement('div');
  div.innerHTML = modalHtml;
  document.body.appendChild(div.firstElementChild);

  // Bind change event specifically to edit modal image selector
  const editImage = document.getElementById('edit-item-image');
  editImage?.addEventListener('change', () => {
    const display = document.getElementById('edit-item-image-display');
    if (display && editImage.files && editImage.files[0]) {
      const name = editImage.files[0].name;
      const shortName = name.length > 22 ? name.substring(0, 19) + '...' : name;
      display.innerHTML = `${shortName} <span style="color:var(--primary-color); font-weight:bold; margin-left:5px;"><span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle;">check_circle</span></span>`;
    }
  });
}

/**
 * Open the edit modal populated with the target item's info
 */
let currentEditingItem = null;

async function openEditModal(itemId) {
  currentEditingItem = localInventoryCache.find(i => i.id === itemId);
  if (!currentEditingItem) return;

  injectEditModal();

  const rawPage = window.location.pathname.split('/').pop();
  const page = (rawPage && !rawPage.endsWith('.html')) ? rawPage + '.html' : rawPage;

  document.getElementById('edit-item-id').value = currentEditingItem.id;
  document.getElementById('edit-item-name').value = currentEditingItem.item_name ?? '';
  document.getElementById('edit-item-model').value = currentEditingItem.model ?? '';
  
  const rawType = currentEditingItem.type ?? '';
  document.getElementById('edit-item-type').value = rawType.includes(':') ? rawType.split(':')[1] : rawType;
  
  document.getElementById('edit-item-amount').value = currentEditingItem.amount ?? 0;
  
  const pwEl = document.getElementById('edit-item-perfectly-working');
  if (pwEl) pwEl.value = currentEditingItem.perfectly_working ?? 0;
  
  const nwEl = document.getElementById('edit-item-not-working');
  if (nwEl) nwEl.value = currentEditingItem.not_working ?? 0;

  const tbrEl = document.getElementById('edit-item-to-be-received');
  if (tbrEl) tbrEl.value = currentEditingItem.to_be_received ?? 0;
  
  const supEl = document.getElementById('edit-item-supplier');
  if (supEl) supEl.value = currentEditingItem.supplier ?? '';

  document.getElementById('edit-item-status').value = currentEditingItem.status ?? 'available';

  // Toggle store/project visibility and values
  const storeGroup = document.getElementById('edit-store-group');
  const projectGroup = document.getElementById('edit-project-group');

  if (storeGroup) {
    storeGroup.style.display = 'block';
    document.getElementById('edit-item-store').value = currentEditingItem.store ?? '';
  }

  if (page === 'assets.html' || page === 'items.html') {
    if (projectGroup) projectGroup.style.display = 'none';
  } else {
    if (projectGroup) {
      projectGroup.style.display = 'block';
      const editProjectInput = document.getElementById('edit-item-project');
      if (editProjectInput) {
        editProjectInput.value = currentEditingItem.project ?? '';
      }
    }
  }

  // Clear image files
  const fileInput = document.getElementById('edit-item-image');
  if (fileInput) fileInput.value = '';
  const display = document.getElementById('edit-item-image-display');
  if (display) {
    display.innerHTML = currentEditingItem.image_url ? `Has image <span style="color:#10b981; font-weight:bold;"><span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle;">check_circle</span></span>` : `Choose file <span><span class="material-symbols-outlined" style="vertical-align:middle; font-size:18px;">attach_file</span></span>`;
  }

  // Display modal
  const editModal = document.getElementById('edit-modal');
  if (editModal) {
    editModal.style.display = 'block';
    // Add open class for clean CSS sidebar transition
    setTimeout(() => {
      editModal.classList.add('open');
    }, 10);
  }
}

/**
 * Bind Edit save events
 */
function hookEditSaveSubmit() {
  document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'edit-save-btn') {
      e.preventDefault();
      const saveBtn = e.target;
      const itemId = document.getElementById('edit-item-id').value;
      if (!itemId || !currentEditingItem) return;

      const rawPage = window.location.pathname.split('/').pop();
      const page = (rawPage && !rawPage.endsWith('.html')) ? rawPage + '.html' : rawPage;
      const name = document.getElementById('edit-item-name').value.trim();
      const model = document.getElementById('edit-item-model').value.trim();
      const amount = parseInt(document.getElementById('edit-item-amount').value) || 0;
      
      const pwEl = document.getElementById('edit-item-perfectly-working');
      const perfectly_working = pwEl ? (parseInt(pwEl.value) || 0) : 0;
      
      const nwEl = document.getElementById('edit-item-not-working');
      const not_working = nwEl ? (parseInt(nwEl.value) || 0) : 0;

      const tbrEl = document.getElementById('edit-item-to-be-received');
      const to_be_received = tbrEl ? (parseInt(tbrEl.value) || 0) : 0;
      
      const supEl = document.getElementById('edit-item-supplier');
      const supplier = supEl ? supEl.value.trim() : '';

      const status = document.getElementById('edit-item-status').value;
      let rawType = document.getElementById('edit-item-type').value.trim();

      const type = page === 'assets.html' ? `asset:${rawType}` : `item:${rawType}`;
      const storeEl = document.getElementById('edit-item-store');
      const store = storeEl ? storeEl.value.trim() : null;
      const project = (page === 'assets.html' || page === 'items.html') ? null : document.getElementById('edit-item-project').value.trim();

      if (!name) {
        showNotify('Item Name is required!', 'warning');
        return;
      }

      try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        let image_url = currentEditingItem.image_url;
        const fileInput = document.getElementById('edit-item-image');
        if (fileInput && fileInput.files && fileInput.files[0]) {
          image_url = await fileToBase64(fileInput.files[0]);
        }

        const { error } = await sbClient
          .from('items')
          .update({
            item_name: name,
            model: model,
            type: type,
            amount: amount,
            perfectly_working: perfectly_working,
            not_working: not_working,
            to_be_received: to_be_received,
            supplier: supplier,
            status: status,
            store: store,
            project: project,
            image_url: image_url
          })
          .eq('id', itemId);

        if (error) throw error;

        showNotify('Item updated successfully!', 'success');
        
        // Hide modal
        const editModal = document.getElementById('edit-modal');
        if (editModal) {
          editModal.classList.remove('open');
          setTimeout(() => { editModal.style.display = 'none'; }, 300);
        }

        // Refresh catalog table
        if (typeof window.invalidateCache === 'function') window.invalidateCache();
        if (typeof fetchInventoryInitial === 'function') {
          await fetchInventoryInitial();
        }

      } catch (err) {
        console.error(err);
        showNotify('Error updating item: ' + err.message, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    }
  });
}

/**
 * Handle filtering items dynamically using checkboxes, dropdowns, and radios
 */
function hookFilterModalSubmit() {
  const modal = document.querySelector('#filter-modal');
  if (!modal) return;

  const applyBtn = modal.querySelector('.center-modal-footer button.btn-primary') || modal.querySelector('.btn-primary');
  if (!applyBtn) return;

  applyBtn.addEventListener('click', (e) => {
    e.preventDefault();

    // 1. Get selected store
    const storeSelect = modal.querySelector('select');
    const selectedStore = storeSelect ? storeSelect.value : '';

    // 2. Get checked stores (checkboxes)
    const storeCheckboxes = Array.from(modal.querySelectorAll('.checkbox-label input[type="checkbox"]'));
    const allowedStores = storeCheckboxes.filter(cb => cb.checked).map(cb => cb.parentNode.textContent.trim());

    // 3. Get checked type (radios)
    const typeRadios = Array.from(modal.querySelectorAll('input[type="radio"]'));
    const selectedTypeRadio = typeRadios.find(r => r.checked);
    const selectedType = selectedTypeRadio ? selectedTypeRadio.parentNode.textContent.trim().toLowerCase() : '';

    // Filter localInventoryCache
    let results = localInventoryCache;

    // Filter by store selection
    if (selectedStore && selectedStore !== 'Select store' && selectedStore !== 'Select Store') {
      results = results.filter(i => (i.store ?? '').toLowerCase() === selectedStore.toLowerCase());
    } else if (allowedStores.length > 0) {
      // Filter by checked checkboxes
      results = results.filter(i => allowedStores.some(store => (i.store ?? '').toLowerCase() === store.toLowerCase()));
    }

    // Filter by type radio button
    if (selectedType) {
      results = results.filter(i => {
        const t = (i.type ?? '').toLowerCase();
        if (selectedType.includes('item')) return !t.startsWith('asset:') && !t.startsWith('tool:');
        if (selectedType.includes('tool')) return t.startsWith('tool:');
        if (selectedType.includes('asset')) return t.startsWith('asset:');
        return true;
      });
    }

    // Update frontend table dataset snappy
    if (typeof window.updateInventoryDataset === 'function') {
      window.updateInventoryDataset(results);
    }

    window.location.hash = ''; // close modal
  });
}

/**
 * Global listener to show file uploads in custom design inputs snappy
 */
function hookFileInputChanges() {
  document.addEventListener('change', (e) => {
    if (e.target && e.target.type === 'file') {
      const fileInput = e.target;
      if (fileInput.id === 'edit-item-image') return; // handled separately in modal creation
      
      const display = fileInput.parentNode.querySelector('.file-input-display');
      if (display) {
        if (fileInput.files && fileInput.files[0]) {
          const name = fileInput.files[0].name;
          const shortName = name.length > 22 ? name.substring(0, 19) + '...' : name;
          display.innerHTML = `${shortName} <span style="color:var(--primary-color); font-weight:bold; margin-left:5px;"><span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle;">check_circle</span></span>`;
        } else {
          display.innerHTML = `Choose file <span><span class="material-symbols-outlined" style="vertical-align:middle; font-size:18px;">attach_file</span></span>`;
        }
      }
    }
  });
}

/**
 * Fetch available items for the transaction modal, filtered by transaction type.
 * - Checkout: shows general inventory items only (not project-specific)
 * - Return: shows only items that were previously borrowed (have a checkout transaction)
 */
async function populateTransactionItems(txType) {
  const select = document.getElementById('tx-item-id');
  if (!select) return;

  select.innerHTML = '<option value="">Loading...</option>';

  if (!txType) {
    const txTypeEl = document.getElementById('tx-type');
    txType = txTypeEl ? txTypeEl.value : 'checkout';
  }

  if (txType === 'return') {
    // For returns: only show items that still have an outstanding borrowed balance
    const { data: txData, error: txError } = await window.fetchFromDB('transactions');
    if (txError) {
      console.error('Error fetching transactions for return modal:', txError.message);
      select.innerHTML = '<option value="">Error loading items</option>';
      return;
    }

    // Calculate net outstanding borrows per item_id
    // (total checkouts - total returns). Only show items with a positive net balance.
    const balanceMap = new Map(); // item_id -> { item, netBorrowed }
    (txData || []).forEach(t => {
      if (!t.item_id || !t.items) return;
      if (!balanceMap.has(t.item_id)) {
        balanceMap.set(t.item_id, { item: t.items, netBorrowed: 0 });
      }
      const entry = balanceMap.get(t.item_id);
      if (t.transaction_type === 'checkout' || t.transaction_type === 'request') {
        entry.netBorrowed += (t.amount || 0);
      } else if (t.transaction_type === 'return') {
        entry.netBorrowed -= (t.amount || 0);
      }
    });

    // Filter to only items with a positive outstanding balance
    const outstandingItems = Array.from(balanceMap.entries())
      .filter(([, entry]) => entry.netBorrowed > 0)
      .sort((a, b) => (a[1].item.item_name || '').localeCompare(b[1].item.item_name || ''));

    if (outstandingItems.length === 0) {
      select.innerHTML = '<option value="">No borrowed items to return</option>';
      return;
    }

    select.innerHTML = '<option value="">Choose Borrowed Item to Return...</option>' +
      outstandingItems
        .map(([id, entry]) => `<option value="${id}">${entry.item.item_name} (Outstanding: ${entry.netBorrowed} ${entry.item.store || 'pcs'})</option>`)
        .join('');

  } else {
    // For checkout: show general inventory items only
    const { data: unsortedData, error } = await window.fetchFromDB('items');
    const data = unsortedData ? unsortedData.slice().sort((a, b) => (a.item_name || '').localeCompare(b.item_name || '')) : [];

    if (error) {
      console.error('Error fetching items for transaction:', error.message);
      select.innerHTML = '<option value="">Error loading items</option>';
      return;
    }

    const generalData = data.filter(i => !i.project || i.project.trim() === '');

    select.innerHTML = '<option value="">Choose Item...</option>' + 
      generalData.map(i => `<option value="${i.id}">${i.item_name} (Stock: ${i.amount} ${i.store || 'pcs'})</option>`).join('');
  }
}

/**
 * Handle checkout or return submission safely, updating inventory real-time
 */
function hookTransactionSubmit() {
  const submitBtn = document.getElementById('tx-submit-btn');
  if (!submitBtn) return;

  submitBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const txType = document.getElementById('tx-type').value;
    const itemId = document.getElementById('tx-item-id').value;
    const amount = parseInt(document.getElementById('tx-amount').value) || 0;
    const requester = document.getElementById('tx-requester').value.trim();
    const project = document.getElementById('tx-project').value.trim();

    if (!itemId) {
      showNotify('Please select an item!', 'warning');
      return;
    }
    if (amount <= 0) {
      showNotify('Amount must be greater than 0!', 'warning');
      return;
    }
    if (!requester) {
      showNotify('Requester name is required!', 'warning');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      // 1. Fetch item stock
      const { data: itemData, error: fetchErr } = await sbClient
        .from('items')
        .select('amount')
        .eq('id', itemId)
        .single();

      if (fetchErr) throw fetchErr;

      let newAmount = itemData.amount;
      if (txType === 'checkout') {
        if (itemData.amount < amount) {
          showNotify('Insufficient stock available! Current stock: ' + itemData.amount, 'error');
          return;
        }
        newAmount = itemData.amount - amount;
      } else {
        newAmount = itemData.amount + amount;
      }

      // Convert Proof Image to Base64
      let txImageUrl = null;
      const fileInput = document.getElementById('tx-image');
      if (fileInput && fileInput.files && fileInput.files[0]) {
        try {
          txImageUrl = await fileToBase64(fileInput.files[0]);
        } catch (err) {
          console.error('Failed to convert transaction proof image:', err);
        }
      }

      // 2. Update stock in items table
      const { error: updateErr } = await sbClient
        .from('items')
        .update({ amount: newAmount })
        .eq('id', itemId);

      if (updateErr) throw updateErr;

      // 3. Insert transaction log
      const insertData = {
        item_id: itemId,
        transaction_type: txType,
        amount: amount,
        requester: requester,
        project: project,
        timestamp: new Date().toISOString()
      };

      if (txImageUrl) {
        insertData.image_url = txImageUrl;
      }

      let { error: insertErr } = await sbClient
        .from('transactions')
        .insert([insertData]);

      // Graceful fallback if the Supabase table hasn't had ADD COLUMN image_url executed yet
      if (insertErr && (insertErr.message?.includes('image_url') || insertErr.message?.includes('schema cache'))) {
        console.warn('Fallback: image_url column not in schema cache. Saving transaction without proof image...');
        delete insertData.image_url;
        const retry = await sbClient
          .from('transactions')
          .insert([insertData]);
        insertErr = retry.error;
      }

      if (insertErr) throw insertErr;

      showNotify('Transaction logged successfully!', 'success');
      
      // Close modal
      window.location.hash = '';

      // Reset form
      document.getElementById('transaction-form').reset();
      const display = document.getElementById('tx-image-display');
      if (display) display.innerHTML = `Choose file <span><span class="material-symbols-outlined" style="vertical-align:middle; font-size:18px;">attach_file</span></span>`;

      // Refresh listings — invalidate both items & transactions cache then reload
      if (typeof window.invalidateCache === 'function') {
        window.invalidateCache('transactions');
        window.invalidateCache('items');
      }
      window.location.reload();

    } catch (err) {
      console.error(err);
      showNotify('Transaction failed: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Transaction';
    }
  });
}

/**
 * Handle checking out an item safely via Supabase RPC
 */
async function processCheckout(itemId, checkoutAmount, requesterName, project) {
  const item = localInventoryCache.find(i => i.id === itemId);
  if (!item || item.amount < checkoutAmount) {
    showNotify('Insufficient stock!', 'error');
    return;
  }

  try {
    const { error: updateError } = await sbClient
      .rpc('decrement_stock', {
        item_id: itemId,
        check_amount: checkoutAmount
      });

    if (updateError) throw updateError;

    const { error: insertError } = await sbClient
      .from('transactions')
      .insert([{
        item_id: itemId,
        transaction_type: 'checkout',
        amount: checkoutAmount,
        requester: requesterName,
        project: project,
        timestamp: new Date().toISOString()
      }]);

    if (insertError) throw insertError;

    item.amount -= checkoutAmount;
    const row = document.querySelector(`tr[data-id="${itemId}"]`);
    if (row) row.cells[6].textContent = `${item.amount} pcs`;

    showNotify('Checkout successful!', 'success');
    window.location.hash = '';
    
    if (typeof window.invalidateCache === 'function') window.invalidateCache();

  } catch (error) {
    console.error('Transaction Failed:', error.message);
    showNotify('Checkout failed. Please try again.', 'error');
  }
}

// Automatically bind listeners on startup
document.addEventListener('DOMContentLoaded', () => {
  populateAddModalDropdowns();
  hookAddModalSubmit();
  hookFilterModalSubmit();
  hookFileInputChanges();
  hookEditSaveSubmit();

  const rawPage = window.location.pathname.split('/').pop();
  const page = (rawPage && !rawPage.endsWith('.html')) ? rawPage + '.html' : rawPage;
  if (page === 'request.html') {
    populateTransactionItems('checkout'); // default to checkout items on load
    hookTransactionSubmit();

    // Re-populate item dropdown when transaction type changes
    const txTypeEl = document.getElementById('tx-type');
    if (txTypeEl) {
      txTypeEl.addEventListener('change', (e) => {
        populateTransactionItems(e.target.value);
      });
    }
  }

  // Event Delegation for dynamic Edit button triggers
  document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-row-btn');
    if (editBtn) {
      e.preventDefault();
      const itemId = editBtn.getAttribute('data-id');
      openEditModal(itemId);
    }
  });
});
