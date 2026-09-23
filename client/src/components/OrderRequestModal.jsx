import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAlert } from '../contexts/AlertContext';
import { getItemImage } from '../utils/slugify';

export default function OrderRequestModal({ isOpen, onClose, initialItem = null, onOrderSuccess }) {
  const { showError, showWarning } = useAlert();

  const [itemsList, setItemsList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [selectedItem, setSelectedItem] = useState(initialItem);
  const [isCustomProject, setIsCustomProject] = useState(false);
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
      setFormData(prev => ({ ...prev, quantity: 1 }));
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

        if (itemsRes.data && itemsRes.data.length > 0) {
          setItemsList(itemsRes.data);
          if (!selectedItem) {
            setSelectedItem(itemsRes.data[0]);
          }
        }

        if (projectsRes.data && projectsRes.data.length > 0) {
          const names = projectsRes.data.map(p => p.name).filter(Boolean);
          setProjectsList(names);
          setFormData(prev => ({
            ...prev,
            project_name: prev.project_name || names[0] || 'General'
          }));
        } else {
          const defaultProjects = ['General', 'Robotics', 'IoT & Embedded', 'Renewable Energy'];
          setProjectsList(defaultProjects);
          setFormData(prev => ({
            ...prev,
            project_name: prev.project_name || defaultProjects[0]
          }));
        }
      } catch (err) {
        console.warn('[OrderRequestModal] Error loading reference data:', err);
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

  const maxAvailable = selectedItem ? Number(selectedItem.amount) || 1 : 1;

  const handleQuantityChange = (newQty) => {
    const val = Math.max(1, Math.min(maxAvailable, Number(newQty) || 1));
    setFormData(prev => ({ ...prev, quantity: val }));
  };

  const handleNeededDateChange = (val) => {
    setFormData(prev => {
      const updated = { ...prev, needed_date: val };
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
      showWarning('Please enter your name.', 'Name Required');
      return;
    }

    if (!formData.requester_email.trim()) {
      showWarning('Please enter your email address.', 'Email Required');
      return;
    }

    const finalProjectName = isCustomProject 
      ? formData.custom_project.trim() 
      : (formData.project_name || 'General');

    if (!finalProjectName) {
      showWarning('Please specify the project.', 'Project Required');
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
      const { data, error } = await supabase
        .from('item_requests')
        .insert([requestPayload])
        .select('*, items(*)')
        .single();

      if (error) {
        console.warn('[OrderRequestModal] Supabase table insert issue, queuing locally:', error.message);
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
          
          const userOrders = JSON.parse(localStorage.getItem('cih_user_orders') || '[]');
          const filtered = userOrders.filter(o => o.id !== localRecord.id);
          filtered.unshift(localRecord);
          localStorage.setItem('cih_user_orders', JSON.stringify(filtered.slice(0, 30)));
          localStorage.setItem('cih_last_user_email', formData.requester_email.trim());
        } catch (_) {}

        setSuccessOrder(localRecord);
        if (onOrderSuccess) onOrderSuccess(localRecord);
        return;
      }

      const confirmedRecord = data || { id: 'REQ-OK', ...requestPayload, items: selectedItem };
      try {
        const userOrders = JSON.parse(localStorage.getItem('cih_user_orders') || '[]');
        const filtered = userOrders.filter(o => o.id !== confirmedRecord.id);
        filtered.unshift(confirmedRecord);
        localStorage.setItem('cih_user_orders', JSON.stringify(filtered.slice(0, 30)));
        localStorage.setItem('cih_last_user_email', formData.requester_email.trim());
      } catch (_) {}

      setSuccessOrder(confirmedRecord);
      if (onOrderSuccess) onOrderSuccess(confirmedRecord);
    } catch (err) {
      console.error('[OrderRequestModal] Submission exception:', err);
      showError('Unable to submit request. Please try again.');
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
        padding: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(6px)',
        zIndex: 1100
      }}
    >
      <div 
        className="order-request-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '92vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <style>{`
          @keyframes modalFadeIn {
            from { opacity: 0; transform: translateY(14px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          .clean-field-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .clean-field-label {
            font-size: 0.8rem;
            font-weight: 600;
            color: #475569;
            letter-spacing: 0.01em;
          }
          .clean-input {
            width: 100%;
            padding: 8px 12px;
            font-size: 0.88rem;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            background: #ffffff !important;
            color: #0f172a;
            outline: none;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
            box-sizing: border-box;
            font-family: inherit;
          }
          .clean-input:focus {
            border-color: #1c21df;
            box-shadow: 0 0 0 3px rgba(28, 33, 223, 0.1);
          }
          .clean-input::placeholder {
            color: #94a3b8;
          }
          /* Strip Chrome aggressive blue autofill background */
          .clean-input:-webkit-autofill,
          .clean-input:-webkit-autofill:hover, 
          .clean-input:-webkit-autofill:focus,
          .clean-input:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
            -webkit-text-fill-color: #0f172a !important;
            transition: background-color 5000s ease-in-out 0s;
          }
          .clean-stepper-btn {
            width: 32px;
            height: 34px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            color: #334155;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 600;
            transition: background 0.15s;
          }
          .clean-stepper-btn:hover:not(:disabled) {
            background: #e2e8f0;
          }
          .clean-stepper-btn:disabled {
            opacity: 0.35;
            cursor: not-allowed;
          }
        `}</style>

        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 id="order-modal-title" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              {successOrder ? 'Requisition Submitted' : 'Request Equipment'}
            </h2>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0 0' }}>
              {successOrder ? 'Your order reference details' : 'Specify when you need tools and for which project'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s'
            }}
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {successOrder ? (
            /* Success State */
            <div style={{ textAlign: 'center', padding: '12px 6px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: '#ecfdf5',
                color: '#059669',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
                border: '1.5px solid #a7f3d0'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>check</span>
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
                Request Sent Successfully
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.45 }}>
                Your order is on the lab admin dashboard. Once approved, the tools will be prepared for pickup.
              </p>

              <div style={{
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '14px 16px',
                textAlign: 'left',
                marginBottom: '20px',
                fontSize: '0.82rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #edf2f7' }}>
                  <span style={{ color: '#64748b' }}>Item</span>
                  <strong style={{ color: '#0f172a' }}>{selectedItem?.item_name || 'Equipment'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #edf2f7' }}>
                  <span style={{ color: '#64748b' }}>Quantity</span>
                  <strong style={{ color: '#0f172a' }}>{successOrder.quantity} {selectedItem?.store || 'pcs'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #edf2f7' }}>
                  <span style={{ color: '#64748b' }}>Project</span>
                  <strong style={{ color: '#0f172a' }}>{successOrder.project_name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Duration</span>
                  <strong style={{ color: '#0f172a' }}>{successOrder.needed_date} to {successOrder.return_date}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const email = formData.requester_email.trim();
                    onClose();
                    window.dispatchEvent(new CustomEvent('open-track-orders', { 
                      detail: { email } 
                    }));
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #1c21df',
                    background: '#eff6ff',
                    color: '#1c21df',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>receipt_long</span>
                  <span>Track Status</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#1c21df',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Order Form */
            <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Clean Equipment Summary Chip */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  {selectedItem && (
                    <img 
                      src={getItemImage(selectedItem) || '/IMAGES/placeholder.png'} 
                      alt=""
                      style={{
                        width: '34px',
                        height: '34px',
                        objectFit: 'contain',
                        borderRadius: '6px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        flexShrink: 0
                      }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedItem?.item_name || 'Select Tool'}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 500 }}>
                      {selectedItem?.amount || 0} {selectedItem?.store || 'pcs'} in stock
                    </div>
                  </div>
                </div>

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
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      cursor: 'pointer',
                      maxWidth: '140px'
                    }}
                    aria-label="Change equipment"
                  >
                    {itemsList.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.item_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Row 1: Requester Name & Email (2 columns) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="clean-field-group">
                  <label className="clean-field-label" htmlFor="order-req-name">Full Name *</label>
                  <input
                    id="order-req-name"
                    name="full_name"
                    type="text"
                    required
                    placeholder="John Doe"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    value={formData.requester_name}
                    onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
                    className="clean-input"
                  />
                </div>

                <div className="clean-field-group">
                  <label className="clean-field-label" htmlFor="order-req-email">Email Address *</label>
                  <input
                    id="order-req-email"
                    name="contact_email"
                    type="email"
                    required
                    placeholder="john.doe@example.com"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    value={formData.requester_email}
                    onChange={(e) => setFormData({ ...formData, requester_email: e.target.value })}
                    className="clean-input"
                  />
                </div>
              </div>

              {/* Row 2: Phone & Project (2 columns) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="clean-field-group">
                  <label className="clean-field-label" htmlFor="order-req-phone">Phone / WhatsApp</label>
                  <input
                    id="order-req-phone"
                    name="contact_phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    autoComplete="off"
                    value={formData.requester_phone}
                    onChange={(e) => setFormData({ ...formData, requester_phone: e.target.value })}
                    className="clean-input"
                  />
                </div>

                <div className="clean-field-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="clean-field-label" htmlFor="order-req-project">Project *</label>
                    <button
                      type="button"
                      onClick={() => setIsCustomProject(!isCustomProject)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#1c21df',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      {isCustomProject ? 'Select existing' : '+ Custom'}
                    </button>
                  </div>
                  {isCustomProject ? (
                    <input
                      id="order-req-project"
                      type="text"
                      required
                      placeholder="e.g. Robotics Project"
                      autoComplete="off"
                      value={formData.custom_project}
                      onChange={(e) => setFormData({ ...formData, custom_project: e.target.value })}
                      className="clean-input"
                      autoFocus
                    />
                  ) : (
                    <select
                      id="order-req-project"
                      value={formData.project_name || (projectsList[0] || 'General')}
                      onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                      className="clean-input"
                      style={{ cursor: 'pointer' }}
                    >
                      {projectsList.map(proj => (
                        <option key={proj} value={proj}>{proj}</option>
                      ))}
                      <option value="General Hardware Experiment">General Experiment</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Row 3: Quantity, When Needed, Return Date (3 columns) */}
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr', gap: '10px' }}>
                <div className="clean-field-group">
                  <label className="clean-field-label">Quantity *</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      className="clean-stepper-btn"
                      disabled={formData.quantity <= 1}
                      onClick={() => handleQuantityChange(formData.quantity - 1)}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={maxAvailable}
                      value={formData.quantity}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      className="clean-input"
                      style={{ textAlign: 'center', fontWeight: 600, padding: '7px 2px' }}
                    />
                    <button
                      type="button"
                      className="clean-stepper-btn"
                      disabled={formData.quantity >= maxAvailable}
                      onClick={() => handleQuantityChange(formData.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="clean-field-group">
                  <label className="clean-field-label" htmlFor="order-date-needed">When Needed *</label>
                  <input
                    id="order-date-needed"
                    type="date"
                    required
                    min={todayStr}
                    value={formData.needed_date}
                    onChange={(e) => handleNeededDateChange(e.target.value)}
                    className="clean-input"
                  />
                </div>

                <div className="clean-field-group">
                  <label className="clean-field-label" htmlFor="order-date-return">Return Date *</label>
                  <input
                    id="order-date-return"
                    type="date"
                    required
                    min={formData.needed_date || todayStr}
                    value={formData.return_date}
                    onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                    className="clean-input"
                  />
                </div>
              </div>

              {/* Row 4: Purpose */}
              <div className="clean-field-group">
                <label className="clean-field-label" htmlFor="order-purpose">Purpose (Optional)</label>
                <textarea
                  id="order-purpose"
                  rows="2"
                  placeholder="Brief description of what you will use this equipment for..."
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="clean-input"
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#1c21df',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(28, 33, 223, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    {submitting ? 'hourglass_top' : 'send'}
                  </span>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#64748b',
                    fontWeight: 600,
                    fontSize: '0.88rem',
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
