import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { getItemImage } from '../utils/slugify';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { 
  deduplicateRequisitions, 
  getShortRequestId, 
  formatFriendlyDate 
} from '../utils/requisitionUtils';

export default function TrackRequestsModal({ isOpen, onClose, initialEmail = '' }) {
  useBodyScrollLock(isOpen);
  const [emailInput, setEmailInput] = useState(initialEmail);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchUserRequests = useCallback(async (email) => {
    if (!email || !email.trim()) return;
    const cleanEmail = email.trim().toLowerCase();
    setLoading(true);
    setHasSearched(true);

    let remoteList = [];
    try {
      const { data, error } = await supabase
        .from('item_requests')
        .select('*, items(*)')
        .ilike('requester_email', cleanEmail)
        .order('created_at', { ascending: false });

      if (!error && data) {
        remoteList = data;
      }
    } catch (err) {
      console.warn('[TrackRequests] Remote fetch notice:', err);
    }

    // Zero-duplicate unified processing with localStorage pruning
    const cleanList = deduplicateRequisitions(remoteList, cleanEmail);
    setRequests(cleanList);
    setLoading(false);
    setLastRefreshed(new Date());

    try {
      localStorage.setItem('cih_last_user_email', cleanEmail);
    } catch (_) {}
  }, []);

  // Load last used email and cached local requests on open
  useEffect(() => {
    if (!isOpen) return;

    let savedEmail = initialEmail;
    try {
      if (!savedEmail) {
        savedEmail = localStorage.getItem('cih_last_user_email') || '';
      }
    } catch (_) {}

    if (savedEmail) {
      setEmailInput(savedEmail);
      fetchUserRequests(savedEmail);
    } else {
      const cleanLocal = deduplicateRequisitions([], '');
      if (cleanLocal.length > 0) {
        setRequests(cleanLocal);
        setHasSearched(true);
      } else {
        setRequests([]);
        setHasSearched(false);
      }
    }
  }, [isOpen, initialEmail, fetchUserRequests]);

  // Real-time synchronization when modal is open
  useEffect(() => {
    if (!isOpen || !emailInput.trim()) return;

    const channel = supabase
      .channel(`realtime:user_track_${emailInput.trim().toLowerCase()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_requests' },
        () => {
          fetchUserRequests(emailInput);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, emailInput, fetchUserRequests]);

  // ESC key handler
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

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (emailInput.trim()) {
      fetchUserRequests(emailInput);
    }
  };

  const handleCopy = (id, text) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Grouped status counts
  const counts = useMemo(() => {
    const p = requests.filter(r => (r.status || 'pending').toLowerCase() === 'pending').length;
    const a = requests.filter(r => (r.status || '').toLowerCase() === 'approved').length;
    const d = requests.filter(r => (r.status || '').toLowerCase() === 'declined').length;
    return { all: requests.length, pending: p, approved: a, declined: d };
  }, [requests]);

  // Filtered requests based on active tab
  const filteredRequests = useMemo(() => {
    if (activeFilter === 'all') return requests;
    return requests.filter(r => (r.status || 'pending').toLowerCase() === activeFilter);
  }, [requests, activeFilter]);

  if (!isOpen) return null;

  return (
    <div 
      className="side-modal-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="track-modal-title"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1200,
        position: 'fixed',
        inset: 0,
        touchAction: 'pan-y',
        overscrollBehavior: 'contain'
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '92dvh',
          height: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: '6px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'trackModalIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          touchAction: 'pan-y'
        }}
      >
        <style>{`
          @keyframes trackModalIn {
            from { opacity: 0; transform: translateY(12px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes pulseDotAnim {
            0% { transform: scale(0.95); opacity: 0.8; }
            50% { transform: scale(1.35); opacity: 1; }
            100% { transform: scale(0.95); opacity: 0.8; }
          }
          .pulse-dot-amber {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background-color: #ff5421;
            display: inline-block;
            animation: pulseDotAnim 2s infinite ease-in-out;
            flex-shrink: 0;
          }
          .track-request-card {
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            background: #ffffff;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
            overflow: hidden;
          }
          .track-request-card:hover {
            border-color: #cbd5e1;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.04);
          }
          .track-request-card.is-expanded {
            border-color: #1c21df;
            box-shadow: 0 4px 14px rgba(28, 33, 223, 0.09);
          }
          .track-filter-scroll-bar {
            display: flex;
            gap: 6px;
            align-items: center;
            overflow-x: auto;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
          }
          .track-filter-scroll-bar::-webkit-scrollbar {
            display: none;
          }
          .track-filter-pill {
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 0.78rem;
            font-weight: 600;
            border: 1px solid transparent;
            background: transparent;
            color: #64748b;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
            transition: all 0.15s ease;
            flex-shrink: 0;
          }
          .track-filter-pill:hover {
            color: #0f172a;
            background: #e2e8f0;
          }
          .track-filter-pill.active {
            background: #ffffff;
            color: #1c21df;
            border-color: #cbd5e1;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
          }
          .track-meta-chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 7px;
            border-radius: 6px;
            background: #f1f5f9;
            color: #475569;
            font-size: 0.73rem;
            font-weight: 500;
          }
          .track-stepper-node {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.72rem;
            font-weight: 600;
          }
          .track-card-header-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }
          .track-card-status-cluster {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
          }
          .track-card-chips-strip {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            padding-left: 54px;
          }
          @media (max-width: 480px) {
            .track-card-chips-strip {
              padding-left: 0;
            }
          }
          @media (max-width: 420px) {
            .track-card-header-row {
              flex-direction: column;
              align-items: stretch;
              gap: 8px;
            }
            .track-card-status-cluster {
              justify-content: space-between;
              width: 100%;
              padding-top: 6px;
              border-top: 1px dashed #f1f5f9;
            }
          }
        `}</style>

        {/* Modal Top Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          background: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '6px',
              background: '#eff2fe',
              color: '#1c21df',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>receipt_long</span>
            </div>
            <div>
              <h2 id="track-modal-title" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                My Equipment Requests
              </h2>
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                Track requisition approval status & hardware pickup notifications
              </span>
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
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s ease'
            }}
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* Email Lookup Bar */}
        <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span className="material-symbols-outlined" style={{
                position: 'absolute',
                left: '11px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '18px',
                color: '#94a3b8'
              }}>
                mail
              </span>
              <input 
                type="email"
                required
                placeholder="Enter email address used for requisition"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.86rem',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '9px 18px',
                borderRadius: '6px',
                border: 'none',
                background: '#1c21df',
                color: '#ffffff',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(28, 33, 223, 0.25)',
                whiteSpace: 'nowrap'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                {loading ? 'hourglass_top' : 'search'}
              </span>
              <span>Find</span>
            </button>
          </form>
        </div>

        {/* Filter Tabs Navigation Bar */}
        {requests.length > 0 && (
          <div style={{
            padding: '8px 20px',
            background: '#f1f5f9',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}>
            <div className="track-filter-scroll-bar">
              <button
                type="button"
                className={`track-filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setActiveFilter('all')}
              >
                <span>All Orders</span>
                <span style={{ 
                  background: activeFilter === 'all' ? '#eff2fe' : '#e2e8f0', 
                  color: activeFilter === 'all' ? '#1c21df' : '#475569',
                  padding: '1px 6px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: 700
                }}>
                  {counts.all}
                </span>
              </button>

              <button
                type="button"
                className={`track-filter-pill ${activeFilter === 'pending' ? 'active' : ''}`}
                onClick={() => setActiveFilter('pending')}
              >
                <span>In Review</span>
                <span style={{ 
                  background: '#fff5f2', 
                  color: '#ff5421',
                  padding: '1px 6px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: 700
                }}>
                  {counts.pending}
                </span>
              </button>

              <button
                type="button"
                className={`track-filter-pill ${activeFilter === 'approved' ? 'active' : ''}`}
                onClick={() => setActiveFilter('approved')}
              >
                <span>Ready for Pickup</span>
                <span style={{ 
                  background: '#eff2fe', 
                  color: '#1c21df',
                  padding: '1px 6px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: 700
                }}>
                  {counts.approved}
                </span>
              </button>

              {counts.declined > 0 && (
                <button
                  type="button"
                  className={`track-filter-pill ${activeFilter === 'declined' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('declined')}
                >
                  <span>Declined</span>
                  <span style={{ 
                    background: '#fef2f2', 
                    color: '#b91c1c',
                    padding: '1px 6px',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: 700
                  }}>
                    {counts.declined}
                  </span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => fetchUserRequests(emailInput)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 6px',
                borderRadius: '6px',
                flexShrink: 0
              }}
              title="Refresh status from live lab system"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px', animation: loading ? 'spin 1s linear infinite' : 'none' }}>
                refresh
              </span>
              <span>Refresh</span>
            </button>
          </div>
        )}

        {/* Requests List Area */}
        <div style={{
          padding: '16px 20px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}>
          {loading && requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748b' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '34px', animation: 'spin 1s linear infinite', color: '#1c21df' }}>
                progress_activity
              </span>
              <div style={{ marginTop: '10px', fontSize: '0.88rem' }}>Loading your requisitions...</div>
            </div>
          ) : filteredRequests.length > 0 ? (
            <>
              {filteredRequests.map((req) => {
                const status = (req.status || 'pending').toLowerCase();
                const isPending = status === 'pending';
                const isApproved = status === 'approved';
                const isDeclined = status === 'declined';
                const itemImg = getItemImage(req.items);
                const isExpanded = expandedId === req.id;
                const shortCode = getShortRequestId(req);
                const isCopied = copiedId === req.id;

                return (
                  <div 
                    key={req.id} 
                    className={`track-request-card ${isExpanded ? 'is-expanded' : ''}`}
                  >
                    {/* Clickable Header Container */}
                    <div
                      onClick={() => setExpandedId(prev => prev === req.id ? null : req.id)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setExpandedId(prev => prev === req.id ? null : req.id);
                        }
                      }}
                      style={{
                        padding: '13px 14px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      {/* Top Row: Thumbnail + Item Name + Status Badge + Chevron */}
                      <div className="track-card-header-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                          {itemImg ? (
                            <img 
                              src={itemImg} 
                              alt="" 
                              style={{
                                width: '42px',
                                height: '42px',
                                objectFit: 'contain',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                background: '#ffffff',
                                flexShrink: 0
                              }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <div style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '6px',
                              background: '#f1f5f9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#94a3b8',
                              flexShrink: 0,
                              border: '1px solid #e2e8f0'
                            }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>build</span>
                            </div>
                          )}

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <h3 style={{
                                margin: 0,
                                fontSize: '0.92rem',
                                fontWeight: 700,
                                color: '#0f172a',
                                lineHeight: 1.3
                              }}>
                                {req.items?.item_name || req.item_name || 'Equipment Item'}
                              </h3>
                              <span style={{
                                fontSize: '0.68rem',
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                color: '#475569',
                                background: '#f1f5f9',
                                border: '1px solid #e2e8f0',
                                padding: '1px 6px',
                                borderRadius: '6px'
                              }}>
                                {shortCode}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge & Expand Chevron */}
                        <div className="track-card-status-cluster">
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 9px',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: isPending ? '#fff5f2' : (isApproved ? '#eff2fe' : '#fef2f2'),
                            color: isPending ? '#ff5421' : (isApproved ? '#1c21df' : '#b91c1c'),
                            border: `1px solid ${isPending ? '#ffedd5' : (isApproved ? '#bfdbfe' : '#fecaca')}`,
                            whiteSpace: 'nowrap'
                          }}>
                            {isPending && <span className="pulse-dot-amber" />}
                            {isApproved && <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified</span>}
                            {isDeclined && <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>cancel</span>}
                            <span>{isPending ? 'Pending Review' : (isApproved ? 'Ready for Pickup' : 'Declined')}</span>
                          </span>

                          <span 
                            className="material-symbols-outlined"
                            style={{
                              fontSize: '20px',
                              color: '#94a3b8',
                              transition: 'transform 0.2s ease',
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                            }}
                          >
                            expand_more
                          </span>
                        </div>
                      </div>

                      {/* Bottom Row of Closed Card: Metadata Badges */}
                      <div className="track-card-chips-strip">
                        <span className="track-meta-chip">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#1c21df' }}>inventory_2</span>
                          <span><strong>{req.quantity}</strong> {req.items?.store || 'unit(s)'}</span>
                        </span>
                        <span className="track-meta-chip">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#64748b' }}>folder</span>
                          <span>{req.project_name || 'General'}</span>
                        </span>
                        <span className="track-meta-chip">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#ff5421' }}>calendar_month</span>
                          <span>Needed: {formatFriendlyDate(req.needed_date)}</span>
                        </span>
                        {req.return_date && (
                          <span className="track-meta-chip">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#1c21df' }}>event_repeat</span>
                            <span>Return: {formatFriendlyDate(req.return_date)}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Collapsible Details Body */}
                    {isExpanded && (
                      <div style={{
                        padding: '14px 16px 16px 16px',
                        borderTop: '1px solid #f1f5f9',
                        background: '#fafbfc',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        fontSize: '0.8rem'
                      }}>
                        {/* Visual Progress Stepper */}
                        <div style={{
                          padding: '10px 14px',
                          background: '#ffffff',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px'
                        }}>
                          <div className="track-stepper-node" style={{ color: '#1c21df' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                            <span>1. Requested</span>
                          </div>
                          <span style={{ height: '1px', flex: 1, background: '#cbd5e1' }} />
                          <div className="track-stepper-node" style={{ color: isDeclined ? '#ef4444' : (isApproved ? '#1c21df' : '#ff5421') }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                              {isDeclined ? 'cancel' : (isApproved ? 'check_circle' : 'hourglass_top')}
                            </span>
                            <span>2. {isDeclined ? 'Declined' : 'Admin Review'}</span>
                          </div>
                          <span style={{ height: '1px', flex: 1, background: isApproved ? '#1c21df' : '#cbd5e1' }} />
                          <div className="track-stepper-node" style={{ color: isApproved ? '#1c21df' : '#94a3b8' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                              {isApproved ? 'verified' : 'schedule'}
                            </span>
                            <span>3. Collection</span>
                          </div>
                        </div>

                        {/* Order Reference Strip */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: '#ffffff',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <span style={{ color: '#64748b' }}>
                            Official Order Reference: <strong style={{ color: '#0f172a', fontFamily: 'monospace', fontSize: '0.86rem' }}>{shortCode}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(req.id, shortCode);
                            }}
                            style={{
                              background: '#eff2fe',
                              border: '1px solid #bfdbfe',
                              color: '#1c21df',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '0.74rem'
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                              {isCopied ? 'check' : 'content_copy'}
                            </span>
                            <span>{isCopied ? 'Copied' : 'Copy ID'}</span>
                          </button>
                        </div>

                        {/* Structured Details Cards */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
                          gap: '8px',
                          background: '#ffffff',
                          padding: '12px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>Project</span>
                            <strong style={{ color: '#1c21df' }}>{req.project_name || 'General'}</strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>Needed Date</span>
                            <strong style={{ color: '#0f172a' }}>{formatFriendlyDate(req.needed_date)}</strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>Expected Return</span>
                            <strong style={{ color: '#0f172a' }}>
                              {req.return_date ? formatFriendlyDate(req.return_date) : 'Consumable / Permanent'}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>Submitted On</span>
                            <span style={{ color: '#475569' }}>{formatFriendlyDate(req.created_at)}</span>
                          </div>

                          {req.purpose && (
                            <div style={{ gridColumn: '1 / -1', marginTop: '6px', borderTop: '1px dashed #e2e8f0', paddingTop: '8px' }}>
                              <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>Intended Purpose</span>
                              <span style={{ color: '#334155', fontStyle: 'italic' }}>"{req.purpose}"</span>
                            </div>
                          )}
                        </div>

                        {/* Status Action Callout Box */}
                        {isPending && (
                          <div style={{
                            padding: '12px 14px',
                            background: '#fff5f2',
                            borderRadius: '6px',
                            color: '#c2410c',
                            border: '1px solid #ffedd5',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}>
                            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ff5421' }}>schedule</span>
                              <span>Under Review by Lab Management</span>
                            </div>
                            <div style={{ color: '#9a3412', paddingLeft: '24px', fontSize: '0.76rem', lineHeight: 1.4 }}>
                              Your requisition is in the active approval queue. Once approved by a lab administrator, your pickup confirmation and lab desk location will appear here automatically.
                            </div>
                          </div>
                        )}

                        {isApproved && (
                          <div style={{
                            padding: '12px 14px',
                            background: '#eff2fe',
                            borderRadius: '6px',
                            color: '#1c21df',
                            border: '1px solid #bfdbfe',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}>
                            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>verified</span>
                              <span>Ready for Pickup at the CIH Innovation Lab!</span>
                            </div>
                            <div style={{ color: '#1e3a8a', paddingLeft: '24px', fontSize: '0.76rem', lineHeight: 1.4 }}>
                              Please present reference code <strong>{shortCode}</strong> to the lab hardware attendant.
                              {req.admin_notes && (
                                <div style={{ marginTop: '8px', padding: '8px 10px', background: '#ffffff', borderRadius: '6px', border: '1px solid #dbeafe', color: '#1c21df' }}>
                                  <strong>Admin Instructions:</strong> {req.admin_notes}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {isDeclined && (
                          <div style={{
                            padding: '12px 14px',
                            background: '#fef2f2',
                            borderRadius: '6px',
                            color: '#991b1b',
                            border: '1px solid #fecaca',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}>
                            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ef4444' }}>cancel</span>
                              <span>Requisition Declined</span>
                            </div>
                            <div style={{ color: '#7f1d1d', paddingLeft: '24px', fontSize: '0.76rem' }}>
                              {req.admin_notes ? (
                                <span><strong>Reason:</strong> {req.admin_notes}</span>
                              ) : (
                                <span>The requested equipment is currently reserved or unavailable for external requisition.</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : hasSearched ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '6px',
                background: '#f1f5f9',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
                color: '#94a3b8'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                  {activeFilter === 'all' ? 'search_off' : 'filter_list_off'}
                </span>
              </div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.94rem', color: '#0f172a' }}>
                {activeFilter === 'all' ? 'No Requisitions Found' : `No ${activeFilter} requests`}
              </h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                {activeFilter === 'all' 
                  ? <>No equipment orders match <strong>{emailInput}</strong>.</>
                  : <>You have no requests currently matching the "{activeFilter}" filter.</>}
              </p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '6px',
                background: '#f1f5f9',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
                color: '#94a3b8'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>inbox</span>
              </div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.94rem', color: '#0f172a' }}>Track Your Requisitions</h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                Enter your email address above to view live approval and collection status.
              </p>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div style={{ 
          padding: '12px 20px', 
          borderTop: '1px solid #f1f5f9', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexShrink: 0,
          background: '#ffffff'
        }}>
          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
            {lastRefreshed ? `Synced at ${lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'CIH Requisition Portal'}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
