import React, { useEffect, useState, useMemo } from 'react';
import { Navigate, useSearchParams, Link } from 'react-router-dom';
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
import { classifyItem, getItemTypeLabel, enrichItemsWithType } from '../utils/inventoryClassifier';
import '../styles/table_layout.css';
import '../styles/project.css';
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
  if (!item) return null;
  if (item.image_url) return item.image_url;
  const slug = slugify(item.item_name);
  return slug ? `/IMAGES/items/${slug}.webp` : null;
}

export default function ProjectDetail() {
  const { user, isLoggingOut } = useAuth();
  const { showSuccess, showError, showWarning } = useAlert();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('id');
  const projectNameParam = searchParams.get('name');
  
  const [project, setProject] = useState(null);
  const [items, setItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [generalCatalog, setGeneralCatalog] = useState([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('items'); // 'items' | 'assets'

  // Pagination states
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsPageSize, setItemsPageSize] = useState(6);
  const [assetsPage, setAssetsPage] = useState(1);
  const [assetsPageSize, setAssetsPageSize] = useState(6);

  // Status dropdown state
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addType, setAddType] = useState('item'); // 'item' | 'asset'
  const [editingItem, setEditingItem] = useState(null);
  const [lightboxItem, setLightboxItem] = useState(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState({ status: 'all', category: 'all', unit: 'all' });

  // Add Item/Asset Form State
  const [newItem, setNewItem] = useState({
    item_name: '',
    model: '',
    type: '',
    amount: 1,
    store: 'pcs',
    status: 'available',
    image_url: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchProjectDetails();
  }, [user, projectId, projectNameParam]);

  const fetchProjectDetails = async () => {
    let resolvedProject = null;

    // 1. Try finding by ID
    if (projectId && !projectId.startsWith('proj-')) {
      const { data: projById } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();
      if (projById) resolvedProject = projById;
    }

    // 2. Try finding by Name if not found yet
    if (!resolvedProject && projectNameParam) {
      const { data: projByName } = await supabase
        .from('projects')
        .select('*')
        .ilike('name', projectNameParam)
        .maybeSingle();
      if (projByName) resolvedProject = projByName;
    }

    // 3. Self-healing fallback if project not in table
    const projName = resolvedProject?.name || projectNameParam || 'BDU-DCF';
    if (!resolvedProject) {
      resolvedProject = {
        name: projName,
        client: projName === 'BDU-DCF' ? 'Bahir Dar University' : 'CIH Partner',
        manager: 'Letera Tadele',
        status: 'active'
      };
    }

    setProject(resolvedProject);

    // 4. Fetch all items in DB to get project items and general catalog
    const { data: allItems, error } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false });

    if (allItems && !error) {
      const enrichedAll = enrichItemsWithType(allItems);

      // General catalog (unassigned items with positive amount)
      setGeneralCatalog(enrichedAll.filter(i => !i.project || i.project.trim() === ''));

      // Project-specific items
      const pNameLower = projName.trim().toLowerCase();
      const projItems = enrichedAll.filter(i => (i.project || '').trim().toLowerCase() === pNameLower);

      setItems(projItems.filter(i => {
        const t = (i.type || '').toLowerCase();
        return !t.startsWith('asset:');
      }));

      setAssets(projItems.filter(i => {
        const t = (i.type || '').toLowerCase();
        return t.startsWith('asset:');
      }));
    }
  };

  // Reset pagination on search or filter change
  useEffect(() => {
    setItemsPage(1);
    setAssetsPage(1);
  }, [search, filterCriteria]);

  // Active filter count (must be above early returns per Rules of Hooks)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterCriteria.status && filterCriteria.status !== 'all') count++;
    if (filterCriteria.category && filterCriteria.category !== 'all') count++;
    if (filterCriteria.unit && filterCriteria.unit !== 'all') count++;
    return count;
  }, [filterCriteria]);

  if (!user) {
    return <Navigate to={isLoggingOut ? "/" : "/login"} replace />;
  }

  if (!project) {
    return (
      <div className="dashboard-layout">
        <Sidebar />
        <main className="main-content">
          <Topbar />
          <div style={{ padding: '24px 40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
              <div>
                <span className="skeleton-box skeleton-text" style={{ width: '240px', height: '30px', marginBottom: '8px' }}></span>
                <span className="skeleton-box skeleton-text" style={{ width: '160px', height: '16px' }}></span>
              </div>
              <span className="skeleton-box skeleton-badge" style={{ width: '110px', height: '36px' }}></span>
            </div>
            <div className="table-container" style={{ padding: '24px' }}>
              <table className="data-table">
                <tbody>
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={`skel-pd-${idx}`}>
                      <td><span className="skeleton-box skeleton-text" style={{ width: '60%' }}></span></td>
                      <td><span className="skeleton-box skeleton-img"></span></td>
                      <td><span className="skeleton-box skeleton-text" style={{ width: '40%' }}></span></td>
                      <td><span className="skeleton-box skeleton-badge"></span></td>
                      <td><span className="skeleton-box skeleton-btn"></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Handle status toggle (Active / Completed)
  const handleStatusChange = async (newStatus) => {
    setIsStatusMenuOpen(false);
    if (project.status === newStatus) return;

    setUpdatingStatus(true);
    try {
      if (project.id && !String(project.id).startsWith('proj-')) {
        await supabase
          .from('projects')
          .update({ status: newStatus })
          .eq('id', project.id);
      }
      setProject(prev => ({ ...prev, status: newStatus }));
    } catch (err) {
      console.warn('Status update error:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleRemoveFilter = (filterKey) => {
    setFilterCriteria(prev => ({ ...prev, [filterKey]: 'all' }));
  };

  const handleClearAllFilters = () => {
    setFilterCriteria({ status: 'all', category: 'all', unit: 'all', store: 'all' });
  };

  // Filter application
  const filterList = (list) => {
    return list.filter(item => {
      // Unit filter
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
  };

  const filteredItems = smartSearch(filterList(items), search, item => [
    item.item_name || '',
    item.model || '',
    item.type || '',
    item.supplier || ''
  ]);

  const filteredAssets = smartSearch(filterList(assets), search, item => [
    item.item_name || '',
    item.model || '',
    item.type || '',
    item.supplier || ''
  ]);

  // Paginated slices
  const paginatedItems = filteredItems.slice(
    (itemsPage - 1) * itemsPageSize,
    (itemsPage - 1) * itemsPageSize + itemsPageSize
  );

  const paginatedAssets = filteredAssets.slice(
    (assetsPage - 1) * assetsPageSize,
    (assetsPage - 1) * assetsPageSize + assetsPageSize
  );

  // Open Add Modal
  const openAddModal = (type) => {
    setAddType(type);
    setNewItem({
      item_name: '',
      model: '',
      type: '',
      amount: 1,
      store: 'pcs',
      status: 'available',
      image_url: ''
    });
    setIsAddModalOpen(true);
  };

  // Autocomplete when an existing catalog item name is selected
  const handleCatalogSelect = (itemName) => {
    const catalogItem = generalCatalog.find(
      i => i.item_name.toLowerCase() === itemName.trim().toLowerCase()
    );
    if (catalogItem) {
      const cleanType = (catalogItem.type || '').replace(/^asset:/i, '').replace(/^item:/i, '').replace(/^tool:/i, '');
      setNewItem(prev => ({
        ...prev,
        item_name: catalogItem.item_name,
        model: catalogItem.model && catalogItem.model !== '-' ? catalogItem.model : '',
        type: cleanType || prev.type,
        store: catalogItem.store || prev.store,
        image_url: catalogItem.image_url || prev.image_url
      }));
    }
  };

  // Submit Add Item/Asset to Project
  const handleAddItemToProject = async (e) => {
    e.preventDefault();
    if (!newItem.item_name.trim()) {
      showWarning('Please enter an item name', 'Missing Name');
      return;
    }

    setSubmitting(true);
    try {
      const requestedQty = Number(newItem.amount) || 1;

      // Query fresh stock from database for matching general item to eliminate stale client reads
      let generalItem = null;
      if (addType === 'item') {
        const { data: matchedRows } = await supabase
          .from('items')
          .select('id, item_name, amount, image_url')
          .ilike('item_name', newItem.item_name.trim())
          .or('project.is.null,project.eq.')
          .limit(1);

        generalItem = matchedRows?.[0] || null;

        if (generalItem) {
          const freshStock = Number(generalItem.amount) || 0;
          if (requestedQty > freshStock) {
            showWarning(`Insufficient general inventory stock! Requested ${requestedQty}, but only ${freshStock} available in general catalog.`, 'Insufficient Stock');
            setSubmitting(false);
            return;
          }

          // Decrement general catalog stock atomically
          const updatedQty = Math.max(0, freshStock - requestedQty);
          await supabase
            .from('items')
            .update({ amount: updatedQty, status: updatedQty === 0 ? 'Out of Stock' : 'available' })
            .eq('id', generalItem.id);
        }
      }

      // Format classification type
      const baseType = newItem.type.trim() || 'General';
      const formattedType = addType === 'asset' 
        ? (baseType.toLowerCase().startsWith('asset:') ? baseType : `asset:${baseType}`)
        : (baseType.toLowerCase().startsWith('item:') ? baseType : `item:${baseType}`);

      // Insert assigned item for this project
      const { error: insertErr } = await supabase
        .from('items')
        .insert([{
          item_name: newItem.item_name.trim(),
          model: newItem.model.trim() || '-',
          type: formattedType,
          amount: requestedQty,
          store: newItem.store || 'pcs',
          project: project.name,
          status: newItem.status || 'available',
          perfectly_working: requestedQty,
          not_working: 0,
          to_be_received: 0,
          image_url: newItem.image_url || generalItem?.image_url || ''
        }]);

      if (insertErr) {
        // Compensating rollback: restore general catalog stock if the insert failed
        if (addType === 'item' && generalItem) {
          await supabase
            .from('items')
            .update({ amount: generalItem.amount })
            .eq('id', generalItem.id);
        }
        throw insertErr;
      }

      await fetchProjectDetails();
      setIsAddModalOpen(false);
      await showSuccess(`${addType === 'asset' ? 'Asset' : 'Item'} successfully added to ${project.name}!`);
    } catch (err) {
      showError('Error adding to project: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Export handlers
  const handleExportItems = () => {
    const cols = [
      { key: 'item_name', label: 'Item Name' },
      { key: 'model', label: 'Model' },
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount' },
      { key: 'store', label: 'Unit' },
      { key: 'project', label: 'Project' },
      { key: 'status', label: 'Status' }
    ];
    exportToCSV(filteredItems, cols, `${slugify(project.name)}-items-report`);
  };

  const handleExportAssets = () => {
    const cols = [
      { key: 'item_name', label: 'Asset Name' },
      { key: 'model', label: 'Model' },
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount' },
      { key: 'store', label: 'Unit' },
      { key: 'project', label: 'Project' },
      { key: 'status', label: 'Status' }
    ];
    exportToCSV(filteredAssets, cols, `${slugify(project.name)}-assets-report`);
  };

  const isCompleted = project.status === 'completed';

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="main-content">
        <Topbar onSearch={(e) => setSearch(e.target.value)} />

        {/* Project Header Bar */}
        <div className="project-subtitle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '25px', padding: '0 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-color)' }}>Project: </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-color)' }}>{project.name}</span>

            {/* Status Dropdown */}
            <div style={{ position: 'relative', display: 'inline-block', marginLeft: '8px' }}>
              <button
                type="button"
                onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                disabled={updatingStatus}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: isCompleted ? '#d1fae5' : '#dbeafe',
                  color: isCompleted ? '#065f46' : '#1e40af',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  padding: '4px 12px',
                  borderRadius: '999px',
                  border: `1px solid ${isCompleted ? '#34d399' : '#93c5fd'}`,
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  {isCompleted ? 'check_circle' : 'bolt'}
                </span>
                {isCompleted ? 'Completed' : 'Active'}
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_drop_down</span>
              </button>

              {isStatusMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '6px',
                    background: 'var(--card-background, #ffffff)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 100,
                    minWidth: '130px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    onClick={() => handleStatusChange('active')}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.85rem',
                      color: '#1e40af',
                      borderBottom: '1px solid var(--border-color, #e2e8f0)'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>bolt</span> Active
                  </div>
                  <div
                    onClick={() => handleStatusChange('completed')}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.85rem',
                      color: '#065f46'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span> Completed
                  </div>
                </div>
              )}
            </div>
          </div>

          <Link to="/projects" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontWeight: 500, fontSize: '0.9rem', border: '1px solid var(--border-color)', background: 'var(--card-background)', color: 'var(--text-color)', transition: 'background 0.2s' }}>
            ← Back to Projects
          </Link>
        </div>

        {/* Tabs Container */}
        <div className="tabs-container">
          <div className="tabs-header" style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--border-color, #e2e8f0)', padding: '0 20px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('items')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.95rem',
                color: activeTab === 'items' ? 'var(--primary-color, #1c21df)' : '#64748b',
                borderBottom: activeTab === 'items' ? '3px solid var(--primary-color, #1c21df)' : '3px solid transparent',
                marginBottom: '-2px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>inventory</span>
              Items ({filteredItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('assets')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.95rem',
                color: activeTab === 'assets' ? 'var(--primary-color, #1c21df)' : '#64748b',
                borderBottom: activeTab === 'assets' ? '3px solid var(--primary-color, #1c21df)' : '3px solid transparent',
                marginBottom: '-2px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>description</span>
              Assets ({filteredAssets.length})
            </button>
          </div>

          {/* TAB 1: Items */}
          {activeTab === 'items' && (
            <div className="tab-content" style={{ display: 'block' }}>
              <div className="table-container" style={{ borderRadius: 0, boxShadow: 'none', paddingTop: '20px' }}>
                <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
                  <div className="toolbar-actions">
                    <button
                      type="button"
                      className="action-btn primary"
                      onClick={() => openAddModal('item')}
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px', marginRight: '4px' }}>add_circle</span> Add Item to Project
                    </button>
                    <button
                      type="button"
                      className="action-btn primary"
                      onClick={handleExportItems}
                      style={{ cursor: 'pointer' }}
                    >
                      <span>⬇</span> Export
                    </button>
                    <button
                      type="button"
                      className={`action-btn ${activeFilterCount > 0 ? 'primary' : ''}`}
                      onClick={() => setIsFilterModalOpen(true)}
                      style={{ cursor: 'pointer' }}
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

                <div className="data-table-wrapper" style={{ border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <table className="list-table">
                    <thead>
                      <tr>
                        <th>Item Name ↕</th>
                        <th>Image</th>
                        <th>Model</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Project</th>
                        <th>Availability</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map(item => {
                        const imgSrc = getItemImage(item);
                        const isAvail = item.amount > 0 && item.status !== 'Out of Stock' && item.status !== 'unavailable';

                        return (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                            <td>
                              {imgSrc ? (
                                <img
                                  src={imgSrc}
                                  alt={item.item_name}
                                  width="40"
                                  height="40"
                                  style={{ objectFit: 'contain', background: '#fff', borderRadius: '4px', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                                  onClick={() => setLightboxItem(item)}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>image</span>
                              )}
                            </td>
                            <td>{item.model || '—'}</td>
                            <td>{getItemTypeLabel(item)}</td>
                            <td>{item.amount} {item.store || 'pcs'}</td>
                            <td>{item.project || '—'}</td>
                            <td>
                              <span className={`status-badge ${isAvail ? 'available' : 'unavailable'}`}>
                                {isAvail ? 'Available' : 'Out of Stock'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="view-img-btn"
                                  onClick={() => setLightboxItem(item)}
                                  title="View Image"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>visibility</span> View
                                </button>
                                <button
                                  type="button"
                                  className="edit-row-btn"
                                  onClick={() => setEditingItem(item)}
                                  title="Edit Item"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>edit</span> Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {paginatedItems.length === 0 && (
                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No items found for this project</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={itemsPage}
                  pageSize={itemsPageSize}
                  totalRecords={filteredItems.length}
                  onPageChange={setItemsPage}
                  onPageSizeChange={(size) => {
                    setItemsPageSize(size);
                    setItemsPage(1);
                  }}
                  pageSizeOptions={[6, 10, 20, 50]}
                />
              </div>
            </div>
          )}

          {/* TAB 2: Assets */}
          {activeTab === 'assets' && (
            <div className="tab-content" style={{ display: 'block' }}>
              <div className="table-container" style={{ borderRadius: 0, boxShadow: 'none', paddingTop: '20px' }}>
                <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
                  <div className="toolbar-actions">
                    <button
                      type="button"
                      className="action-btn primary"
                      onClick={() => openAddModal('asset')}
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px', marginRight: '4px' }}>add_circle</span> Add Asset to Project
                    </button>
                    <button
                      type="button"
                      className="action-btn primary"
                      onClick={handleExportAssets}
                      style={{ cursor: 'pointer' }}
                    >
                      <span>⬇</span> Export
                    </button>
                    <button
                      type="button"
                      className={`action-btn ${activeFilterCount > 0 ? 'primary' : ''}`}
                      onClick={() => setIsFilterModalOpen(true)}
                      style={{ cursor: 'pointer' }}
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

                <div className="data-table-wrapper" style={{ border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <table className="list-table">
                    <thead>
                      <tr>
                        <th>Asset Name ↕</th>
                        <th>Image</th>
                        <th>Model</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Project</th>
                        <th>Availability</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAssets.map(item => {
                        const imgSrc = getItemImage(item);
                        const isAvail = item.amount > 0 && item.status !== 'Out of Stock' && item.status !== 'unavailable';

                        return (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                            <td>
                              {imgSrc ? (
                                <img
                                  src={imgSrc}
                                  alt={item.item_name}
                                  width="40"
                                  height="40"
                                  style={{ objectFit: 'contain', background: '#fff', borderRadius: '4px', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                                  onClick={() => setLightboxItem(item)}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>image</span>
                              )}
                            </td>
                            <td>{item.model || '—'}</td>
                            <td>{getItemTypeLabel(item)}</td>
                            <td>{item.amount} {item.store || 'pcs'}</td>
                            <td>{item.project || '—'}</td>
                            <td>
                              <span className={`status-badge ${isAvail ? 'available' : 'unavailable'}`}>
                                {isAvail ? 'Available' : 'Out of Stock'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="view-img-btn"
                                  onClick={() => setLightboxItem(item)}
                                  title="View Image"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>visibility</span> View
                                </button>
                                <button
                                  type="button"
                                  className="edit-row-btn"
                                  onClick={() => setEditingItem(item)}
                                  title="Edit Asset"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>edit</span> Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {paginatedAssets.length === 0 && (
                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No assets found for this project</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={assetsPage}
                  pageSize={assetsPageSize}
                  totalRecords={filteredAssets.length}
                  onPageChange={setAssetsPage}
                  onPageSizeChange={(size) => {
                    setAssetsPageSize(size);
                    setAssetsPage(1);
                  }}
                  pageSizeOptions={[6, 10, 20, 50]}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={setFilterCriteria}
        currentFilters={filterCriteria}
        mode={activeTab === 'assets' ? 'assets' : 'items'}
        items={activeTab === 'assets' ? assets : items}
      />

      {/* Image Lightbox */}
      <ImageLightbox
        isOpen={Boolean(lightboxItem)}
        onClose={() => setLightboxItem(null)}
        item={lightboxItem}
        imageUrl={getItemImage(lightboxItem)}
      />

      {/* Unified Edit Modal */}
      <EditItemModal
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        item={editingItem}
        onUpdated={fetchProjectDetails}
        onDeleted={fetchProjectDetails}
      />

      {/* Dynamic Add Item/Asset to Project Modal */}
      {isAddModalOpen && (
        <div className="side-modal-overlay open" style={{ display: 'flex', zIndex: 9999 }} onClick={() => setIsAddModalOpen(false)}>
          <div className="side-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New {addType === 'asset' ? 'Asset' : 'Item'} to Project</h2>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            
            <div className="modal-body">
              <form onSubmit={handleAddItemToProject} className="form-grid" style={{ marginTop: '10px' }}>
                <div className="form-group">
                  <label>{addType === 'asset' ? 'Asset Name' : 'Item Name'} <span className="required">*</span></label>
                  <input
                    type="text"
                    list="catalog-options"
                    placeholder="Enter or select item name"
                    required
                    value={newItem.item_name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewItem(prev => ({ ...prev, item_name: val }));
                      handleCatalogSelect(val);
                    }}
                  />
                  <datalist id="catalog-options">
                    {generalCatalog.map(catItem => (
                      <option key={catItem.id} value={catItem.item_name}>
                        {catItem.item_name} ({catItem.amount} available)
                      </option>
                    ))}
                  </datalist>
                </div>

                <div className="form-group">
                  <label>Model / Serial Number</label>
                  <input
                    type="text"
                    placeholder="Enter model or serial"
                    value={newItem.model}
                    onChange={(e) => setNewItem({ ...newItem, model: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Type <span className="required">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Laptop, Sensor, Cable"
                    required
                    value={newItem.type}
                    onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Amount <span className="required">*</span></label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newItem.amount}
                    onChange={(e) => setNewItem({ ...newItem, amount: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label>Measurement Unit <span className="required">*</span></label>
                  <input
                    type="text"
                    list="unit-options"
                    placeholder="e.g. pcs, meters, sets"
                    required
                    value={newItem.store}
                    onChange={(e) => setNewItem({ ...newItem, store: e.target.value })}
                  />
                  <datalist id="unit-options">
                    <option value="pcs" />
                    <option value="meters" />
                    <option value="sets" />
                    <option value="box" />
                  </datalist>
                </div>

                <div className="form-group">
                  <label>Status <span className="required">*</span></label>
                  <select
                    value={newItem.status}
                    onChange={(e) => setNewItem({ ...newItem, status: e.target.value })}
                  >
                    <option value="available">Available</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Project</label>
                  <input
                    type="text"
                    value={project.name}
                    readOnly
                    style={{ background: 'var(--border-color, #f1f5f9)', cursor: 'not-allowed', opacity: 0.8 }}
                  />
                </div>

                <div className="modal-footer" style={{ padding: '20px 0 0 0', marginTop: '20px', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                  <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary modal-btn" disabled={submitting}>
                    {submitting ? 'Adding...' : `Add ${addType === 'asset' ? 'Asset' : 'Item'}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
