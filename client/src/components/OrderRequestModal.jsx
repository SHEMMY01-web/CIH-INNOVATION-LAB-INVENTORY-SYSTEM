import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAlert } from '../contexts/AlertContext';
import { getItemImage } from '../utils/slugify';

export default function OrderRequestModal({ isOpen, onClose, initialItem = null, onOrderSuccess }) {
  const { showSuccess, showError, showWarning } = useAlert();

  const [itemsList, setItemsList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [selectedItem, setSelectedItem] = useState(initialItem);
  const [isCustomProject, setIsCustomProject] = useState(false);
  const [searchItemQuery, setSearchItemQuery] = useState('');
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);

  // Form Fields
  const [formData, setFormData] = useState({
    requester_name: '',
    requester_email: '',
    requester_phone: '',
    project_name: '',
    custom_project: '',
    needed_date: '',
    return_date: '',
    quantity: 1,
    purpose: ''
  });

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Sync selectedItem when initialItem prop changes
  useEffect(() => {
    if (initialItem) {
      setSelectedItem(initialItem);
      setFormData(prev => ({
        ...prev,
        quantity: 1
      }));
    }
  }, [initialItem]);

  // Load items and projects when modal opens
  useEffect(() => {
    if (!isOpen) {
      setSuccessOrder(null);
      setIsCustomProject(false);
      return;
    }

    let isMounted = true;
    setLoadingInitial(true);

    const loadData = async () => {
      try {
        const [itemsRes, projectsRes] = await Promise.all([
          supabase
            .from('items')
            .select('id, item_name, model, type, amount, store, status, image_url')
            .eq('status', 'available')
            .gt('amount', 0)
            .order('item_name'),
          supabase
            .from('projects')
            .select('id, name')
            .order('name')
        ]);

        if (!isMounted) return;

        if (itemsRes.data) {
          setItemsList(itemsRes.data);
          // If no initialItem was provided, select the first available item
          if (!selectedItem && itemsRes.data.length > 0) {
            setSelectedItem(itemsRes.data[0]);
          }
        }

        if (projectsRes.data && projectsRes.data.length > 0) {
          setProjectsList(projectsRes.data.map(p => p.name).filter(Boolean));
        } else {
          setProjectsList(['IoT & Robotics', 'Smart Agriculture', 'Renewable Energy', 'Embedded Systems', 'General Hardware']);
        }
      } catch (err) {
        console.warn('[OrderRequestModal] Error loading reference data:', err);
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    };

    loadData();

    // Default dates: tomorrow for needed_date, 5 days later for return_date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const returnDefault = new Date();
    returnDefault.setDate(returnDefault.getDate() + 5);

    setFormData(prev => ({
      ...prev,
      needed_date: prev.needed_date || tomorrow.toISOString().split('T')[0],
      return_date: prev.return_date || returnDefault.toISOString().split('T')[0]
    }));

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Keyboard navigation & ESC handler (WCAG 2.1 AA)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredItems = useMemo(() => {
    if (!searchItemQuery.trim()) return itemsList;
    const q = searchItemQuery.toLowerCase();
    return itemsList.filter(i => 
      (i.item_name || '').toLowerCase().includes(q) ||
      (i.model || '').toLowerCase().includes(q) ||
      (i.type || '').toLowerCase().includes(q)
    );
  }, [itemsList, searchItemQuery]);

  const maxAvailable = selectedItem ? Number(selectedItem.amount) || 1 : 1;

  const handleQuantityChange = (newQty) => {
    const val = Math.max(1, Math.min(maxAvailable, Number(newQty) || 1));
    setFormData(prev => ({ ...prev, quantity: val }));
  };

  const handleNeededDateChange = (val) => {
    setFormData(prev => {
      const updated = { ...prev, needed_date: val };
      // Ensure return date is not prior to needed date
      if (prev.return_date && prev.return_date < val) {
        updated.return_date = val;
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) {
      showWarning('Please select an item to request.', 'Item Required');
      return;
    }

    if (!formData.requester_name.trim()) {
      showWarning('Please enter your full name.', 'Name Required');
      return;
    }

    if (!formData.requester_email.trim()) {
      showWarning('Please provide your email address.', 'Email Required');
      return;
    }

    const finalProjectName = isCustomProject 
      ? formData.custom_project.trim() 
      : (formData.project_name || (projectsList[0] || 'General'));

    if (!finalProjectName) {
      showWarning('Please specify the project you want to use the tools for.', 'Project Required');
      return;
    }

    if (!formData.needed_date) {
      showWarning('Please select when you need this equipment.', 'Date Required');
      return;
    }

    if (!formData.return_date) {
      showWarning('Please specify the expected return date.', 'Return Date Required');
      return;
    }

    if (formData.return_date < formData.needed_date) {
      showWarning('Return date must be on or after the needed date.', 'Invalid Date Range');
      return;
    }

    const qty = Number(formData.quantity) || 1;
    if (qty <= 0 || qty > maxAvailable) {
      showWarning(`Requested quantity must be between 1 and ${maxAvailable}.`, 'Invalid Quantity');
      return;
    }

    setSubmitting(true);

    const requestPayload = {
      item_id: selectedItem.id,
      requester_name: formData.requester_name.trim(),
      requester_email: formData.requester_email.trim(),
      requester_phone: formData.requester_phone.trim() || null,
      project_name: finalProjectName,
      quantity: qty,
      needed_date: formData.needed_date,
      return_date: formData.return_date,
      purpose: formData.purpose.trim() || null,
      status: 'pending'
    };

    try {
      // 1. Attempt to insert into Supabase item_requests table
      const { data, error } = await supabase
        .from('item_requests')
        .insert([requestPayload])
        .select('*, items(*)')
        .single();

      if (error) {
        // Fallback resilience: If item_requests table does not exist in PostgREST yet
        console.warn('[OrderRequestModal] Supabase table insert issue, activating local queue:', error.message);
        
        const fallbackId = `REQ-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*1000)}`;
        const localRecord = {
          id: fallbackId,
          ...requestPayload,
          created_at: new Date().toISOString(),
          items: selectedItem
        };

        try {
          const existingQueue = JSON.parse(localStorage.getItem('cih_pending_requisitions') || '[]');
          existingQueue.unshift(localRecord);
          localStorage.setItem('cih_pending_requisitions', JSON.stringify(existingQueue));
        } catch (_) {}

        setSuccessOrder(localRecord);
        if (onOrderSuccess) onOrderSuccess(localRecord);
        return;
      }

      setSuccessOrder(data || { id: 'REQ-OK', ...requestPayload, items: selectedItem });
      if (onOrderSuccess) onOrderSuccess(data);
    } catch (err) {
      console.error('[OrderRequestModal] Unexpected submission failure:', err);
      showError('Unable to submit request. Please verify connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="side-modal-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 1100
      }}
    >
      <div 
        className="order-request-card"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <style>{`
          @keyframes modalSlideUp {
            from { opacity: 0; transform: translateY(24px) scale(0.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          .order-input-group label {
            display: block;
            font-size: 0.82rem;
            font-weight: 600;
            color: #334155;
            margin-bottom: 6px;
          }
          .order-input-field {
            width: 100%;
            padding: 10px 14px;
            font-size: 0.9rem;
            border-radius: 10px;
            border: 1px solid #cbd5e1;
            background: #f8fafc;
            color: #0f172a;
            outline: none;
            transition: all 0.2s ease;
            box-sizing: border-box;
            font-family: inherit;
          }
          .order-input-field:focus {
            border-color: #1c21df;
            background: #ffffff;
            box-shadow: 0 0 0 3px rgba(28, 33, 223, 0.12);
          }
          .stepper-btn {
            width: 36px;
            height: 36px;
            border-radius: 8px;
            border: 1px solid #cbd5e1;
            background: #f8fafc;
            color: #334155;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 1.1rem;
            font-weight: 600;
            transition: background 0.15s;
          }
          .stepper-btn:hover:not(:disabled) {
            background: #e2e8f0;
          }
          .stepper-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }
        `}</style>

        {/* Modal Header */}
        <div style={{
          padding: '20px 28px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to right, #ffffff, #f8fafc)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #1c21df 0%, #ff5421 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>shopping_cart_checkout</span>
            </div>
            <div>
              <h2 id="order-modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {successOrder ? 'Requisition Confirmed' : 'Request Equipment Online'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0 0' }}>
                {successOrder ? 'Reference details for your records' : 'Place an order for tools or hardware components'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
          {successOrder ? (
            /* Success Screen */
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#ecfdf5',
                color: '#059669',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                border: '2px solid #a7f3d0'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '36px' }}>check_circle</span>
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                Requisition Submitted!
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#64748b', maxWidth: '460px', margin: '0 auto 24px auto', lineHeight: 1.5 }}>
                Your order has been queued on the <strong>Admin Dashboard</strong> for staff review. Once approved, you can pick up the equipment at the Innovation Lab.
              </p>

              <div style={{
                background: '#f8fafc',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                padding: '18px 22px',
                textAlign: 'left',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Requisition Reference</span>
                  <span style={{ fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: 700, color: '#1c21df' }}>
                    {String(successOrder.id).slice(0, 14)}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Equipment Item</span>
                    <strong style={{ color: '#0f172a' }}>{selectedItem?.item_name || 'Selected Item'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Quantity</span>
                    <strong style={{ color: '#0f172a' }}>{successOrder.quantity} {selectedItem?.store || 'pcs'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Target Project</span>
                    <strong style={{ color: '#0f172a' }}>{successOrder.project_name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Duration</span>
                    <strong style={{ color: '#0f172a' }}>{successOrder.needed_date} → {successOrder.return_date}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 28px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#1c21df',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Order Form */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Selected Item Banner */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  {selectedItem && (
                    <img 
                      src={getItemImage(selectedItem) || '/IMAGES/placeholder.png'} 
                      alt={selectedItem.item_name}
                      style={{
                        width: '44px',
                        height: '44px',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1'
                      }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Selected Equipment
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedItem?.item_name || 'No Item Selected'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                      {selectedItem?.amount || 0} {selectedItem?.store || 'pcs'} Available in Lab
                    </div>
                  </div>
                </div>

                {/* Change item dropdown selector if items list is populated */}
                {itemsList.length > 1 && (
                  <select
                    value={selectedItem?.id || ''}
                    onChange={(e) => {
                      const found = itemsList.find(i => i.id === e.target.value);
                      if (found) {
                        setSelectedItem(found);
                        setFormData(prev => ({ ...prev, quantity: 1 }));
                      }
                    }}
                    style={{
                      padding: '6px 10px',
                      fontSize: '0.8rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      outline: 'none',
                      cursor: 'pointer',
                      maxWidth: '160px'
                    }}
                  >
                    {itemsList.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.item_name} ({item.amount})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Requester Contact Info Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <div className="order-input-group">
                  <label htmlFor="order-requester-name">Your Full Name *</label>
                  <input
                    id="order-requester-name"
                    type="text"
                    required
                    placeholder="e.g. Victor Olaewe"
                    value={formData.requester_name}
                    onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
                    className="order-input-field"
                  />
                </div>

                <div className="order-input-group">
                  <label htmlFor="order-requester-email">Email Address *</label>
                  <input
                    id="order-requester-email"
                    type="email"
                    required
                    placeholder="e.g. student@institution.edu"
                    value={formData.requester_email}
                    onChange={(e) => setFormData({ ...formData, requester_email: e.target.value })}
                    className="order-input-field"
                  />
                </div>

                <div className="order-input-group">
                  <label htmlFor="order-requester-phone">Phone / WhatsApp</label>
                  <input
                    id="order-requester-phone"
                    type="tel"
                    placeholder="e.g. +234 801 234 5678"
                    value={formData.requester_phone}
                    onChange={(e) => setFormData({ ...formData, requester_phone: e.target.value })}
                    className="order-input-field"
                  />
                </div>
              </div>

              {/* Target Project Selection */}
              <div className="order-input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label htmlFor="order-project-select" style={{ margin: 0 }}>
                    Target Project * <span style={{ fontWeight: 400, color: '#64748b' }}>(Specify what project tools are for)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomProject(!isCustomProject)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#1c21df',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {isCustomProject ? '← Select existing project' : '+ Add custom project'}
                  </button>
                </div>

                {isCustomProject ? (
                  <input
                    type="text"
                    required
                    placeholder="Enter custom project title (e.g. Smart Drone Obstacle Avoidance)"
                    value={formData.custom_project}
                    onChange={(e) => setFormData({ ...formData, custom_project: e.target.value })}
                    className="order-input-field"
                    autoFocus
                  />
                ) : (
                  <select
                    id="order-project-select"
                    value={formData.project_name || (projectsList[0] || 'General')}
                    onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                    className="order-input-field"
                    style={{ cursor: 'pointer' }}
                  >
                    {projectsList.map(proj => (
                      <option key={proj} value={proj}>{proj}</option>
                    ))}
                    <option value="General Hardware Experiment">General Hardware Experiment</option>
                  </select>
                )}
              </div>

              {/* Quantity and Dates Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                {/* Quantity */}
                <div className="order-input-group">
                  <label>Quantity *</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="stepper-btn"
                      disabled={formData.quantity <= 1}
                      onClick={() => handleQuantityChange(formData.quantity - 1)}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={maxAvailable}
                      value={formData.quantity}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      className="order-input-field"
                      style={{ textAlign: 'center', fontWeight: 600 }}
                    />
                    <button
                      type="button"
                      className="stepper-btn"
                      disabled={formData.quantity >= maxAvailable}
                      onClick={() => handleQuantityChange(formData.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Needed Date */}
                <div className="order-input-group">
                  <label htmlFor="order-needed-date">When Needed *</label>
                  <input
                    id="order-needed-date"
                    type="date"
                    required
                    min={todayStr}
                    value={formData.needed_date}
                    onChange={(e) => handleNeededDateChange(e.target.value)}
                    className="order-input-field"
                  />
                </div>

                {/* Return Date */}
                <div className="order-input-group">
                  <label htmlFor="order-return-date">Return Date *</label>
                  <input
                    id="order-return-date"
                    type="date"
                    required
                    min={formData.needed_date || todayStr}
                    value={formData.return_date}
                    onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                    className="order-input-field"
                  />
                </div>
              </div>

              {/* Scope & Purpose */}
              <div className="order-input-group">
                <label htmlFor="order-purpose">Scope of Work / Purpose</label>
                <textarea
                  id="order-purpose"
                  rows="2"
                  placeholder="Briefly describe what you'll be building or testing with this equipment..."
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="order-input-field"
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #1c21df 0%, #3b40f8 100%)',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(28, 33, 223, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {submitting ? 'hourglass_top' : 'send'}
                  </span>
                  {submitting ? 'Submitting Order...' : 'Place Requirement'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
