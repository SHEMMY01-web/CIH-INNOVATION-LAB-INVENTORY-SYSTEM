import React, { useEffect, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../contexts/AlertContext';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import Pagination from '../components/Pagination';
import FilterModal from '../components/FilterModal';
import ActiveFilterBar from '../components/ActiveFilterBar';
import ImageLightbox from '../components/ImageLightbox';
import { exportToCSV } from '../utils/exportUtils';
import { smartSearch } from '../utils/searchUtils';
import { getItemTypeLabel, enrichItemWithType, enrichItemsWithType } from '../utils/inventoryClassifier';
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

function getTxImage(tx) {
  if (tx.image_url) return tx.image_url;
  if (tx.items?.image_url) return tx.items.image_url;
  const slug = slugify(tx.items?.item_name);
  return slug ? `/IMAGES/items/${slug}.webp` : null;
}

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

export default function Requests() {
  const { user, isLoggingOut } = useAuth();
  const { showSuccess, showError, showWarning } = useAlert();
  const [transactions, setTransactions] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('requested');
  
  // Pagination for Requested
  const [pageReq, setPageReq] = useState(1);
  const [pageSizeReq, setPageSizeReq] = useState(10);

  // Pagination for Returned
  const [pageRet, setPageRet] = useState(1);
  const [pageSizeRet, setPageSizeRet] = useState(10);

  // Modals state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState({ unit: 'all', type: 'all' });

  // New Transaction Form State
  const [newTx, setNewTx] = useState({
    item_id: '',
    tx_type: 'checkout',
    amount: 1,
    requester: '',
    project: ''
  });
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [lightboxItem, setLightboxItem] = useState(null);

  // Dismiss modal on Escape key (WCAG 2.1 AA)
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

  useEffect(() => {
    if (!user) return;
    fetchTransactions();
    fetchItemsList();
  }, [user]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, items(*)')
        .order('timestamp', { ascending: false });
      
      if (error) {
        console.error('Error fetching transactions:', error);
        return;
      }
      if (data) {
        setTransactions(data.map(tx => ({
          ...tx,
          items: tx.items ? enrichItemWithType(tx.items) : null
        })));
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchItemsList = async () => {
    const { data, error } = await supabase
      .from('items')
      .select('id, item_name, amount, store, type, project')
      .order('item_name');
    if (error) {
      console.error('Error fetching items list:', error);
      return;
    }
    if (data) setItemsList(enrichItemsWithType(data));
  };

  // Reset pagination on search or filter change
  useEffect(() => {
    setPageReq(1);
    setPageRet(1);
  }, [search, filterCriteria]);

  // Compute outstanding borrowed items (checkouts minus returns per item)
  const outstandingItems = useMemo(() => {
    const balanceMap = new Map();
    transactions.forEach(t => {
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

    return Array.from(balanceMap.entries())
      .filter(([, entry]) => entry.netBorrowed > 0)
      .map(([id, entry]) => ({
        id,
        ...entry.item,
        netBorrowed: entry.netBorrowed
      }))
      .sort((a, b) => (a.item_name || '').localeCompare(b.item_name || ''));
  }, [transactions]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterCriteria.unit && filterCriteria.unit !== 'all') count++;
    if (filterCriteria.type && filterCriteria.type !== 'all') count++;
    return count;
  }, [filterCriteria]);

  const handleRemoveFilter = (filterKey) => {
    setFilterCriteria(prev => ({ ...prev, [filterKey]: 'all' }));
  };

  const handleClearAllFilters = () => {
    setFilterCriteria({ unit: 'all', type: 'all', store: 'all' });
  };

  // Ambiguity-resilient fuzzy search and unit/type filtering
  const filteredTransactions = useMemo(() => {
    let result = transactions;
    const unit = filterCriteria.unit || filterCriteria.store;
    if (unit && unit !== 'all') {
      result = result.filter(tx => tx.items?.store === unit);
    }
    if (filterCriteria.type && filterCriteria.type !== 'all') {
      result = result.filter(tx => tx.transaction_type === filterCriteria.type);
    }
    return smartSearch(result, search, tx => [
      tx.items?.item_name || '',
      tx.requester || '',
      tx.project || '',
      tx.items?.model || ''
    ]);
  }, [transactions, search, filterCriteria]);

  const requested = useMemo(() => {
    return filteredTransactions.filter(tx => tx.transaction_type === 'checkout' || tx.transaction_type === 'request');
  }, [filteredTransactions]);

  const returned = useMemo(() => {
    return filteredTransactions.filter(tx => tx.transaction_type === 'return');
  }, [filteredTransactions]);

  // Paginated slices
  const paginatedRequested = useMemo(() => {
    const start = (pageReq - 1) * pageSizeReq;
    return requested.slice(start, start + pageSizeReq);
  }, [requested, pageReq, pageSizeReq]);

  const paginatedReturned = useMemo(() => {
    const start = (pageRet - 1) * pageSizeRet;
    return returned.slice(start, start + pageSizeRet);
  }, [returned, pageRet, pageSizeRet]);

  if (!user) {
    return <Navigate to={isLoggingOut ? "/" : "/login"} replace />;
  }

  const handleTxTypeChange = (type) => {
    setNewTx(prev => ({
      ...prev,
      tx_type: type,
      item_id: '',
      amount: 1
    }));
  };

  const handleCreateTransaction = async (e) => {
    e.preventDefault();
    if (!newTx.item_id || !newTx.requester.trim()) {
      showWarning('Please select an item and fill requester name', 'Required Fields');
      return;
    }

    const requestedQty = Number(newTx.amount) || 1;
    if (requestedQty <= 0) {
      showWarning('Amount must be greater than 0', 'Invalid Quantity');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Fetch item current amount and name
      const { data: itemData, error: fetchErr } = await supabase
        .from('items')
        .select('amount, item_name')
        .eq('id', newTx.item_id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!itemData) {
        showError('Selected item could not be found in the inventory database.', 'Item Not Found');
        setSubmitting(false);
        return;
      }

      let currentStock = Number(itemData.amount) || 0;
      let newAmount = currentStock;
      if (newTx.tx_type === 'checkout') {
        if (currentStock < requestedQty) {
          showWarning(`Insufficient stock available! Only ${currentStock} units of "${itemData.item_name}" remaining.`, 'Insufficient Stock');
          setSubmitting(false);
          return;
        }
        newAmount = Math.max(0, currentStock - requestedQty);
      } else {
        // Return adds back to stock
        newAmount = currentStock + requestedQty;
      }

      // 2. Convert proof image to base64 if selected
      let txImageUrl = null;
      if (proofFile) {
        try {
          txImageUrl = await fileToBase64(proofFile);
        } catch (imgErr) {
          console.warn('Proof image conversion failed:', imgErr);
        }
      }

      // 3. Update stock in items table
      const { error: updateErr } = await supabase
        .from('items')
        .update({ amount: newAmount })
        .eq('id', newTx.item_id);

      if (updateErr) throw updateErr;

      // 4. Insert transaction log
      const insertPayload = {
        item_id: newTx.item_id,
        transaction_type: newTx.tx_type,
        amount: requestedQty,
        requester: newTx.requester.trim(),
        project: newTx.project.trim() || 'General',
        timestamp: new Date().toISOString()
      };

      if (txImageUrl) {
        insertPayload.image_url = txImageUrl;
      }

      let { error: insertErr } = await supabase
        .from('transactions')
        .insert([insertPayload]);

      // Fallback if image_url column isn't in transactions table
      if (insertErr && (insertErr.message?.includes('image_url') || insertErr.message?.includes('schema cache'))) {
        console.warn('Fallback: image_url column not supported in transactions, inserting without image...');
        delete insertPayload.image_url;
        const retry = await supabase.from('transactions').insert([insertPayload]);
        insertErr = retry.error;
      }

      if (insertErr) throw insertErr;

      await showSuccess(`Transaction logged successfully! ${newTx.tx_type === 'checkout' ? 'Checked out' : 'Returned'} ${requestedQty} units of "${itemData.item_name}".`, 'Transaction Recorded');
      await fetchTransactions();
      await fetchItemsList();
      setIsAddModalOpen(false);
      setNewTx({
        item_id: '',
        tx_type: 'checkout',
        amount: 1,
        requester: '',
        project: ''
      });
      setProofFile(null);
      setProofPreview(null);
    } catch (err) {
      showError('Error recording transaction: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const exportTransactions = (dataList, typeName) => {
    exportToCSV(dataList, [
      { label: 'Item Name', key: 'item_name', transform: (_, row) => row.items?.item_name || '—' },
      { label: 'Model', key: 'model', transform: (_, row) => row.items?.model || '—' },
      { label: 'Type', key: 'type', transform: (_, row) => row.items?.type || '—' },
      { label: 'Amount', key: 'amount' },
      { label: 'Project', key: 'project' },
      { label: 'Requester', key: 'requester' },
      { label: 'Date', key: 'timestamp', transform: val => val ? new Date(val).toLocaleDateString() : '—' }
    ], `${typeName}_transactions.csv`);
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="main-content">
        <Topbar onSearch={(e) => setSearch(e.target.value)} />

        <div className="tabs-container">
          {/* Hidden Radio Buttons for Tabs */}
          <input 
            type="radio" 
            id="tab-items" 
            name="request-tabs" 
            className="tab-radio" 
            checked={activeTab === 'requested'}
            onChange={() => setActiveTab('requested')} 
          />
          <input 
            type="radio" 
            id="tab-assets" 
            name="request-tabs" 
            className="tab-radio" 
            checked={activeTab === 'returned'}
            onChange={() => setActiveTab('returned')} 
          />

          {/* Tab Headers */}
          <div className="tabs-header">
            <label 
              htmlFor="tab-items" 
              className={`tab-label label-items ${activeTab === 'requested' ? 'active' : ''}`}
              onClick={() => setActiveTab('requested')}
            >
              <span className="material-symbols-outlined nav-icon" style={{ verticalAlign: 'middle' }}>inventory</span> Requested ({requested.length})
            </label>
            <label 
              htmlFor="tab-assets" 
              className={`tab-label label-assets ${activeTab === 'returned' ? 'active' : ''}`}
              onClick={() => setActiveTab('returned')}
            >
              <span className="material-symbols-outlined nav-icon" style={{ verticalAlign: 'middle' }}>assignment_return</span> Returned ({returned.length})
            </label>
          </div>

          {/* Tab Content: Requested */}
          <div className="tab-content" id="content-items">
            <div className="table-container" style={{ borderRadius: 0, boxShadow: 'none', paddingTop: '20px', margin: 0, border: 'none' }}>
              <div className="table-toolbar">
                <div className="toolbar-actions">
                  <button 
                    type="button" 
                    className="action-btn primary" 
                    onClick={() => {
                      setNewTx({ item_id: '', tx_type: 'checkout', amount: 1, requester: '', project: '' });
                      setIsAddModalOpen(true);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px', marginRight: '4px' }}>add_circle</span> Add Transaction
                  </button>
                  <button 
                    type="button" 
                    className="action-btn" 
                    onClick={() => exportTransactions(requested, 'requested')}
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
                      <th>Requester</th>
                      <th>Date Borrowed</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 7 }).map((_, idx) => (
                        <tr key={`skel-req-${idx}`}>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '65%' }}></span></td>
                          <td><span className="skeleton-box skeleton-img"></span></td>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '45%' }}></span></td>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '40%' }}></span></td>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '35%' }}></span></td>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '50%' }}></span></td>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '55%' }}></span></td>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '45%' }}></span></td>
                          <td style={{ textAlign: 'center' }}><span className="skeleton-box skeleton-btn"></span></td>
                        </tr>
                      ))
                    ) : (
                      <>
                        {paginatedRequested.map(tx => {
                          const itemImg = getTxImage(tx);
                          return (
                            <tr key={tx.id}>
                              <td style={{ fontWeight: 600 }}>{tx.items?.item_name || 'Unknown Item'}</td>
                              <td>
                                {itemImg ? (
                                  <img src={itemImg} alt="Item" width="40" height="40" style={{ borderRadius: '6px', objectFit: 'contain', background: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={() => setLightboxItem({ isOpen: true, imageSrc: itemImg, title: tx.items?.item_name })} onError={(e) => { e.target.style.display = 'none'; }} />
                                ) : (
                                  <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>image</span>
                                )}
                              </td>
                              <td>{tx.items?.model || '—'}</td>
                              <td>{tx.items ? getItemTypeLabel(tx.items) : '—'}</td>
                              <td><strong>{tx.amount}</strong> {tx.items?.store || 'pcs'}</td>
                              <td>{tx.project || 'General'}</td>
                              <td>{tx.requester}</td>
                              <td>{tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : '—'}</td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="view-img-btn"
                                  onClick={() => setLightboxItem({ isOpen: true, imageSrc: itemImg, title: tx.items?.item_name })}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>visibility</span> View
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {requested.length === 0 && (
                          <tr><td colSpan="9" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>No requested items found</td></tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={pageReq}
                pageSize={pageSizeReq}
                totalRecords={requested.length}
                onPageChange={setPageReq}
                onPageSizeChange={(size) => {
                  setPageSizeReq(size);
                  setPageReq(1);
                }}
                pageSizeOptions={[6, 10, 20, 50]}
              />
            </div>
          </div>

          {/* Tab Content: Returned */}
          <div className="tab-content" id="content-assets">
            <div className="table-container" style={{ borderRadius: 0, boxShadow: 'none', paddingTop: '20px', margin: 0, border: 'none' }}>
              <div className="table-toolbar">
                <div className="toolbar-actions">
                  <button 
                    type="button" 
                    className="action-btn primary" 
                    onClick={() => {
                      setNewTx({ item_id: '', tx_type: 'return', amount: 1, requester: '', project: '' });
                      setIsAddModalOpen(true);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px', marginRight: '4px' }}>add_circle</span> Add Transaction
                  </button>
                  <button 
                    type="button" 
                    className="action-btn" 
                    onClick={() => exportTransactions(returned, 'returned')}
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
                      <th>Requester</th>
                      <th>Date Returned</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 7 }).map((_, idx) => (
                        <tr key={`skel-ret-${idx}`}>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '65%' }}></span></td>
                          <td><span className="skeleton-box skeleton-img"></span></td>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '45%' }}></span></td>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '40%' }}></span></td>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '35%' }}></span></td>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '50%' }}></span></td>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '55%' }}></span></td>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '45%' }}></span></td>
                          <td style={{ textAlign: 'center' }}><span className="skeleton-box skeleton-btn"></span></td>
                        </tr>
                      ))
                    ) : (
                      <>
                        {paginatedReturned.map(tx => {
                          const itemImg = getTxImage(tx);
                          return (
                            <tr key={tx.id}>
                              <td style={{ fontWeight: 600 }}>{tx.items?.item_name || 'Unknown Item'}</td>
                              <td>
                                {itemImg ? (
                                  <img src={itemImg} alt="Item" width="40" height="40" style={{ borderRadius: '6px', objectFit: 'contain', background: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={() => setLightboxItem({ isOpen: true, imageSrc: itemImg, title: tx.items?.item_name })} onError={(e) => { e.target.style.display = 'none'; }} />
                                ) : (
                                  <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>image</span>
                                )}
                              </td>
                              <td>{tx.items?.model || '—'}</td>
                              <td>{tx.items ? getItemTypeLabel(tx.items) : '—'}</td>
                              <td><strong>{tx.amount}</strong> {tx.items?.store || 'pcs'}</td>
                              <td>{tx.project || 'General'}</td>
                              <td>{tx.requester}</td>
                              <td>{tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : '—'}</td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="view-img-btn"
                                  onClick={() => setLightboxItem({ isOpen: true, imageSrc: itemImg, title: tx.items?.item_name })}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>visibility</span> View
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {returned.length === 0 && (
                          <tr><td colSpan="9" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>No returned items found</td></tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={pageRet}
                pageSize={pageSizeRet}
                totalRecords={returned.length}
                onPageChange={setPageRet}
                onPageSizeChange={(size) => {
                  setPageSizeRet(size);
                  setPageRet(1);
                }}
                pageSizeOptions={[6, 10, 20, 50]}
              />
            </div>
          </div>
        </div>
      </main>

      <ImageLightbox
        isOpen={!!lightboxItem}
        onClose={() => setLightboxItem(null)}
        imageSrc={lightboxItem?.imageSrc}
        title={lightboxItem?.title}
      />

      {/* Add Transaction Modal */}
      {isAddModalOpen && (
        <div className="side-modal-overlay open" style={{ display: 'flex', zIndex: 9999 }} onClick={() => setIsAddModalOpen(false)}>
          <div className="side-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Transaction</h2>
              <button 
                type="button" 
                className="close-btn" 
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleCreateTransaction} className="modal-body">
              <div className="form-grid" style={{ marginTop: '10px' }}>
                <div className="form-group">
                  <label>Transaction Type <span className="required">*</span></label>
                  <select 
                    value={newTx.tx_type}
                    onChange={(e) => handleTxTypeChange(e.target.value)}
                    required
                  >
                    <option value="checkout">Request (Checkout)</option>
                    <option value="return">Return</option>
                  </select>
                </div>

                {newTx.tx_type === 'return' ? (
                  <div className="form-group">
                    <label>Select Borrowed Item to Return <span className="required">*</span></label>
                    <select 
                      value={newTx.item_id}
                      onChange={(e) => setNewTx({ ...newTx, item_id: e.target.value })}
                      required
                    >
                      <option value="" disabled>Choose Borrowed Item...</option>
                      {outstandingItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.item_name} (Outstanding: {item.netBorrowed} {item.store || 'pcs'})
                        </option>
                      ))}
                      {outstandingItems.length === 0 && (
                        <option value="" disabled>No borrowed items to return</option>
                      )}
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Select Item / Asset to Request <span className="required">*</span></label>
                    <select 
                      value={newTx.item_id}
                      onChange={(e) => setNewTx({ ...newTx, item_id: e.target.value })}
                      required
                    >
                      <option value="" disabled>Choose Item...</option>
                      {itemsList.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.item_name} (Stock: {item.amount} {item.store || 'pcs'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Amount <span className="required">*</span></label>
                  <input 
                    type="number" 
                    placeholder="Enter amount" 
                    min="1" 
                    value={newTx.amount}
                    onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Requester Name <span className="required">*</span></label>
                  <input 
                    type="text" 
                    placeholder="Enter requester name" 
                    value={newTx.requester}
                    onChange={(e) => setNewTx({ ...newTx, requester: e.target.value })}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Project</label>
                  <input 
                    type="text" 
                    placeholder="Enter project name (e.g. CIH Lab)" 
                    value={newTx.project}
                    onChange={(e) => setNewTx({ ...newTx, project: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Proof / Image</label>
                  <div className="file-input-wrapper" style={{ position: 'relative', overflow: 'hidden' }}>
                    <input 
                      type="file" 
                      id="tx-image" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setProofFile(file);
                          setProofPreview(URL.createObjectURL(file));
                        } else {
                          setProofFile(null);
                          setProofPreview(null);
                        }
                      }}
                      style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 2 }}
                    />
                    <div className="file-input-display" style={{ padding: '10px 14px', border: '1px dashed #cbd5e1', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card-bg)' }}>
                      <span style={{ fontSize: '0.9rem', color: proofFile ? 'var(--text-color)' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85%' }}>
                        {proofFile ? proofFile.name : 'Choose proof receipt or photo...'}
                      </span>
                      <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px', color: '#64748b' }}>attach_file</span>
                    </div>
                  </div>
                  {proofPreview && (
                    <div style={{ marginTop: '8px' }}>
                      <img src={proofPreview} alt="Proof preview" style={{ maxHeight: '80px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '20px 0 0 0', marginTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary modal-btn" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={setFilterCriteria}
        currentFilters={filterCriteria}
        mode="requests"
        transactions={transactions}
      />
    </div>
  );
}
