import React, { useEffect, useState, useMemo } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../contexts/AlertContext';
import { supabase, invalidateApiCache } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ImageLightbox from '../components/ImageLightbox';
import { isLabTool, isLabAsset, classifyItem, enrichItemsWithType } from '../utils/inventoryClassifier';
import { getItemImage } from '../utils/slugify';
import '../styles/dashboard.css';

export default function Dashboard() {
  const { user, isLoggingOut } = useAuth();
  const { showSuccess, showError, showWarning } = useAlert();
  
  const [items, setItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [lightboxItem, setLightboxItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requisitions, setRequisitions] = useState([]);
  const [reqTab, setReqTab] = useState('pending');
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: 'approve',
    request: null,
    notes: '',
    loading: false
  });
  const [stats, setStats] = useState({
    qtyInHand: 0,
    toBeReceived: 0,
    suppliers: 0,
    categories: 0,
    totalItems: 0,
    itemsPending: 0,
    totalAssets: 0,
    assetsPending: 0
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch All Items
      const { data, error } = await supabase
        .from('items')
        // Lean select: only the columns Dashboard actually reads for stats + display
        .select('id, item_name, type, amount, store, status, project, supplier, to_be_received, image_url')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data) return;

      // Filter out any items assigned to a project for general stats
      const generalItems = (data || []).filter(i => !i.project || i.project.trim() === '');
      const enrichedItems = enrichItemsWithType(generalItems);

      const itemsData = enrichedItems.filter(i => {
        const t = (i.type || '').toLowerCase();
        return !t.startsWith('asset:') && !t.startsWith('tool:') && !isLabAsset(i) && !isLabTool(i);
      });

      const assetsData = enrichedItems.filter(i => {
        const t = (i.type || '').toLowerCase();
        return t.startsWith('asset:') || isLabAsset(i);
      });

      setItems(itemsData);
      setAssets(assetsData);

      // Dynamic stats calculation matching authentic lab inventory
      const totalStock = generalItems.reduce((s, r) => s + (r.amount ?? 0), 0);
      const totalToBeReceived = generalItems.reduce((s, r) => s + (r.to_be_received ?? 0), 0);
      const uniqueSuppliers = new Set(generalItems.map(i => i.supplier).filter(Boolean)).size;
      const uniqueCategories = new Set(enrichedItems.map(i => classifyItem(i)).filter(Boolean)).size;

      const itemsPending = itemsData.reduce((s, r) => s + (r.to_be_received ?? 0), 0);
      const assetsPending = assetsData.reduce((s, r) => s + (r.to_be_received ?? 0), 0);

      setStats({
        qtyInHand: totalStock,
        toBeReceived: totalToBeReceived,
        suppliers: uniqueSuppliers,
        categories: uniqueCategories,
        totalItems: itemsData.length,
        itemsPending: itemsPending,
        totalAssets: assetsData.length,
        assetsPending: assetsPending
      });

      // Fetch Online Requisitions & Equipment Orders
      try {
        const { data: reqData, error: reqErr } = await supabase
          .from('item_requests')
          .select('*, items(*)')
          .order('created_at', { ascending: false });

        let combinedReqs = [];
        if (!reqErr && reqData) {
          combinedReqs = reqData;
        }

        // Merge local storage fallback queue if available
        try {
          const localQueue = JSON.parse(localStorage.getItem('cih_pending_requisitions') || '[]');
          const existingIds = new Set(combinedReqs.map(r => r.id));
          const unmerged = localQueue.filter(r => !existingIds.has(r.id));
          combinedReqs = [...unmerged, ...combinedReqs];
        } catch (_) {}

        setRequisitions(combinedReqs);
      } catch (reqErr) {
        console.warn('[Dashboard] Could not fetch requisitions:', reqErr);
      }
    } catch (err) {
      console.error('[Dashboard] Fetch error:', err);
      showError('Failed to load dashboard metrics: ' + (err.message || 'Database error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    
    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleOpenActionModal = (request, type) => {
    setActionModal({
      isOpen: true,
      type,
      request,
      notes: '',
      loading: false
    });
  };

  const handleConfirmAction = async () => {
    if (!actionModal.request) return;
    const req = actionModal.request;
    const isApprove = actionModal.type === 'approve';

    setActionModal(prev => ({ ...prev, loading: true }));

    try {
      if (isApprove) {
        // 1. Fetch latest real-time stock to verify sufficiency
        let currentStock = req.items ? Number(req.items.amount) || 0 : 0;
        if (req.item_id) {
          try {
            const { data: latestItem } = await supabase
              .from('items')
              .select('amount, item_name')
              .eq('id', req.item_id)
              .maybeSingle();
            if (latestItem && latestItem.amount != null) {
              currentStock = Number(latestItem.amount) || 0;
            }
          } catch (_) {}
        }

        if (currentStock < req.quantity) {
          setActionModal(prev => ({ ...prev, loading: false }));
          showError(`Cannot approve: Only ${currentStock} units available in lab, but ${req.quantity} requested.`, 'Insufficient Stock');
          return;
        }

        // 2. Perform atomic checkout via RPC with robust client-side fallback
        let rpcSuccess = false;
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc('execute_inventory_transaction', {
            p_item_id: req.item_id,
            p_tx_type: 'checkout',
            p_amount: req.quantity,
            p_requester: req.requester_name.trim(),
            p_project: req.project_name || 'General',
            p_image_url: null
          });
          if (!rpcErr && rpcData) {
            rpcSuccess = true;
          }
        } catch (rpcErr) {
          console.warn('[Dashboard] RPC checkout notice:', rpcErr);
        }

        // Client-side fallback if RPC is not available in database
        if (!rpcSuccess && req.item_id) {
          try {
            const newAmount = Math.max(0, currentStock - req.quantity);
            await supabase
              .from('items')
              .update({
                amount: newAmount,
                status: newAmount === 0 ? 'Out of Stock' : 'available'
              })
              .eq('id', req.item_id);

            await supabase
              .from('transactions')
              .insert([{
                item_id: req.item_id,
                transaction_type: 'checkout',
                amount: req.quantity,
                requester: req.requester_name.trim(),
                project: req.project_name || 'General',
                timestamp: new Date().toISOString()
              }]);
          } catch (fallbackErr) {
            console.warn('[Dashboard] Direct stock checkout notice:', fallbackErr);
          }
        }
      }

      // 3. Update requisition status
      const updatedStatus = isApprove ? 'approved' : 'declined';
      const adminNotes = actionModal.notes.trim() || (isApprove ? 'Approved by Admin' : 'Declined by Admin');
      const adminEmail = user?.email || 'Admin';
      const reviewedAt = new Date().toISOString();

      try {
        await supabase
          .from('item_requests')
          .update({
            status: updatedStatus,
            admin_notes: adminNotes,
            reviewed_by: adminEmail,
            reviewed_at: reviewedAt
          })
          .eq('id', req.id);
      } catch (dbErr) {
        console.warn('[Dashboard] Remote requisition update notice:', dbErr);
      }

      // 4. Update local storage queues (both admin queue and user tracking queue)
      const updateLocalQueue = (storageKey) => {
        try {
          const list = JSON.parse(localStorage.getItem(storageKey) || '[]');
          const updated = list.map(item => {
            if (item.id === req.id) {
              return {
                ...item,
                status: updatedStatus,
                admin_notes: adminNotes,
                reviewed_by: adminEmail,
                reviewed_at: reviewedAt
              };
            }
            return item;
          });
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch (_) {}
      };
      updateLocalQueue('cih_pending_requisitions');
      updateLocalQueue('cih_user_orders');

      // 5. Update local state immediately
      setRequisitions(prev => prev.map(r => r.id === req.id ? {
        ...r,
        status: updatedStatus,
        admin_notes: adminNotes,
        reviewed_by: adminEmail,
        reviewed_at: reviewedAt
      } : r));

      // 6. CLOSE MODAL IMMEDIATELY to prevent UI freezing
      setActionModal({ isOpen: false, type: 'approve', request: null, notes: '', loading: false });

      // 7. Invalidate caches and trigger re-fetch in background
      invalidateApiCache();
      fetchDashboardData().catch(() => null);

      // 8. Show user confirmation alert
      if (isApprove) {
        showSuccess(
          `Requisition approved for ${req.requester_name}. ${req.quantity}x "${req.items?.item_name || 'Equipment'}" checked out.`,
          'Request Approved'
        );
      } else {
        showWarning(
          `Requisition declined for ${req.requester_name}.`,
          'Request Declined'
        );
      }
    } catch (err) {
      console.error('[Dashboard] Action failure:', err);
      showError('Failed to process requisition action: ' + (err.message || 'Error occurred'));
      setActionModal(prev => ({ ...prev, loading: false }));
    }
  };

  const pendingCount = useMemo(() => requisitions.filter(r => r.status === 'pending').length, [requisitions]);
  const approvedCount = useMemo(() => requisitions.filter(r => r.status === 'approved').length, [requisitions]);
  const declinedCount = useMemo(() => requisitions.filter(r => r.status === 'declined').length, [requisitions]);

  const filteredRequisitions = useMemo(() => {
    if (reqTab === 'pending') return requisitions.filter(r => r.status === 'pending');
    if (reqTab === 'approved') return requisitions.filter(r => r.status === 'approved');
    if (reqTab === 'declined') return requisitions.filter(r => r.status === 'declined');
    return requisitions;
  }, [requisitions, reqTab]);

  if (!user) {
    return <Navigate to={isLoggingOut ? "/" : "/login"} replace />;
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <Topbar />
        
        <div className="dashboard-grid">
          {/* Online Requisitions Section */}
          <div className="card table-card" style={{ marginBottom: '24px' }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #ff5421 0%, #ff7a50 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff'
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>shopping_cart_checkout</span>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Online Equipment Requisitions
                    {pendingCount > 0 && (
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: '#fef2f2',
                        color: '#ef4444',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        border: '1px solid #fecaca',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                        {pendingCount} Pending Action
                      </span>
                    )}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Orders placed online by students and lab members awaiting administrator review
                  </p>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setReqTab('pending')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: reqTab === 'pending' ? '1px solid #1c21df' : '1px solid #e2e8f0',
                    background: reqTab === 'pending' ? '#eef2ff' : '#ffffff',
                    color: reqTab === 'pending' ? '#1c21df' : '#64748b',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Pending ({pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setReqTab('approved')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: reqTab === 'approved' ? '1px solid #059669' : '1px solid #e2e8f0',
                    background: reqTab === 'approved' ? '#ecfdf5' : '#ffffff',
                    color: reqTab === 'approved' ? '#059669' : '#64748b',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Approved ({approvedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setReqTab('declined')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: reqTab === 'declined' ? '1px solid #dc2626' : '1px solid #e2e8f0',
                    background: reqTab === 'declined' ? '#fef2f2' : '#ffffff',
                    color: reqTab === 'declined' ? '#dc2626' : '#64748b',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Declined ({declinedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setReqTab('all')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: reqTab === 'all' ? '1px solid #475569' : '1px solid #e2e8f0',
                    background: reqTab === 'all' ? '#f1f5f9' : '#ffffff',
                    color: reqTab === 'all' ? '#0f172a' : '#64748b',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  All ({requisitions.length})
                </button>
              </div>
            </div>

            {/* Requisitions Table */}
            <table className="data-table">
              <thead>
                <tr>
                  <th>Equipment Item</th>
                  <th>Requester & Contact</th>
                  <th>Project</th>
                  <th>Duration</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Admin Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequisitions.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>inbox</span>
                      No {reqTab !== 'all' ? reqTab : ''} equipment requisitions found.
                    </td>
                  </tr>
                ) : (
                  filteredRequisitions.map(req => {
                    const isPending = req.status === 'pending';
                    const isApproved = req.status === 'approved';
                    const isDeclined = req.status === 'declined';
                    const imgSrc = getItemImage(req.items);

                    return (
                      <tr key={req.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {imgSrc ? (
                              <img
                                src={imgSrc}
                                alt={req.items?.item_name || 'Item'}
                                width="36"
                                height="36"
                                style={{ objectFit: 'contain', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                                onClick={() => req.items && setLightboxItem(req.items)}
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            ) : (
                              <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>build</span>
                            )}
                            <div>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{req.items?.item_name || 'Item'}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                Stock: {req.items?.amount ?? '—'} {req.items?.store || 'pcs'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500, color: '#0f172a' }}>{req.requester_name}</div>
                          <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{req.requester_email || req.requester_phone || 'No contact'}</div>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            background: '#f1f5f9',
                            color: '#334155',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            maxWidth: '140px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }} title={req.project_name}>
                            {req.project_name}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#0f172a' }}>
                            {req.needed_date} → {req.return_date}
                          </div>
                          {req.purpose && (
                            <div style={{ fontSize: '0.74rem', color: '#64748b', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.purpose}>
                              "{req.purpose}"
                            </div>
                          )}
                        </td>
                        <td>
                          <strong style={{ color: '#0f172a' }}>{req.quantity}</strong> {req.items?.store || 'pcs'}
                        </td>
                        <td>
                          {isPending && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#fffbeb',
                              color: '#b45309',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              border: '1px solid #fde68a'
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
                              Pending
                            </span>
                          )}
                          {isApproved && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#ecfdf5',
                              color: '#047857',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              border: '1px solid #a7f3d0'
                            }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check</span>
                              Approved
                            </span>
                          )}
                          {isDeclined && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#fef2f2',
                              color: '#b91c1c',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              border: '1px solid #fecaca'
                            }} title={req.admin_notes || 'Declined'}>
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                              Declined
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {isPending ? (
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenActionModal(req, 'approve')}
                                style={{
                                  padding: '5px 10px',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: '#059669',
                                  color: '#ffffff',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontFamily: 'inherit'
                                }}
                                title="Accept request and checkout item"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>check</span>
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenActionModal(req, 'decline')}
                                style={{
                                  padding: '5px 10px',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  border: '1px solid #fca5a5',
                                  background: '#fff',
                                  color: '#dc2626',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontFamily: 'inherit'
                                }}
                                title="Decline request"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
                                Decline
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              {req.reviewed_by ? `By ${req.reviewed_by.split('@')[0]}` : 'Processed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Tables Row */}
          <div className="tables-row">
            {/* Item List */}
            <div className="card table-card">
              <div className="card-header">
                <h3>Item List</h3>
                <Link to="/items" className="view-all">View All</Link>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Image</th>
                    <th>Availability</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={`skel-d-item-${idx}`}>
                        <td><span className="skeleton-box skeleton-text" style={{ width: '70%' }}></span></td>
                        <td><span className="skeleton-box skeleton-img" style={{ width: '36px', height: '36px' }}></span></td>
                        <td><span className="skeleton-box skeleton-badge"></span></td>
                        <td><span className="skeleton-box skeleton-text" style={{ width: '40%' }}></span></td>
                      </tr>
                    ))
                  ) : (
                    <>
                      {items.slice(0, 5).map(item => {
                        const imgSrc = getItemImage(item);
                        const isAvail = item.amount > 0 && item.status === 'available';
                        let statusDisplay = item.status || 'Available';
                        if (item.amount <= 0 || item.status === 'Out of Stock') {
                          statusDisplay = 'Out of Stock';
                        }
                        const badgeClass = isAvail 
                          ? 'available' 
                          : (item.status === 'In Use' ? 'in-use' : item.status === 'Under Maintenance' ? 'maintenance' : item.status === 'Decommissioned' ? 'decommissioned' : 'unavailable');

                        return (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 500 }}>{item.item_name}</td>
                            <td>
                              {imgSrc ? (
                                <img 
                                  src={imgSrc} 
                                  alt={item.item_name} 
                                  width="36" 
                                  height="36" 
                                  style={{ objectFit: 'contain', background: '#fff', borderRadius: '4px', border: '1px solid #e2e8f0', cursor: 'pointer' }} 
                                  onClick={() => setLightboxItem(item)}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>image</span>
                              )}
                            </td>
                            <td>
                              <span className={`status-badge ${badgeClass}`}>
                                {statusDisplay}
                              </span>
                            </td>
                            <td>{item.amount} {item.store || 'pcs'}</td>
                          </tr>
                        );
                      })}
                      {items.length === 0 && (
                        <tr><td colSpan="4" style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>No items found</td></tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Asset List */}
            <div className="card table-card">
              <div className="card-header">
                <h3>Asset List</h3>
                <Link to="/assets" className="view-all">View All</Link>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Asset Name</th>
                    <th>Image</th>
                    <th>Availability</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={`skel-d-asset-${idx}`}>
                        <td><span className="skeleton-box skeleton-text" style={{ width: '70%' }}></span></td>
                        <td><span className="skeleton-box skeleton-img" style={{ width: '36px', height: '36px' }}></span></td>
                        <td><span className="skeleton-box skeleton-badge"></span></td>
                        <td><span className="skeleton-box skeleton-text" style={{ width: '40%' }}></span></td>
                      </tr>
                    ))
                  ) : (
                    <>
                      {assets.slice(0, 5).map(item => {
                        const imgSrc = getItemImage(item);
                        const isAvail = item.amount > 0 && item.status === 'available';
                        let statusDisplay = item.status || 'Available';
                        if (item.amount <= 0 || item.status === 'Out of Stock') {
                          statusDisplay = 'Out of Stock';
                        }
                        const badgeClass = isAvail 
                          ? 'available' 
                          : (item.status === 'In Use' ? 'in-use' : item.status === 'Under Maintenance' ? 'maintenance' : item.status === 'Decommissioned' ? 'decommissioned' : 'unavailable');

                        return (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 500 }}>{item.item_name}</td>
                            <td>
                              {imgSrc ? (
                                <img 
                                  src={imgSrc} 
                                  alt={item.item_name} 
                                  width="36" 
                                  height="36" 
                                  style={{ objectFit: 'contain', background: '#fff', borderRadius: '4px', border: '1px solid #e2e8f0', cursor: 'pointer' }} 
                                  onClick={() => setLightboxItem(item)}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>image</span>
                              )}
                            </td>
                            <td>
                              <span className={`status-badge ${badgeClass}`}>
                                {statusDisplay}
                              </span>
                            </td>
                            <td>{item.amount} {item.store || 'pcs'}</td>
                          </tr>
                        );
                      })}
                      {assets.length === 0 && (
                        <tr><td colSpan="4" style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>No assets found</td></tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Cards Row */}
          <div className="summary-row">
            <div className="card summary-card">
              <h3>Item Summary</h3>
              <div className="summary-stats">
                <div className="stat">
                  <div className="icon blue"><span className="material-symbols-outlined">inventory_2</span></div>
                  <h4>{loading ? <span className="skeleton-box skeleton-text" style={{ width: '36px', height: '22px', display: 'inline-block' }}></span> : stats.qtyInHand}</h4>
                  <p>Quantity in Hand</p>
                </div>
                <div className="stat">
                  <div className="icon orange"><span className="material-symbols-outlined">pending_actions</span></div>
                  <h4>{loading ? <span className="skeleton-box skeleton-text" style={{ width: '36px', height: '22px', display: 'inline-block' }}></span> : stats.toBeReceived}</h4>
                  <p>To be received</p>
                </div>
              </div>
            </div>

            <div className="card summary-card">
              <h3>Product Summary</h3>
              <div className="summary-stats">
                <div className="stat">
                  <div className="icon blue"><span className="material-symbols-outlined">person</span></div>
                  <h4>{loading ? <span className="skeleton-box skeleton-text" style={{ width: '36px', height: '22px', display: 'inline-block' }}></span> : stats.suppliers}</h4>
                  <p>Number of Suppliers</p>
                </div>
                <div className="stat">
                  <div className="icon orange"><span className="material-symbols-outlined">category</span></div>
                  <h4>{loading ? <span className="skeleton-box skeleton-text" style={{ width: '36px', height: '22px', display: 'inline-block' }}></span> : stats.categories}</h4>
                  <p>Number of Categories</p>
                </div>
              </div>
            </div>

            <div className="card summary-card">
              <h3>Total items</h3>
              <div className="summary-stats">
                <div className="stat">
                  <div className="icon blue"><span className="material-symbols-outlined">inventory_2</span></div>
                  <h4>{loading ? <span className="skeleton-box skeleton-text" style={{ width: '36px', height: '22px', display: 'inline-block' }}></span> : stats.totalItems}</h4>
                  <p>Total Number of Items</p>
                </div>
                <div className="stat">
                  <div className="icon orange"><span className="material-symbols-outlined">pending_actions</span></div>
                  <h4>{loading ? <span className="skeleton-box skeleton-text" style={{ width: '36px', height: '22px', display: 'inline-block' }}></span> : stats.itemsPending}</h4>
                  <p>To be received</p>
                </div>
              </div>
            </div>

            <div className="card summary-card">
              <h3>Total assets</h3>
              <div className="summary-stats">
                <div className="stat">
                  <div className="icon blue"><span className="material-symbols-outlined">leaderboard</span></div>
                  <h4>{loading ? <span className="skeleton-box skeleton-text" style={{ width: '36px', height: '22px', display: 'inline-block' }}></span> : stats.totalAssets}</h4>
                  <p>Total Number of Assets</p>
                </div>
                <div className="stat">
                  <div className="icon orange"><span className="material-symbols-outlined">pending_actions</span></div>
                  <h4>{loading ? <span className="skeleton-box skeleton-text" style={{ width: '36px', height: '22px', display: 'inline-block' }}></span> : stats.assetsPending}</h4>
                  <p>To be received</p>
                </div>
              </div>
            </div>

            <div className="card summary-card">
              <h3>Requisitions</h3>
              <div className="summary-stats">
                <div className="stat">
                  <div className="icon orange"><span className="material-symbols-outlined">shopping_cart_checkout</span></div>
                  <h4>{loading ? <span className="skeleton-box skeleton-text" style={{ width: '36px', height: '22px', display: 'inline-block' }}></span> : pendingCount}</h4>
                  <p>Pending Review</p>
                </div>
                <div className="stat">
                  <div className="icon blue"><span className="material-symbols-outlined">assignment_turned_in</span></div>
                  <h4>{loading ? <span className="skeleton-box skeleton-text" style={{ width: '36px', height: '22px', display: 'inline-block' }}></span> : approvedCount}</h4>
                  <p>Approved Orders</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Requisition Action (Approve / Decline) Confirmation Modal */}
      {actionModal.isOpen && actionModal.request && (
        <div
          className="side-modal-overlay open"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 1100
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionModal.loading) {
              setActionModal(prev => ({ ...prev, isOpen: false }));
            }
          }}
        >
          <div style={{
            width: '100%',
            maxWidth: '480px',
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            animation: 'modalSlideUp 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: actionModal.type === 'approve' ? '#ecfdf5' : '#fef2f2',
                color: actionModal.type === 'approve' ? '#059669' : '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span className="material-symbols-outlined">
                  {actionModal.type === 'approve' ? 'check_circle' : 'cancel'}
                </span>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
                  {actionModal.type === 'approve' ? 'Approve Equipment Requisition' : 'Decline Requisition'}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  {actionModal.type === 'approve' 
                    ? 'Will check out item and decrement stock atomically' 
                    : 'Stock will be preserved without deduction'}
                </p>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <div style={{ marginBottom: '6px' }}>
                <strong style={{ color: '#0f172a' }}>{actionModal.request.requester_name}</strong> requested:
              </div>
              <div style={{ color: '#1c21df', fontWeight: 600 }}>
                {actionModal.request.quantity}x {actionModal.request.items?.item_name || 'Equipment'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                Project: <strong>{actionModal.request.project_name}</strong> • Duration: {actionModal.request.needed_date} to {actionModal.request.return_date}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {actionModal.type === 'approve' ? 'Pickup Notes / Instructions (Optional)' : 'Reason for Declining (Optional)'}
              </label>
              <textarea
                rows="2"
                placeholder={actionModal.type === 'approve' ? 'e.g. Approved. Pick up at Innovation Lab Bench 2.' : 'e.g. Currently reserved for the upcoming robotics hackathon.'}
                value={actionModal.notes}
                onChange={(e) => setActionModal({ ...actionModal, notes: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={actionModal.loading}
                onClick={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#64748b',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionModal.loading}
                onClick={handleConfirmAction}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: actionModal.type === 'approve' ? '#059669' : '#dc2626',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: actionModal.loading ? 'not-allowed' : 'pointer'
                }}
              >
                {actionModal.loading 
                  ? 'Processing...' 
                  : (actionModal.type === 'approve' ? 'Confirm Approval' : 'Confirm Decline')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      <ImageLightbox
        isOpen={Boolean(lightboxItem)}
        onClose={() => setLightboxItem(null)}
        item={lightboxItem}
        imageUrl={getItemImage(lightboxItem)}
      />
    </div>
  );
}
