import React, { useEffect, useState, useMemo, useCallback, useDeferredValue } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../contexts/AlertContext';
import { supabase, invalidateApiCache } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import Pagination from '../components/Pagination';
import FilterModal from '../components/FilterModal';
import ActiveFilterBar from '../components/ActiveFilterBar';
import ImageLightbox from '../components/ImageLightbox';
import { exportToCSV } from '../utils/exportUtils';
import { smartSearch } from '../utils/searchUtils';
import { getItemTypeLabel, enrichItemWithType, enrichItemsWithType } from '../utils/inventoryClassifier';
import { getItemImage } from '../utils/slugify';
import { deduplicateRequisitions } from '../utils/requisitionUtils';
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

/**
 * Uploads a proof image file to Supabase Storage (inventory-images/proofs/ bucket)
 * and returns the public CDN URL. Stores only a URL in the DB — not Base64 binary.
 * Falls back to null on failure so the transaction can still be recorded.
 */
async function uploadProofToStorage(file, supabaseClient) {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filePath = `proofs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabaseClient.storage
      .from('inventory-images')
      .upload(filePath, file, {
        contentType: file.type || 'image/jpeg',
        cacheControl: '31536000',
        upsert: false
      });
    if (uploadError) {
      console.warn('[Requests] Proof upload failed:', uploadError.message);
      return null;
    }
    const { data: { publicUrl } } = supabaseClient.storage
      .from('inventory-images')
      .getPublicUrl(filePath);
    return publicUrl;
  } catch (err) {
    console.warn('[Requests] Proof upload exception:', err.message);
    return null;
  }
}

export default function Requests() {
  const { user, isLoggingOut } = useAuth();
  const { showSuccess, showError, showWarning } = useAlert();
  const [transactions, setTransactions] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined' && (window.location.hash === '#online' || new URLSearchParams(window.location.search).get('tab') === 'online')) {
      return 'online';
    }
    return 'requested';
  });
  
  // Online equipment requisitions state
  const [itemRequests, setItemRequests] = useState([]);
  const [reqStatusFilter, setReqStatusFilter] = useState('all');
  const [pageOnline, setPageOnline] = useState(1);
  const [pageSizeOnline, setPageSizeOnline] = useState(10);
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: 'approve',
    request: null,
    notes: '',
    loading: false
  });
  
  // Concurrent primitive: keeps typing responsive under heavy fuzzy search
  const deferredSearch = useDeferredValue(search);
  
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

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, items(*)')
        .order('timestamp', { ascending: false })
        .limit(1000);
      
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
  }, []);

  const fetchItemsList = useCallback(async () => {
    const { data, error } = await supabase
      .from('items')
      .select('id, item_name, amount, store, type, project')
      .order('item_name');
    if (error) {
      console.error('Error fetching items list:', error);
      return;
    }
    if (data) setItemsList(enrichItemsWithType(data));
  }, []);

  const fetchItemRequests = useCallback(async () => {
    let remoteRequests = [];
    try {
      const { data, error } = await supabase
        .from('item_requests')
        .select('*, items(*)')
        .order('created_at', { ascending: false });
      if (!error && data) {
        remoteRequests = data;
      }
    } catch (e) {
      console.warn('[Requests] Remote requisitions fetch notice:', e);
    }

    const clean = deduplicateRequisitions(remoteRequests, '');
    setItemRequests(clean);
  }, []);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    Promise.all([fetchTransactions(), fetchItemsList(), fetchItemRequests()]).catch(err => {
      if (isMounted) console.error('[Requests] Initial load error:', err);
    });

    // Realtime subscription for multi-admin synchronization
    const channel = supabase
      .channel('realtime:admin_item_requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_requests' },
        () => {
          if (isMounted) fetchItemRequests();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          if (isMounted) fetchTransactions();
        }
      )
      .subscribe();

    // Auto-sync when window regains focus or on 20s background interval
    const handleFocus = () => {
      if (isMounted) {
        fetchItemRequests();
        fetchTransactions();
      }
    };
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(() => {
      if (isMounted && document.visibilityState === 'visible') {
        fetchItemRequests();
      }
    }, 20000);

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [user, fetchTransactions, fetchItemsList, fetchItemRequests]);

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
    return smartSearch(result, deferredSearch, tx => [
      tx.items?.item_name || '',
      tx.requester || '',
      tx.project || '',
      tx.items?.model || ''
    ]);
  }, [transactions, deferredSearch, filterCriteria]);

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

  // Online orders filtering and pagination
  const filteredOnlineRequests = useMemo(() => {
    let list = itemRequests;
    if (reqStatusFilter !== 'all') {
      list = list.filter(r => (r.status || 'pending').toLowerCase() === reqStatusFilter);
    }
    return smartSearch(list, deferredSearch, r => [
      r.items?.item_name || '',
      r.requester_name || '',
      r.project_name || '',
      r.requester_email || '',
      r.requester_phone || '',
      r.purpose || '',
      r.status || ''
    ]);
  }, [itemRequests, reqStatusFilter, deferredSearch]);

  const paginatedOnlineRequests = useMemo(() => {
    const start = (pageOnline - 1) * pageSizeOnline;
    return filteredOnlineRequests.slice(start, start + pageSizeOnline);
  }, [filteredOnlineRequests, pageOnline, pageSizeOnline]);

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
          console.warn('[Requests] RPC checkout notice:', rpcErr);
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
            console.warn('[Requests] Direct stock checkout notice:', fallbackErr);
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
        console.warn('[Requests] Remote requisition update notice:', dbErr);
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
      setItemRequests(prev => prev.map(r => r.id === req.id ? {
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
      fetchTransactions().catch(() => null);
      fetchItemsList().catch(() => null);
      fetchItemRequests().catch(() => null);

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
      console.error('[Requests] Action failed:', err);
      showError('Action failed: ' + (err.message || 'Unknown error'));
      setActionModal(prev => ({ ...prev, loading: false }));
    }
  };

  const exportOnlineOrders = () => {
    exportToCSV(filteredOnlineRequests, [
      { label: 'Item Name', key: 'item_name', transform: (_, row) => row.items?.item_name || 'Equipment' },
      { label: 'Quantity', key: 'quantity' },
      { label: 'Requester Name', key: 'requester_name' },
      { label: 'Requester Email', key: 'requester_email' },
      { label: 'Requester Phone', key: 'requester_phone' },
      { label: 'Project', key: 'project_name' },
      { label: 'Needed Date', key: 'needed_date' },
      { label: 'Return Date', key: 'return_date', transform: val => val || 'Permanent / Purchase' },
      { label: 'Purpose', key: 'purpose' },
      { label: 'Status', key: 'status', transform: val => val ? val.toUpperCase() : 'PENDING' },
      { label: 'Date Submitted', key: 'created_at', transform: val => val ? new Date(val).toLocaleString() : '—' },
      { label: 'Admin Notes', key: 'admin_notes' }
    ], `online_requisitions_${reqStatusFilter}.csv`);
  };

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
      // 1. Upload proof image to Supabase Storage (URL only stored in DB — no Base64 bloat)
      let txImageUrl = null;
      if (proofFile) {
        txImageUrl = await uploadProofToStorage(proofFile, supabase);
        // txImageUrl is null on failure — transaction still proceeds without proof image
      }

      // 2. Attempt atomic server-side RPC (pessimistic row locking + ACID consistency)
      let rpcResult = null;
      let usedRpc = false;
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('execute_inventory_transaction', {
          p_item_id: newTx.item_id,
          p_tx_type: newTx.tx_type,
          p_amount: requestedQty,
          p_requester: newTx.requester.trim(),
          p_project: newTx.project.trim() || 'General',
          p_image_url: txImageUrl
        });

        if (!rpcErr && rpcData) {
          rpcResult = rpcData;
          usedRpc = true;
        } else if (rpcErr) {
          // If RPC fails with business logic error (insufficient stock), throw immediately
          if (rpcErr.message?.includes('Insufficient stock') || rpcErr.code === '23514') {
            throw new Error(rpcErr.message);
          }
          // If RPC is missing in remote DB (migration not applied yet), fall through to client fallback
          console.warn('[Transactions] RPC execute_inventory_transaction not available, executing client fallback:', rpcErr.message);
        }
      } catch (rpcCallErr) {
        if (rpcCallErr.message?.includes('Insufficient stock')) {
          throw rpcCallErr;
        }
        console.warn('[Transactions] RPC execution error, checking client fallback...', rpcCallErr);
      }

      // 3. Resilient client-side fallback if RPC was not available
      if (!usedRpc) {
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

        const currentStock = Number(itemData.amount) || 0;
        let newAmount = currentStock;
        if (newTx.tx_type === 'checkout') {
          if (currentStock < requestedQty) {
            showWarning(`Insufficient stock available! Only ${currentStock} units of "${itemData.item_name}" remaining.`, 'Insufficient Stock');
            setSubmitting(false);
            return;
          }
          newAmount = Math.max(0, currentStock - requestedQty);
        } else {
          newAmount = currentStock + requestedQty;
        }

        const { error: updateErr } = await supabase
          .from('items')
          .update({ amount: newAmount, status: newAmount === 0 ? 'Out of Stock' : 'available' })
          .eq('id', newTx.item_id);

        if (updateErr) throw updateErr;

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

        if (insertErr && (insertErr.message?.includes('image_url') || insertErr.message?.includes('schema cache'))) {
          delete insertPayload.image_url;
          const retry = await supabase.from('transactions').insert([insertPayload]);
          insertErr = retry.error;
        }

        if (insertErr) {
          // Compensating rollback: restore stock to original state if audit insert fails
          console.error('[Transactions] Audit log insert failed. Executing compensating stock rollback...');
          let rollbackSuccess = false;
          try {
            if (newTx.tx_type === 'checkout') {
              const { error: rpcRollbackErr } = await supabase.rpc('restore_stock', {
                p_item_id: newTx.item_id,
                p_restore_qty: requestedQty
              });
              rollbackSuccess = !rpcRollbackErr;
            } else {
              // On failed return audit, stock was incremented and must be decremented back
              const { error: rpcRollbackErr } = await supabase.rpc('decrement_stock', {
                item_id: newTx.item_id,
                check_amount: requestedQty
              });
              rollbackSuccess = !rpcRollbackErr;
            }
          } catch (rbErr) {
            console.warn('[Transactions] RPC rollback exception:', rbErr);
          }

          if (!rollbackSuccess) {
            // Direct SQL fallback if RPC unavailable
            await supabase
              .from('items')
              .update({ amount: currentStock, status: currentStock === 0 ? 'Out of Stock' : 'available' })
              .eq('id', newTx.item_id);
          }

          throw new Error(`Transaction failed to record (${insertErr.message}). Inventory stock was restored.`);
        }

        rpcResult = {
          item_name: itemData.item_name,
          new_amount: newAmount
        };
      }

      await showSuccess(
        `Transaction logged successfully! ${newTx.tx_type === 'checkout' ? 'Checked out' : 'Returned'} ${requestedQty} units of "${rpcResult.item_name}".`,
        'Transaction Recorded'
      );
      invalidateApiCache();
      await Promise.all([fetchTransactions(), fetchItemsList()]);
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
          <input 
            type="radio" 
            id="tab-online" 
            name="request-tabs" 
            className="tab-radio" 
            checked={activeTab === 'online'}
            onChange={() => setActiveTab('online')} 
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
            <label 
              htmlFor="tab-online" 
              className={`tab-label label-online ${activeTab === 'online' ? 'active' : ''}`}
              onClick={() => setActiveTab('online')}
            >
              <span className="material-symbols-outlined nav-icon" style={{ verticalAlign: 'middle' }}>shopping_cart_checkout</span> Online Orders ({itemRequests.filter(r => (r.status || 'pending').toLowerCase() === 'pending').length > 0 ? `${itemRequests.filter(r => (r.status || 'pending').toLowerCase() === 'pending').length} pending` : itemRequests.length})
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

          {/* Tab Content: Online Orders */}
          <div className="tab-content" id="content-online">
            <div className="table-container" style={{ borderRadius: 0, boxShadow: 'none', paddingTop: '20px', margin: 0, border: 'none' }}>
              <div className="table-toolbar">
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {['all', 'pending', 'approved', 'declined'].map(st => {
                    const count = st === 'all' 
                      ? itemRequests.length 
                      : itemRequests.filter(r => (r.status || 'pending').toLowerCase() === st).length;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => { setReqStatusFilter(st); setPageOnline(1); }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '20px',
                          border: reqStatusFilter === st ? '1px solid var(--primary-color)' : '1px solid #e2e8f0',
                          background: reqStatusFilter === st ? 'var(--primary-color)' : '#ffffff',
                          color: reqStatusFilter === st ? '#ffffff' : '#64748b',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ textTransform: 'capitalize' }}>{st}</span>
                        <span style={{
                          background: reqStatusFilter === st ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                          color: reqStatusFilter === st ? '#ffffff' : '#475569',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          fontSize: '0.72rem'
                        }}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="toolbar-actions">
                  <button 
                    type="button" 
                    className="action-btn" 
                    onClick={exportOnlineOrders}
                  >
                    <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px', marginRight: '4px' }}>download</span> Export Orders
                  </button>
                </div>
              </div>

              <div className="data-table-wrapper" style={{ border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <table className="list-table">
                  <thead>
                    <tr>
                      <th>Equipment / Item</th>
                      <th>Image</th>
                      <th>Requester Contact</th>
                      <th>Target Project</th>
                      <th>Qty</th>
                      <th>Needed Date</th>
                      <th>Return Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Admin Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, idx) => (
                        <tr key={`skel-online-${idx}`}>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '65%' }}></span></td>
                          <td><span className="skeleton-box skeleton-img"></span></td>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '55%' }}></span></td>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '50%' }}></span></td>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '35%' }}></span></td>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '45%' }}></span></td>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '45%' }}></span></td>
                          <td><span className="skeleton-box skeleton-text" style={{ width: '40%' }}></span></td>
                          <td style={{ textAlign: 'center' }}><span className="skeleton-box skeleton-btn"></span></td>
                        </tr>
                      ))
                    ) : (
                      <>
                        {paginatedOnlineRequests.map(req => {
                          const itemImg = getItemImage(req.items);
                          const status = (req.status || 'pending').toLowerCase();
                          const isPending = status === 'pending';
                          const isApproved = status === 'approved';

                          return (
                            <tr key={req.id}>
                              <td>
                                <div style={{ fontWeight: 600, color: 'var(--text-color)' }}>
                                  {req.items?.item_name || 'Equipment'}
                                </div>
                                {req.items?.model && (
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    Model: {req.items.model}
                                  </div>
                                )}
                              </td>
                              <td>
                                {itemImg ? (
                                  <img 
                                    src={itemImg} 
                                    alt="Item" 
                                    width="40" 
                                    height="40" 
                                    style={{ borderRadius: '6px', objectFit: 'contain', background: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer' }} 
                                    onClick={() => setLightboxItem({ isOpen: true, imageSrc: itemImg, title: req.items?.item_name })} 
                                    onError={(e) => { e.target.style.display = 'none'; }} 
                                  />
                                ) : (
                                  <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>image</span>
                                )}
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{req.requester_name}</div>
                                {req.requester_email && (
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{req.requester_email}</div>
                                )}
                                {req.requester_phone && (
                                  <div style={{ fontSize: '0.75rem', color: '#1c21df', fontWeight: 500 }}>{req.requester_phone}</div>
                                )}
                              </td>
                              <td>
                                <span style={{
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.78rem',
                                  fontWeight: 600
                                }}>
                                  {req.project_name}
                                </span>
                                {req.purpose && (
                                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={req.purpose}>
                                    {req.purpose}
                                  </div>
                                )}
                              </td>
                              <td>
                                <strong>{req.quantity}</strong> {req.items?.store || 'pcs'}
                              </td>
                              <td style={{ fontSize: '0.85rem', color: '#334155' }}>
                                {req.needed_date || '—'}
                              </td>
                              <td style={{ fontSize: '0.85rem', color: '#334155' }}>
                                {req.return_date || <span style={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic' }}>Permanent / Buy</span>}
                              </td>
                              <td>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 10px',
                                  borderRadius: '12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: isPending ? '#fffbeb' : (isApproved ? '#eff2fe' : '#fef2f2'),
                                  color: isPending ? '#b45309' : (isApproved ? '#1c21df' : '#b91c1c'),
                                  border: `1px solid ${isPending ? '#fef3c7' : (isApproved ? '#bfdbfe' : '#fecaca')}`
                                }}>
                                  <span style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: isPending ? '#f59e0b' : (isApproved ? '#1c21df' : '#ef4444')
                                  }} />
                                  {status.toUpperCase()}
                                </span>
                                {req.admin_notes && (
                                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px', maxWidth: '140px' }} title={req.admin_notes}>
                                    Note: {req.admin_notes}
                                  </div>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {isPending ? (
                                  <div style={{ display: 'inline-flex', gap: '6px' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenActionModal(req, 'approve')}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '5px 10px',
                                        borderRadius: '6px',
                                        border: '1px solid #bfdbfe',
                                        background: '#eff2fe',
                                        color: '#1c21df',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                      }}
                                      title="Accept and checkout item"
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>check</span>
                                      Accept
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenActionModal(req, 'decline')}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '5px 10px',
                                        borderRadius: '6px',
                                        border: '1px solid #ef4444',
                                        background: '#fef2f2',
                                        color: '#b91c1c',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                      }}
                                      title="Decline requisition"
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
                                      Decline
                                    </button>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                    {isApproved ? 'Fulfilled' : 'Closed'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {filteredOnlineRequests.length === 0 && (
                          <tr>
                            <td colSpan="9" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                              No online requisitions found {reqStatusFilter !== 'all' ? `with status "${reqStatusFilter}"` : ''}
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={pageOnline}
                pageSize={pageSizeOnline}
                totalRecords={filteredOnlineRequests.length}
                onPageChange={setPageOnline}
                onPageSizeChange={(size) => {
                  setPageSizeOnline(size);
                  setPageOnline(1);
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

      {/* Admin Approve / Decline Requisition Modal */}
      {actionModal.isOpen && actionModal.request && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px'
        }} onClick={() => !actionModal.loading && setActionModal(prev => ({ ...prev, isOpen: false }))}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            padding: '24px',
            boxSizing: 'border-box'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: actionModal.type === 'approve' ? '#eff2fe' : '#fef2f2',
                color: actionModal.type === 'approve' ? '#1c21df' : '#dc2626',
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
                Project: <strong>{actionModal.request.project_name}</strong> • {actionModal.request.return_date ? `Duration: ${actionModal.request.needed_date} to ${actionModal.request.return_date}` : `Needed: ${actionModal.request.needed_date} (Permanent / Purchase)`}
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
                  background: actionModal.type === 'approve' ? '#1c21df' : '#dc2626',
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
    </div>
  );
}
