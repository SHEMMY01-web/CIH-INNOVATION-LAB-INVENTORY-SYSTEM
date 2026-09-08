import React, { useState, useEffect, useMemo } from 'react';
import { HARDWARE_CATEGORIES, UNIT_OPTIONS, getAvailableUnits } from '../utils/inventoryClassifier';

export default function FilterModal({ 
  isOpen, 
  onClose, 
  onApply, 
  currentFilters = {},
  initialCriteria,
  mode = 'items', // 'items' | 'assets' | 'tools' | 'projects' | 'requests' | 'grn'
  items = [],
  projects = [],
  transactions = [],
  reports = [],
  availableUnits: customUnits,
  availableStores: deprecatedStores, // backwards compat
}) {
  const initial = initialCriteria || currentFilters || {};

  // Universal state
  const [selectedStatus, setSelectedStatus] = useState(initial.status || 'all');
  const [selectedCategory, setSelectedCategory] = useState(initial.category || 'all');
  const [selectedUnit, setSelectedUnit] = useState(initial.unit || initial.store || 'all');
  const [selectedType, setSelectedType] = useState(initial.type || 'all');
  const [selectedClient, setSelectedClient] = useState(initial.client || 'all');
  const [selectedSupplier, setSelectedSupplier] = useState(initial.supplier || 'all');
  const [selectedAllocation, setSelectedAllocation] = useState(initial.allocation || 'all');

  useEffect(() => {
    const filters = initialCriteria || currentFilters || {};
    setSelectedStatus(filters.status || 'all');
    setSelectedCategory(filters.category || 'all');
    setSelectedUnit(filters.unit || filters.store || 'all');
    setSelectedType(filters.type || 'all');
    setSelectedClient(filters.client || 'all');
    setSelectedSupplier(filters.supplier || 'all');
    setSelectedAllocation(filters.allocation || 'all');
  }, [currentFilters, initialCriteria, isOpen]);

  // Dynamic packaging units from real data
  const unitsList = useMemo(() => {
    if (customUnits && customUnits.length > 0) {
      return customUnits.map(u => typeof u === 'string' ? { value: u, label: u } : u);
    }
    const dataItems = items.length > 0 ? items : transactions.map(t => t.items).filter(Boolean);
    return getAvailableUnits(dataItems);
  }, [customUnits, items, transactions]);

  // Dynamic clients from projects
  const clientsList = useMemo(() => {
    const clients = new Set();
    projects.forEach(p => {
      const c = p.client || p.client_name;
      if (c && c.trim()) clients.add(c.trim());
    });
    return Array.from(clients);
  }, [projects]);

  // Dynamic suppliers from reports
  const suppliersList = useMemo(() => {
    const suppliers = new Set();
    reports.forEach(r => {
      if (r.supplier && r.supplier.trim()) suppliers.add(r.supplier.trim());
    });
    items.forEach(i => {
      if (i.supplier && i.supplier.trim()) suppliers.add(i.supplier.trim());
    });
    return Array.from(suppliers);
  }, [reports, items]);

  if (!isOpen) return null;

  const handleApply = (e) => {
    e.preventDefault();
    const applied = {
      status: selectedStatus,
      category: selectedCategory,
      unit: selectedUnit,
      store: selectedUnit, // ensure backwards compatibility for existing table filters
      type: selectedType,
      client: selectedClient,
      supplier: selectedSupplier,
      allocation: selectedAllocation
    };
    onApply(applied);
    onClose();
  };

  const handleReset = () => {
    setSelectedStatus('all');
    setSelectedCategory('all');
    setSelectedUnit('all');
    setSelectedType('all');
    setSelectedClient('all');
    setSelectedSupplier('all');
    setSelectedAllocation('all');
    onApply({
      status: 'all',
      category: 'all',
      unit: 'all',
      store: 'all',
      type: 'all',
      client: 'all',
      supplier: 'all',
      allocation: 'all'
    });
    onClose();
  };

  // Titles per mode
  const getModalTitle = () => {
    switch (mode) {
      case 'projects': return 'Filter Projects';
      case 'requests': return 'Filter Requisitions & Returns';
      case 'grn': return 'Filter Goods Received Notes (GRN)';
      case 'assets': return 'Filter Lab Assets';
      case 'tools': return 'Filter Lab Tools';
      default: return 'Filter Inventory Items';
    }
  };

  return (
    <div 
      className="center-modal-overlay open" 
      style={{ display: 'flex', zIndex: 9999 }}
      onClick={onClose}
    >
      <div 
        className="center-modal-panel filter-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ 
          width: '520px', 
          maxWidth: '95vw', 
          borderRadius: '16px',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        <div 
          className="center-modal-header" 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ color: '#1c21df', fontSize: '22px' }}>
              tune
            </span>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>
              {getModalTitle()}
            </h2>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            aria-label="Close modal"
            style={{ 
              background: '#f1f5f9', 
              border: 'none', 
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer', 
              fontSize: '18px', 
              color: '#64748b' 
            }}
          >
            &times;
          </button>
        </div>

        <div className="center-modal-body" style={{ padding: '20px 24px', maxHeight: '68vh', overflowY: 'auto' }}>
          {/* ========================================================
              MODE: PROJECTS
          ======================================================== */}
          {mode === 'projects' && (
            <>
              {/* Project Status */}
              <div className="filter-section" style={{ marginBottom: '22px' }}>
                <div className="filter-section-title" style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b', marginBottom: '10px' }}>
                  Project Status
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'all', label: 'All Statuses' },
                    { id: 'active', label: 'Active Projects' },
                    { id: 'in_progress', label: 'In Progress' },
                    { id: 'completed', label: 'Completed' }
                  ].map(opt => (
                    <label 
                      key={opt.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        cursor: 'pointer', 
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: selectedStatus === opt.id ? '1.5px solid #1c21df' : '1px solid #e2e8f0',
                        background: selectedStatus === opt.id ? '#eff6ff' : '#ffffff',
                        fontSize: '0.86rem',
                        fontWeight: selectedStatus === opt.id ? 600 : 400,
                        color: selectedStatus === opt.id ? '#1c21df' : '#334155'
                      }}
                    >
                      <input 
                        type="radio" 
                        name="filter_proj_status" 
                        checked={selectedStatus === opt.id} 
                        onChange={() => setSelectedStatus(opt.id)} 
                        style={{ accentColor: '#1c21df' }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Partner / Client Filter */}
              {clientsList.length > 0 && (
                <div className="filter-section" style={{ marginBottom: '22px' }}>
                  <div className="filter-section-title" style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b', marginBottom: '10px' }}>
                    Partner / Client Organization
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        cursor: 'pointer', 
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: selectedClient === 'all' ? '1.5px solid #1c21df' : '1px solid #e2e8f0',
                        background: selectedClient === 'all' ? '#eff6ff' : '#ffffff',
                        fontSize: '0.86rem',
                        fontWeight: selectedClient === 'all' ? 600 : 400,
                        color: selectedClient === 'all' ? '#1c21df' : '#334155'
                      }}
                    >
                      <input 
                        type="radio" 
                        name="filter_client" 
                        checked={selectedClient === 'all'} 
                        onChange={() => setSelectedClient('all')} 
                        style={{ accentColor: '#1c21df' }}
                      />
                      All Partners & Organizations
                    </label>
                    {clientsList.map(c => (
                      <label 
                        key={c} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          cursor: 'pointer', 
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: selectedClient === c ? '1.5px solid #1c21df' : '1px solid #e2e8f0',
                          background: selectedClient === c ? '#eff6ff' : '#ffffff',
                          fontSize: '0.86rem',
                          fontWeight: selectedClient === c ? 600 : 400,
                          color: selectedClient === c ? '#1c21df' : '#334155'
                        }}
                      >
                        <input 
                          type="radio" 
                          name="filter_client" 
                          checked={selectedClient === c} 
                          onChange={() => setSelectedClient(c)} 
                          style={{ accentColor: '#1c21df' }}
                        />
                        {c}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Item Allocation Status */}
              <div className="filter-section">
                <div className="filter-section-title" style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b', marginBottom: '10px' }}>
                  Inventory Allocation
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'all', label: 'All Projects' },
                    { id: 'with_items', label: 'Has Allocated Items' },
                    { id: 'empty', label: 'No Items Assigned' }
                  ].map(opt => (
                    <label 
                      key={opt.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        cursor: 'pointer', 
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: selectedAllocation === opt.id ? '1.5px solid #1c21df' : '1px solid #e2e8f0',
                        background: selectedAllocation === opt.id ? '#eff6ff' : '#ffffff',
                        fontSize: '0.86rem',
                        fontWeight: selectedAllocation === opt.id ? 600 : 400,
                        color: selectedAllocation === opt.id ? '#1c21df' : '#334155'
                      }}
                    >
                      <input 
                        type="radio" 
                        name="filter_allocation" 
                        checked={selectedAllocation === opt.id} 
                        onChange={() => setSelectedAllocation(opt.id)} 
                        style={{ accentColor: '#1c21df' }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ========================================================
              MODE: REQUESTS / TRANSACTIONS
          ======================================================== */}
          {mode === 'requests' && (
            <>
              {/* Transaction Type */}
              <div className="filter-section" style={{ marginBottom: '22px' }}>
                <div className="filter-section-title" style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b', marginBottom: '10px' }}>
                  Record Type
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'all', label: 'All Transactions' },
                    { id: 'checkout', label: 'Requisitions / Checkouts' },
                    { id: 'return', label: 'Item Returns' }
                  ].map(opt => (
                    <label 
                      key={opt.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        cursor: 'pointer', 
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: selectedType === opt.id ? '1.5px solid #1c21df' : '1px solid #e2e8f0',
                        background: selectedType === opt.id ? '#eff6ff' : '#ffffff',
                        fontSize: '0.86rem',
                        fontWeight: selectedType === opt.id ? 600 : 400,
                        color: selectedType === opt.id ? '#1c21df' : '#334155'
                      }}
                    >
                      <input 
                        type="radio" 
                        name="filter_tx_type" 
                        checked={selectedType === opt.id} 
                        onChange={() => setSelectedType(opt.id)} 
                        style={{ accentColor: '#1c21df' }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Item Packaging Unit */}
              <div className="filter-section">
                <div className="filter-section-title" style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b', marginBottom: '10px' }}>
                  Unit / Packaging Format
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      cursor: 'pointer', 
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: selectedUnit === 'all' ? '1.5px solid #1c21df' : '1px solid #e2e8f0',
                      background: selectedUnit === 'all' ? '#eff6ff' : '#ffffff',
                      fontSize: '0.86rem',
                      fontWeight: selectedUnit === 'all' ? 600 : 400,
                      color: selectedUnit === 'all' ? '#1c21df' : '#334155'
                    }}
                  >
                    <input 
                      type="radio" 
                      name="filter_unit" 
                      checked={selectedUnit === 'all'} 
                      onChange={() => setSelectedUnit('all')} 
                      style={{ accentColor: '#1c21df' }}
                    />
                    All Units
                  </label>
                  {unitsList.map(u => (
                    <label 
                      key={u.value} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        cursor: 'pointer', 
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: selectedUnit === u.value ? '1.5px solid #1c21df' : '1px solid #e2e8f0',
                        background: selectedUnit === u.value ? '#eff6ff' : '#ffffff',
                        fontSize: '0.86rem',
                        fontWeight: selectedUnit === u.value ? 600 : 400,
                        color: selectedUnit === u.value ? '#1c21df' : '#334155'
                      }}
                    >
                      <input 
                        type="radio" 
                        name="filter_unit" 
                        checked={selectedUnit === u.value} 
                        onChange={() => setSelectedUnit(u.value)} 
                        style={{ accentColor: '#1c21df' }}
                      />
                      {u.label}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ========================================================
              MODE: GRN (Goods Received Notes)
          ======================================================== */}
          {mode === 'grn' && (
            <>
              {/* GRN Status */}
              <div className="filter-section" style={{ marginBottom: '22px' }}>
                <div className="filter-section-title" style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b', marginBottom: '10px' }}>
                  Verification Status
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'all', label: 'All Statuses' },
                    { id: 'Received', label: 'Received Stock' },
                    { id: 'Pending', label: 'Pending Verification' }
                  ].map(opt => (
                    <label 
                      key={opt.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        cursor: 'pointer', 
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: selectedStatus === opt.id ? '1.5px solid #1c21df' : '1px solid #e2e8f0',
                        background: selectedStatus === opt.id ? '#eff6ff' : '#ffffff',
                        fontSize: '0.86rem',
                        fontWeight: selectedStatus === opt.id ? 600 : 400,
                        color: selectedStatus === opt.id ? '#1c21df' : '#334155'
                      }}
                    >
                      <input 
                        type="radio" 
                        name="filter_grn_status" 
                        checked={selectedStatus === opt.id} 
                        onChange={() => setSelectedStatus(opt.id)} 
                        style={{ accentColor: '#1c21df' }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Supplier */}
              {suppliersList.length > 0 && (
                <div className="filter-section" style={{ marginBottom: '22px' }}>
                  <div className="filter-section-title" style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b', marginBottom: '10px' }}>
                    Supplier / Source
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        cursor: 'pointer', 
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: selectedSupplier === 'all' ? '1.5px solid #1c21df' : '1px solid #e2e8f0',
                        background: selectedSupplier === 'all' ? '#eff6ff' : '#ffffff',
                        fontSize: '0.86rem',
                        fontWeight: selectedSupplier === 'all' ? 600 : 400,
                        color: selectedSupplier === 'all' ? '#1c21df' : '#334155'
                      }}
                    >
                      <input 
                        type="radio" 
                        name="filter_supplier" 
                        checked={selectedSupplier === 'all'} 
                        onChange={() => setSelectedSupplier('all')} 
                        style={{ accentColor: '#1c21df' }}
                      />
                      All Suppliers
                    </label>
                    {suppliersList.map(s => (
                      <label 
                        key={s} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          cursor: 'pointer', 
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: selectedSupplier === s ? '1.5px solid #1c21df' : '1px solid #e2e8f0',
                          background: selectedSupplier === s ? '#eff6ff' : '#ffffff',
                          fontSize: '0.86rem',
                          fontWeight: selectedSupplier === s ? 600 : 400,
                          color: selectedSupplier === s ? '#1c21df' : '#334155'
                        }}
                      >
                        <input 
                          type="radio" 
                          name="filter_supplier" 
                          checked={selectedSupplier === s} 
                          onChange={() => setSelectedSupplier(s)} 
                          style={{ accentColor: '#1c21df' }}
                        />
                        {s}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ========================================================
              MODE: ITEMS / ASSETS / TOOLS / DEFAULT
          ======================================================== */}
          {(mode === 'items' || mode === 'assets' || mode === 'tools') && (
            <>
              {/* Stock Status Filter */}
              <div className="filter-section" style={{ marginBottom: '22px' }}>
                <div className="filter-section-title" style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b', marginBottom: '10px' }}>
                  Stock & Availability
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'all', label: 'All Items' },
                    { id: 'in_stock', label: 'In Stock (Available)' },
                    { id: 'low_stock', label: 'Low Stock (1–5 Units)' },
                    { id: 'out_of_stock', label: 'Out of Stock (0 Units)' }
                  ].map(opt => (
                    <label 
                      key={opt.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        cursor: 'pointer', 
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: selectedStatus === opt.id ? '1.5px solid #1c21df' : '1px solid #e2e8f0',
                        background: selectedStatus === opt.id ? '#eff6ff' : '#ffffff',
                        fontSize: '0.86rem',
                        fontWeight: selectedStatus === opt.id ? 600 : 400,
                        color: selectedStatus === opt.id ? '#1c21df' : '#334155'
                      }}
                    >
                      <input 
                        type="radio" 
                        name="filter_status" 
                        checked={selectedStatus === opt.id} 
                        onChange={() => setSelectedStatus(opt.id)} 
                        style={{ accentColor: '#1c21df' }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Hardware Category Filter */}
              <div className="filter-section" style={{ marginBottom: '22px' }}>
                <div className="filter-section-title" style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b', marginBottom: '10px' }}>
                  Equipment & Hardware Category
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      cursor: 'pointer', 
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: selectedCategory === 'all' ? '1.5px solid #1c21df' : '1px solid #e2e8f0',
                      background: selectedCategory === 'all' ? '#eff6ff' : '#ffffff',
                      fontSize: '0.85rem',
                      fontWeight: selectedCategory === 'all' ? 600 : 400,
                      color: selectedCategory === 'all' ? '#1c21df' : '#334155'
                    }}
                  >
                    <input 
                      type="radio" 
                      name="filter_category" 
                      checked={selectedCategory === 'all'} 
                      onChange={() => setSelectedCategory('all')} 
                      style={{ accentColor: '#1c21df' }}
                    />
                    All Hardware Categories
                  </label>
                  {HARDWARE_CATEGORIES.map(cat => (
                    <label 
                      key={cat} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        cursor: 'pointer', 
                        padding: '7px 12px',
                        borderRadius: '8px',
                        border: selectedCategory === cat ? '1.5px solid #1c21df' : '1px solid #e2e8f0',
                        background: selectedCategory === cat ? '#eff6ff' : '#ffffff',
                        fontSize: '0.85rem',
                        fontWeight: selectedCategory === cat ? 600 : 400,
                        color: selectedCategory === cat ? '#1c21df' : '#334155'
                      }}
                    >
                      <input 
                        type="radio" 
                        name="filter_category" 
                        checked={selectedCategory === cat} 
                        onChange={() => setSelectedCategory(cat)} 
                        style={{ accentColor: '#1c21df' }}
                      />
                      {cat}
                    </label>
                  ))}
                </div>
              </div>

              {/* Packaging / Unit Filter (Only relevant for general items & tools) */}
              <div className="filter-section">
                <div className="filter-section-title" style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b', marginBottom: '10px' }}>
                  Unit / Packaging Format
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      cursor: 'pointer', 
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: selectedUnit === 'all' ? '1.5px solid #1c21df' : '1px solid #e2e8f0',
                      background: selectedUnit === 'all' ? '#eff6ff' : '#ffffff',
                      fontSize: '0.86rem',
                      fontWeight: selectedUnit === 'all' ? 600 : 400,
                      color: selectedUnit === 'all' ? '#1c21df' : '#334155'
                    }}
                  >
                    <input 
                      type="radio" 
                      name="filter_unit" 
                      checked={selectedUnit === 'all'} 
                      onChange={() => setSelectedUnit('all')} 
                      style={{ accentColor: '#1c21df' }}
                    />
                    All Units
                  </label>
                  {unitsList.map(u => (
                    <label 
                      key={u.value} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        cursor: 'pointer', 
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: selectedUnit === u.value ? '1.5px solid #1c21df' : '1px solid #e2e8f0',
                        background: selectedUnit === u.value ? '#eff6ff' : '#ffffff',
                        fontSize: '0.86rem',
                        fontWeight: selectedUnit === u.value ? 600 : 400,
                        color: selectedUnit === u.value ? '#1c21df' : '#334155'
                      }}
                    >
                      <input 
                        type="radio" 
                        name="filter_unit" 
                        checked={selectedUnit === u.value} 
                        onChange={() => setSelectedUnit(u.value)} 
                        style={{ accentColor: '#1c21df' }}
                      />
                      {u.label}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div 
          className="center-modal-footer filter-modal-footer modal-footer" 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '16px 24px 20px 24px', 
            borderTop: 'none',
            background: 'transparent',
            backgroundColor: 'transparent',
            gap: '12px',
            boxSizing: 'border-box',
            width: '100%',
            maxWidth: '100%'
          }}
        >
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={handleReset}
            style={{ 
              padding: '10px 18px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color, #cbd5e1)', 
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.88rem',
              color: 'var(--text-secondary, #475569)',
              background: 'var(--card-bg, #ffffff)',
              whiteSpace: 'nowrap',
              width: 'auto',
              flex: '0 0 auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>restart_alt</span>
            Reset All
          </button>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: '0 0 auto', margin: 0 }}>
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={onClose}
              style={{ 
                padding: '10px 18px', 
                borderRadius: '8px', 
                border: '1px solid var(--border-color, #cbd5e1)', 
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.88rem',
                color: 'var(--text-secondary, #475569)',
                background: 'var(--card-bg, #ffffff)',
                whiteSpace: 'nowrap',
                width: 'auto',
                flex: '0 0 auto'
              }}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className="btn-primary" 
              onClick={handleApply}
              style={{ 
                padding: '10px 22px', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.88rem',
                backgroundColor: 'var(--primary-color, #1c21df)',
                color: '#ffffff',
                border: 'none',
                whiteSpace: 'nowrap',
                width: 'auto',
                flex: '0 0 auto',
                boxShadow: '0 2px 8px rgba(28, 33, 223, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check</span>
              Apply Filter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
