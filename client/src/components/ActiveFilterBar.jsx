import React from 'react';

const STATUS_LABELS = {
  in_stock: 'In Stock',
  low_stock: 'Low Stock (1-5)',
  out_of_stock: 'Out of Stock',
  in_use: 'In Use',
  under_maintenance: 'Under Maintenance',
  decommissioned: 'Decommissioned',
  available: 'Available',
  active: 'Active',
  in_progress: 'In Progress',
  completed: 'Completed',
  Received: 'Received',
  Pending: 'Pending'
};

const TYPE_LABELS = {
  checkout: 'Requisitions / Checkouts',
  return: 'Item Returns',
  with_items: 'Has Items',
  empty: 'No Items Assigned'
};

export default function ActiveFilterBar({ filters = {}, onRemoveFilter, onClearAll }) {
  const activeTags = [];

  if (filters.status && filters.status !== 'all') {
    activeTags.push({
      key: 'status',
      label: `Status: ${STATUS_LABELS[filters.status] || filters.status}`
    });
  }

  if (filters.category && filters.category !== 'all') {
    activeTags.push({
      key: 'category',
      label: `Category: ${filters.category}`
    });
  }

  if ((filters.unit && filters.unit !== 'all') || (filters.store && filters.store !== 'all')) {
    const val = filters.unit !== 'all' ? filters.unit : filters.store;
    activeTags.push({
      key: 'unit',
      label: `Unit: ${val}`
    });
  }

  if (filters.type && filters.type !== 'all') {
    activeTags.push({
      key: 'type',
      label: `Type: ${TYPE_LABELS[filters.type] || filters.type}`
    });
  }

  if (filters.client && filters.client !== 'all') {
    activeTags.push({
      key: 'client',
      label: `Partner: ${filters.client}`
    });
  }

  if (filters.supplier && filters.supplier !== 'all') {
    activeTags.push({
      key: 'supplier',
      label: `Supplier: ${filters.supplier}`
    });
  }

  if (filters.allocation && filters.allocation !== 'all') {
    activeTags.push({
      key: 'allocation',
      label: `Allocation: ${TYPE_LABELS[filters.allocation] || filters.allocation}`
    });
  }

  if (activeTags.length === 0) return null;

  return (
    <div 
      className="active-filters-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '10px 16px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        marginBottom: '16px',
        fontSize: '0.84rem'
      }}
    >
      <span style={{ fontWeight: 600, color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#1c21df' }}>
          filter_alt
        </span>
        Active Filters:
      </span>

      {activeTags.map(tag => (
        <span
          key={tag.key}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#ffffff',
            color: '#1e293b',
            padding: '4px 10px',
            borderRadius: '20px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            fontSize: '0.82rem',
            fontWeight: 500
          }}
        >
          {tag.label}
          <button
            type="button"
            onClick={() => onRemoveFilter(tag.key)}
            aria-label={`Remove filter ${tag.label}`}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: '#64748b',
              padding: 0
            }}
          >
            &times;
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={onClearAll}
        style={{
          background: 'none',
          border: 'none',
          color: '#ff5421',
          fontWeight: 600,
          fontSize: '0.82rem',
          cursor: 'pointer',
          padding: '4px 8px',
          marginLeft: 'auto'
        }}
      >
        Clear all
      </button>
    </div>
  );
}
