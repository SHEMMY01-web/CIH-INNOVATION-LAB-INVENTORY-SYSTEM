import React, { useEffect, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../contexts/AlertContext';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import Pagination from '../components/Pagination';
import ImageLightbox from '../components/ImageLightbox';
import EditItemModal from '../components/EditItemModal';
import FilterModal from '../components/FilterModal';
import ActiveFilterBar from '../components/ActiveFilterBar';
import { exportToCSV } from '../utils/exportUtils';
import { smartSearch } from '../utils/searchUtils';
import { classifyItem, isLabAsset, getItemTypeLabel, enrichItemsWithType } from '../utils/inventoryClassifier';
import '../styles/table_layout.css';
import '../styles/modal.css';

function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

function getItemImage(item) {
  if (item.image_url) return item.image_url;
  const slug = slugify(item.item_name);
  return slug ? `/IMAGES/items/${slug}.webp` : null;
}

export default function Assets() {
  const { user, isLoggingOut } = useAuth();
  const { showSuccess, showError, showWarning } = useAlert();
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [lightboxItem, setLightboxItem] = useState(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState({ status: 'all', category: 'all', unit: 'all' });

  // Add Asset State
  const [newAsset, setNewAsset] = useState({
    item_name: '',
    model: '',
    type: 'asset:general',
    amount: 1,
    store: 'pcs',
    perfectly_working: 1,
    not_working: 0,
    to_be_received: 0,
    supplier: '',
    status: 'available',
    image_url: ''
  });
  const [addImagePreview, setAddImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchAssets();
  }, [user]);

  // Dismiss Add modal on Escape key (WCAG 2.1 AA)
  useEffect(() => {
    if (!isAddModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsAddModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddModalOpen]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) {
        const enriched = enrichItemsWithType(data);
        setAssets(enriched.filter(i => {
          const t = (i.type || '').toLowerCase();
          return (t.startsWith('asset:') || isLabAsset(i)) && (!i.project || i.project.trim() === '');
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  // Reset to page 1 on search or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterCriteria]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterCriteria.status && filterCriteria.status !== 'all') count++;
    if (filterCriteria.category && filterCriteria.category !== 'all') count++;
    if (filterCriteria.unit && filterCriteria.unit !== 'all') count++;
    return count;
  }, [filterCriteria]);

  const handleRemoveFilter = (filterKey) => {
    setFilterCriteria(prev => ({ ...prev, [filterKey]: 'all' }));
  };

  const handleClearAllFilters = () => {
    setFilterCriteria({ status: 'all', category: 'all', unit: 'all', store: 'all' });
  };

  // Apply filters
  const activeAssets = useMemo(() => {
    return assets.filter(item => {
      // Unit filter (matches item.store)
      if (filterCriteria.unit && filterCriteria.unit !== 'all' && item.store !== filterCriteria.unit) {
        return false;
      }
      // Category filter
      if (filterCriteria.category && filterCriteria.category !== 'all') {
        const cat = classifyItem(item);
        if (cat !== filterCriteria.category) return false;
      }
      // Status filter
      if (filterCriteria.status === 'in_stock') {
        const amt = Number(item.amount) || 0;
        if (amt <= 0 || item.status === 'Out of Stock') return false;
      } else if (filterCriteria.status === 'low_stock') {
        const amt = Number(item.amount) || 0;
        if (amt <= 0 || amt > 5) return false;
      } else if (filterCriteria.status === 'out_of_stock') {
        const amt = Number(item.amount) || 0;
        if (amt > 0 && item.status !== 'Out of Stock') return false;
      }
      return true;
    });
  }, [assets, filterCriteria]);

  // Ambiguity-resilient fuzzy search
  const filteredAssets = useMemo(() => {
    return smartSearch(activeAssets, search, item => [
      item.item_name || '',
      item.model || '',
      item.type || '',
      item.supplier || ''
    ]);
  }, [activeAssets, search]);

  // Paginated records
  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAssets.slice(start, start + pageSize);
  }, [filteredAssets, currentPage, pageSize]);

  const handleAddImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      showWarning('Image file size must be under 8MB', 'File Too Large');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 600;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/webp', 0.88);
        setAddImagePreview(dataUrl);
        setNewAsset(prev => ({ ...prev, image_url: dataUrl }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleAddAsset = async (e) => {
    e.preventDefault();
    if (!newAsset.item_name.trim()) {
      showWarning('Please provide an asset name', 'Missing Asset Name');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .insert([{
          item_name: newAsset.item_name.trim(),
          model: newAsset.model.trim() || '-',
          type: newAsset.type || 'asset:general',
          amount: Number(newAsset.amount) || 1,
          store: newAsset.store || 'pcs',
          perfectly_working: Number(newAsset.perfectly_working) || 0,
          not_working: Number(newAsset.not_working) || 0,
          to_be_received: Number(newAsset.to_be_received) || 0,
          supplier: newAsset.supplier || '',
          status: newAsset.status || 'available',
          image_url: newAsset.image_url || ''
        }])
        .select();

      if (error) throw error;

      await showSuccess('Lab asset added successfully!');
      await fetchAssets();
      setIsAddModalOpen(false);
      setNewAsset({
        item_name: '',
        model: '',
        type: 'asset:general',
        amount: 1,
        store: 'pcs',
        perfectly_working: 1,
        not_working: 0,
        to_be_received: 0,
        supplier: '',
        status: 'available',
        image_url: ''
      });
      setAddImagePreview(null);
    } catch (err) {
      showError('Error creating asset: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return <Navigate to={isLoggingOut ? "/" : "/login"} replace />;
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="main-content">
        <Topbar onSearch={(e) => setSearch(e.target.value)} />

        <div className="table-container">
          <div className="table-toolbar">
            <div className="toolbar-actions">
              <button type="button" onClick={() => setIsAddModalOpen(true)} className="action-btn primary">
                <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px', marginRight: '4px' }}>add_circle</span> Add Asset
              </button>
              <button 
                type="button" 
                className="action-btn"
                onClick={() => exportToCSV(filteredAssets, [
                  { label: 'Asset Name', key: 'item_name' },
                  { label: 'Model', key: 'model' },
                  { label: 'Type', key: 'type', transform: val => val?.includes(':') ? val.split(':')[1] : val },
                  { label: 'Amount', key: 'amount' },
                  { label: 'Unit', key: 'store' },
                  { label: 'Perfect Condition', key: 'perfectly_working' },
                  { label: 'Needs Repair', key: 'not_working' },
                  { label: 'Status', key: 'status' }
                ], 'assets_inventory.csv')}
              >
                <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px', marginRight: '4px' }}>download</span> Export
              </button>
              <button 
                type="button" 
                className={`action-btn ${activeFilterCount > 0 ? 'primary' : ''}`}
                onClick={() => setIsFilterModalOpen(true)}
              >
                <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px', marginRight: '4px' }}>filter_alt</span> 
                Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>
            </div>
          </div>

          <ActiveFilterBar
            filters={filterCriteria}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={handleClearAllFilters}
          />

          <div className="data-table-wrapper">
            <table className="list-table">
              <thead>
                <tr>
                  <th>Asset Name ↕</th>
                  <th>Image</th>
                  <th>Model</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Perfectly Working</th>
                  <th>Not in Good Cond.</th>
                  <th>Availability</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 7 }).map((_, idx) => (
                    <tr key={`skel-asset-${idx}`}>
                      <td><span className="skeleton-box skeleton-text" style={{ width: '65%' }}></span></td>
                      <td><span className="skeleton-box skeleton-img"></span></td>
                      <td><span className="skeleton-box skeleton-text" style={{ width: '45%' }}></span></td>
                      <td><span className="skeleton-box skeleton-text" style={{ width: '50%' }}></span></td>
                      <td><span className="skeleton-box skeleton-text" style={{ width: '35%' }}></span></td>
                      <td><span className="skeleton-box skeleton-text" style={{ width: '25%' }}></span></td>
                      <td><span className="skeleton-box skeleton-text" style={{ width: '25%' }}></span></td>
                      <td><span className="skeleton-box skeleton-badge"></span></td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <span className="skeleton-box skeleton-btn"></span>
                          <span className="skeleton-box skeleton-btn"></span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <>
                    {paginatedAssets.map(item => {
                      const itemImg = getItemImage(item);
                      return (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                          <td>
                            {itemImg ? (
                              <img 
                                src={itemImg} 
                                alt={item.item_name} 
                                width="40" 
                                height="40" 
                                style={{ borderRadius: '6px', objectFit: 'contain', background: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer' }} 
                                onClick={() => setLightboxItem({ isOpen: true, imageSrc: itemImg, title: item.item_name })}
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>image</span>
                            )}
                          </td>
                          <td>{item.model && item.model !== '-' ? item.model : '—'}</td>
                          <td>{getItemTypeLabel(item)}</td>
                          <td>{item.amount} {item.store || 'pcs'}</td>
                          <td>{item.perfectly_working || 0}</td>
                          <td>{item.not_working || 0}</td>
                          <td>
                            <span className={`status-badge ${item.amount > 0 ? 'available' : 'unavailable'}`}>
                              {item.amount > 0 ? 'Available' : 'Out of Stock'}
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                            <button 
                              type="button"
                              className="btn-brand-outline view-img-btn"
                              onClick={() => setLightboxItem({ isOpen: true, imageSrc: itemImg, title: item.item_name })}
                              style={{ marginRight: '6px' }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span> View
                            </button>
                            <button 
                              type="button"
                              className="btn-brand edit-row-btn"
                              onClick={() => setEditingItem(item)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span> Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredAssets.length === 0 && (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                          No matching assets found.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalRecords={filteredAssets.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        </div>
      </main>

      {isAddModalOpen && (
      <div className="side-modal-overlay open" style={{ display: 'flex', zIndex: 9999 }} onClick={() => setIsAddModalOpen(false)}>
        <div className="side-modal-panel" role="dialog" aria-modal="true" aria-labelledby="add-asset-modal-title" style={{ width: '640px', maxWidth: '94vw' }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2 id="add-asset-modal-title">Add New Asset</h2>
            <button type="button" className="close-btn" onClick={() => setIsAddModalOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
          </div>
          
          <div className="modal-body" style={{ paddingBottom: '30px' }}>
            <form onSubmit={handleAddAsset}>
              {/* Photo Upload Section */}
              <div style={{
                background: 'var(--topbar-bg, #f8fafc)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '16px',
                marginTop: '10px'
              }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '8px' }}>
                  Asset Photo (Optional)
                </label>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div style={{
                    width: '70px',
                    height: '70px',
                    borderRadius: '8px',
                    border: '2px dashed var(--border-color, #cbd5e1)',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    {addImagePreview ? (
                      <img src={addImagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#94a3b8' }}>image</span>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <label 
                        className="action-btn"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--card-bg)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>upload</span>
                        Upload from Device
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAddImageChange} />
                      </label>
                      {addImagePreview && (
                        <button
                          type="button"
                          onClick={() => { setAddImagePreview(null); setNewAsset(p => ({ ...p, image_url: '' })); }}
                          style={{
                            padding: '6px 10px',
                            fontSize: '0.8rem',
                            color: '#ef4444',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Upload directly, or leave empty to auto-source online.
                    </span>
                  </div>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Asset Type <span className="required">*</span></label>
                  <input 
                    type="text" 
                    placeholder="e.g. Laptop, 3D Printer, Scope" 
                    value={newAsset.type}
                    onChange={(e) => setNewAsset({ ...newAsset, type: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Asset Name <span className="required">*</span></label>
                  <input 
                    type="text" 
                    placeholder="Enter asset name" 
                    value={newAsset.item_name}
                    onChange={(e) => setNewAsset({ ...newAsset, item_name: e.target.value })}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Model / Serial <span className="required">*</span></label>
                  <input 
                    type="text" 
                    placeholder="Enter model or serial number" 
                    value={newAsset.model}
                    onChange={(e) => setNewAsset({ ...newAsset, model: e.target.value })}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Amount <span className="required">*</span></label>
                  <input 
                    type="number" 
                    min="1" 
                    value={newAsset.amount}
                    onChange={(e) => setNewAsset({ ...newAsset, amount: e.target.value })}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Unit <span className="required">*</span></label>
                  <input 
                    type="text" 
                    value={newAsset.store}
                    onChange={(e) => setNewAsset({ ...newAsset, store: e.target.value })}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Perfectly Working</label>
                  <input 
                    type="number" 
                    min="0"
                    value={newAsset.perfectly_working}
                    onChange={(e) => setNewAsset({ ...newAsset, perfectly_working: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Not in Good Condition</label>
                  <input 
                    type="number" 
                    min="0"
                    value={newAsset.not_working}
                    onChange={(e) => setNewAsset({ ...newAsset, not_working: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>To Be Received</label>
                  <input 
                    type="number" 
                    min="0"
                    value={newAsset.to_be_received}
                    onChange={(e) => setNewAsset({ ...newAsset, to_be_received: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Supplier</label>
                  <input 
                    type="text" 
                    placeholder="Enter supplier name" 
                    value={newAsset.supplier}
                    onChange={(e) => setNewAsset({ ...newAsset, supplier: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Availability <span className="required">*</span></label>
                  <select 
                    required 
                    value={newAsset.status}
                    onChange={(e) => setNewAsset({ ...newAsset, status: e.target.value })}
                  >
                    <option value="available">Available</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '20px 0 0 0', marginTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary modal-btn" disabled={submitting}>
                  {submitting ? 'Adding...' : 'Add Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      )}

      <EditItemModal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        item={editingItem}
        onUpdated={() => fetchAssets()}
        onDeleted={() => fetchAssets()}
      />

      <ImageLightbox
        isOpen={!!lightboxItem}
        onClose={() => setLightboxItem(null)}
        imageSrc={lightboxItem?.imageSrc}
        title={lightboxItem?.title}
      />

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        currentFilters={filterCriteria}
        onApply={setFilterCriteria}
        mode="assets"
        items={assets}
      />
    </div>
  );
}
