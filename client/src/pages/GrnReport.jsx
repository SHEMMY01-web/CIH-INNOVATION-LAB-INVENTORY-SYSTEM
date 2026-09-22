import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import Pagination from '../components/Pagination';
import FilterModal from '../components/FilterModal';
import ActiveFilterBar from '../components/ActiveFilterBar';
import { exportToCSV } from '../utils/exportUtils';
import { smartSearch } from '../utils/searchUtils';
import '../styles/table_layout.css';

export default function GrnReport() {
  const { user, isLoggingOut } = useAuth();
  const [search, setSearch] = useState('');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState({ status: 'all', supplier: 'all' });

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      try {
        // Attempt fetching from grn_reports table if it exists
        const { data, error } = await supabase
          .from('grn_reports')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          if (isMounted) setReports(data);
        } else {
          // Fallback: check transactions for GRN / Received / Returned records
          const { data: txData } = await supabase
            .from('transactions')
            // Lean select: only the columns GRN view consumes — avoids downloading proof_url blobs
            .select('id, transaction_type, amount, timestamp, requester, project, items(item_name, store)')
            .in('transaction_type', ['grn', 'received', 'return'])
            .order('timestamp', { ascending: false })
            .limit(500); // Hard cap — GRN reports don't need all historical records

          if (isMounted) {
            if (txData && txData.length > 0) {
              setReports(txData.map(tx => ({
                id: tx.id,
                grn_number: `GRN-${tx.id.toString().substring(0, 6).toUpperCase()}`,
                item_name: tx.items?.item_name || 'Inventory Stock',
                store: tx.items?.store || 'HQ main',
                quantity: tx.amount || 1,
                supplier: tx.project || 'CIH Supplier',
                received_by: tx.requester || 'Staff',
                date: tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : 'Recent',
                status: 'Received'
              })));
            } else {
              setReports([]);
            }
          }
        }
      } catch (err) {
        console.warn('GRN fetch info:', err);
        if (isMounted) setReports([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterCriteria]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterCriteria.status && filterCriteria.status !== 'all') count++;
    if (filterCriteria.supplier && filterCriteria.supplier !== 'all') count++;
    return count;
  }, [filterCriteria]);

  const deferredSearch = useDeferredValue(search);

  const filteredReports = useMemo(() => {
    let result = reports;
    if (filterCriteria.status && filterCriteria.status !== 'all') {
      result = result.filter(r => (r.status || '').toLowerCase() === filterCriteria.status.toLowerCase());
    }
    if (filterCriteria.supplier && filterCriteria.supplier !== 'all') {
      result = result.filter(r => (r.supplier || '').trim() === filterCriteria.supplier.trim());
    }
    return smartSearch(result, deferredSearch, r => [
      r.grn_number || '',
      r.item_name || '',
      r.supplier || '',
      r.received_by || '',
      r.status || ''
    ]);
  }, [reports, deferredSearch, filterCriteria]);

  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReports.slice(start, start + pageSize);
  }, [filteredReports, currentPage, pageSize]);

  if (!user) {
    return <Navigate to={isLoggingOut ? "/" : "/login"} replace />;
  }

  const handleRemoveFilter = (filterKey) => {
    setFilterCriteria(prev => ({ ...prev, [filterKey]: 'all' }));
  };

  const handleClearAllFilters = () => {
    setFilterCriteria({ status: 'all', supplier: 'all', store: 'all' });
  };

  const handleExport = () => {
    const cols = [
      { key: 'grn_number', label: 'GRN Number' },
      { key: 'item_name', label: 'Item Name' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'received_by', label: 'Received By' },
      { key: 'date', label: 'Date' },
      { key: 'status', label: 'Status' }
    ];
    exportToCSV(filteredReports.length ? filteredReports : [{ grn_number: 'TEMPLATE-001', item_name: 'Sample Item', quantity: 1, supplier: 'Sample Supplier', received_by: 'Staff', date: new Date().toLocaleDateString(), status: 'Received' }], cols, 'cih-grn-report');
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="main-content">
        <Topbar onSearch={(e) => setSearch(e.target.value)} />

        <div className="table-container">
          <div className="table-toolbar">
            <div className="toolbar-actions">
              <button 
                type="button" 
                className="action-btn primary" 
                onClick={handleExport}
                style={{ cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px', marginRight: '4px' }}>download</span> Export
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

          {loading ? (
            <div className="data-table-wrapper" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '20px' }}>
              <table className="list-table">
                <thead>
                  <tr>
                    <th>GRN #</th>
                    <th>Item Name</th>
                    <th>Qty</th>
                    <th>Supplier</th>
                    <th>Received By</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 7 }).map((_, idx) => (
                    <tr key={`skel-grn-${idx}`}>
                      <td><span className="skeleton-box skeleton-text" style={{ width: '60%' }}></span></td>
                      <td><span className="skeleton-box skeleton-text" style={{ width: '70%' }}></span></td>
                      <td><span className="skeleton-box skeleton-text" style={{ width: '30%' }}></span></td>
                      <td><span className="skeleton-box skeleton-text" style={{ width: '50%' }}></span></td>
                      <td><span className="skeleton-box skeleton-text" style={{ width: '45%' }}></span></td>
                      <td><span className="skeleton-box skeleton-text" style={{ width: '40%' }}></span></td>
                      <td><span className="skeleton-box skeleton-badge"></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="empty-state" style={{ padding: '80px 20px', textAlign: 'center' }}>
              <img 
                src="/IMAGES/empty-state.png" 
                alt="Empty State" 
                className="empty-state-img" 
                style={{ maxWidth: '280px', marginBottom: '16px' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <h3 style={{ color: 'var(--text-color, #0f172a)', marginBottom: '8px' }}>Nothing found.</h3>
              <p style={{ color: '#64748b' }}>No Goods Received Notes (GRN) records found for the selected period.</p>
            </div>
          ) : (
            <div className="data-table-wrapper" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '20px' }}>
              <table className="list-table">
                <thead>
                  <tr>
                    <th>GRN #</th>
                    <th>Item Name</th>
                    <th>Qty</th>
                    <th>Supplier</th>
                    <th>Received By</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedReports.map(rep => (
                    <tr key={rep.id}>
                      <td style={{ fontWeight: 600 }}>{rep.grn_number}</td>
                      <td>{rep.item_name}</td>
                      <td>{rep.quantity}</td>
                      <td>{rep.supplier}</td>
                      <td>{rep.received_by}</td>
                      <td>{rep.date}</td>
                      <td>
                        <span className="status-badge available">{rep.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalRecords={filteredReports.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            pageSizeOptions={[6, 10, 20, 50]}
          />
        </div>
      </main>

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={setFilterCriteria}
        currentFilters={filterCriteria}
        mode="grn"
        reports={reports}
      />
    </div>
  );
}
