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
      // Load deduplicated cached orders stored in localStorage for this browser
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
        padding: '12px',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
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
          maxWidth: '540px',
          maxHeight: '90dvh',
          height: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: '6px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'trackModalIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          touchAction: 'pan-y'
        }}
      >
        <style>{`
          @keyframes trackModalIn {
            from { opacity: 0; transform: translateY(14px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes pulsePending {
            0% { transform: scale(0.95); opacity: 0.8; }
            50% { transform: scale(1.3); opacity: 1; }
            100% { transform: scale(0.95); opacity: 0.8; }
          }
          .pulse-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background-color: #f59e0b;
            display: inline-block;
            animation: pulsePending 2s infinite ease-in-out;
          }
          .track-request-row {
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            background: #ffffff;
            transition: all 0.15s ease;
            overflow: hidden;
          }
          .track-request-row:hover {
            border-color: #cbd5e1;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
          }
          .track-request-row.is-expanded {
            border-color: #1c21df;
            box-shadow: 0 2px 10px rgba(28, 33, 223, 0.08);
          }
          .track-filter-tab {
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 0.78rem;
            font-weight: 600;
            border: 1px solid transparent;
            background: none;
            color: #64748b;
            cursor: pointer;
            display: inline-flex;
            alignItems: center;
            gap: 6px;
            transition: all 0.15s ease;
          }
          .track-filter-tab:hover {
            color: #0f172a;
            background: #f1f5f9;
          }
          .track-filter-tab.active {
            background: #ffffff;
            color: #1c21df;
            border-color: #e2e8f0;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          }
          .track-badge-count {
            padding: 1px 6px;
            border-radius: 6px;
            font-size: 0.7rem;
            font-weight: 700;
          }
        `}</style>

        {/* Modal Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: '#eff6ff',
              color: '#1c21df',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>receipt_long</span>
            </div>
            <div>
              <h2 id="track-modal-title" style={{ fontSize: '1.02rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                My Equipment Requests
              </h2>
              <span style={{ fontSize: '0.73rem', color: '#64748b' }}>
                Track requisition approvals and pickup notifications
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
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* Search by Email Bar */}
        <div style={{ padding: '12px 18px 10px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span className="material-symbols-outlined" style={{
                position: 'absolute',
                left: '10px',
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
                placeholder="Enter your email address"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.85rem',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: '#1c21df',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                {loading ? 'hourglass_top' : 'search'}
              </span>
              <span>Find</span>
            </button>
          </form>
        </div>

        {/* Organized Filter Tabs Bar */}
        {requests.length > 0 && (
          <div style={{
            padding: '8px 18px',
            background: '#f1f5f9',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button
                type="button"
                className={`track-filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setActiveFilter('all')}
              >
                <span>All</span>
                <span className="track-badge-count" style={{ background: activeFilter === 'all' ? '#eff6ff' : '#e2e8f0', color: activeFilter === 'all' ? '#1c21df' : '#64748b' }}>
                  {counts.all}
                </span>
              </button>

              <button
                type="button"
                className={`track-filter-tab ${activeFilter === 'pending' ? 'active' : ''}`}
                onClick={() => setActiveFilter('pending')}
              >
                <span>Pending</span>
                <span className="track-badge-count" style={{ background: '#fffbeb', color: '#b45309' }}>
                  {counts.pending}
                </span>
              </button>

              <button
                type="button"
                className={`track-filter-tab ${activeFilter === 'approved' ? 'active' : ''}`}
                onClick={() => setActiveFilter('approved')}
              >
                <span>Ready / Approved</span>
                <span className="track-badge-count" style={{ background: '#eff2fe', color: '#1c21df' }}>
                  {counts.approved}
                </span>
              </button>

              {counts.declined > 0 && (
                <button
                  type="button"
                  className={`track-filter-tab ${activeFilter === 'declined' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('declined')}
                >
                  <span>Declined</span>
                  <span className="track-badge-count" style={{ background: '#fef2f2', color: '#b91c1c' }}>
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
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 6px',
                borderRadius: '6px'
              }}
              title="Refresh status from live lab system"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px', animation: loading ? 'spin 1s linear infinite' : 'none' }}>
                refresh
              </span>
              <span>Refresh</span>
            </button>
          </div>
        )}

        {/* Requests List Area */}
        <div style={{
          padding: '14px 18px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}>
          {loading && requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '32px', animation: 'spin 1s linear infinite', color: '#1c21df' }}>
                progress_activity
              </span>
              <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>Retrieving your requests...</div>
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
                    className={`track-request-row ${isExpanded ? 'is-expanded' : ''}`}
                  >
                    {/* Header Row (Click to expand/collapse) */}
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
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '11px 12px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        {itemImg ? (
                          <img 
                            src={itemImg} 
                            alt="" 
                            style={{
                              width: '38px',
                              height: '38px',
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
                            width: '38px',
                            height: '38px',
                            borderRadius: '6px',
                            background: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#94a3b8',
                            flexShrink: 0
                          }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>build</span>
                          </div>
                        )}

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <h4 style={{
                              margin: 0,
                              fontSize: '0.88rem',
                              fontWeight: 700,
                              color: '#0f172a',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {req.items?.item_name || req.item_name || 'Equipment Item'}
                            </h4>
                            <span style={{
                              fontSize: '0.68rem',
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              color: '#64748b',
                              background: '#f1f5f9',
                              padding: '1px 5px',
                              borderRadius: '4px'
                            }}>
                              {shortCode}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                            <span>Qty: <strong>{req.quantity} {req.items?.store || 'unit(s)'}</strong></span>
                            <span>•</span>
                            <span>Project: <strong>{req.project_name || 'General'}</strong></span>
                            <span>•</span>
                            <span>Needed: <strong>{req.needed_date || '—'}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Right side: Status badge + Chevron */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 9px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: isPending ? '#fffbeb' : (isApproved ? '#eff2fe' : '#fef2f2'),
                          color: isPending ? '#b45309' : (isApproved ? '#1c21df' : '#b91c1c'),
                          border: `1px solid ${isPending ? '#fef3c7' : (isApproved ? '#bfdbfe' : '#fecaca')}`
                        }}>
                          {isPending && <span className="pulse-dot" />}
                          {isApproved && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified</span>}
                          {isDeclined && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>cancel</span>}
                          <span>{isPending ? 'Pending Review' : (isApproved ? 'Ready for Pickup' : 'Declined')}</span>
                        </span>
                        <span 
                          className="material-symbols-outlined"
                          style={{
                            fontSize: '18px',
                            color: '#94a3b8',
                            transition: 'transform 0.2s ease',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                          }}
                        >
                          expand_more
                        </span>
                      </div>
                    </div>

                    {/* Collapsible Details Body */}
                    {isExpanded && (
                      <div style={{
                        padding: '12px 14px 14px 14px',
                        borderTop: '1px solid #f1f5f9',
                        background: '#fafbfc',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        fontSize: '0.78rem'
                      }}>
                        {/* Reference Bar */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          background: '#f8fafc',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          fontSize: '0.73rem'
                        }}>
                          <span style={{ color: '#64748b' }}>
                            Order Reference: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{shortCode}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(req.id, shortCode);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#1c21df',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: 0
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                              {isCopied ? 'check' : 'content_copy'}
                            </span>
                            <span>{isCopied ? 'Copied' : 'Copy ID'}</span>
                          </button>
                        </div>

                        {/* Metadata Grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                          gap: '8px',
                          background: '#ffffff',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Project</span>
                            <strong style={{ color: '#1c21df' }}>{req.project_name || 'General'}</strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Required Date</span>
                            <strong style={{ color: '#0f172a' }}>{formatFriendlyDate(req.needed_date)}</strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Return Schedule</span>
                            <strong style={{ color: '#0f172a' }}>
                              {req.return_date ? formatFriendlyDate(req.return_date) : 'Consumable / Non-returnable'}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Requested On</span>
                            <span style={{ color: '#475569' }}>{formatFriendlyDate(req.created_at)}</span>
                          </div>

                          {req.purpose && (
                            <div style={{ gridColumn: '1 / -1', marginTop: '4px', borderTop: '1px dashed #e2e8f0', paddingTop: '6px' }}>
                              <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Purpose</span>
                              <span style={{ color: '#334155', fontStyle: 'italic' }}>"{req.purpose}"</span>
                            </div>
                          )}
                        </div>

                        {/* Action Box based on Status */}
                        {isPending && (
                          <div style={{
                            padding: '10px 12px',
                            background: '#fffbeb',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            color: '#92400e',
                            border: '1px solid #fef3c7',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}>
                            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#f59e0b' }}>hourglass_top</span>
                              <span>Under Review by Lab Team</span>
                            </div>
                            <div style={{ color: '#78350f', paddingLeft: '22px' }}>
                              Your requisition is in the review queue. When approved by the administrator, pickup instructions will appear here automatically.
                            </div>
                          </div>
                        )}

                        {isApproved && (
                          <div style={{
                            padding: '10px 12px',
                            background: '#eff2fe',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            color: '#1c21df',
                            border: '1px solid #bfdbfe',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}>
                            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>verified</span>
                              <span>Ready for Pickup at the CIH Innovation Lab!</span>
                            </div>
                            <div style={{ color: '#1e3a8a', paddingLeft: '22px', lineHeight: 1.4 }}>
                              Please present reference code <strong>{shortCode}</strong> to the lab hardware attendant.
                              {req.admin_notes && (
                                <div style={{ marginTop: '6px', padding: '6px 8px', background: '#ffffff', borderRadius: '4px', border: '1px solid #dbeafe', color: '#1d4ed8' }}>
                                  <strong>Admin Instructions:</strong> {req.admin_notes}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {isDeclined && (
                          <div style={{
                            padding: '10px 12px',
                            background: '#fef2f2',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            color: '#991b1b',
                            border: '1px solid #fecaca',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}>
                            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#ef4444' }}>cancel</span>
                              <span>Requisition Declined</span>
                            </div>
                            <div style={{ color: '#7f1d1d', paddingLeft: '22px' }}>
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
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '6px',
                background: '#f1f5f9',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px',
                color: '#94a3b8'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                  {activeFilter === 'all' ? 'search_off' : 'filter_list_off'}
                </span>
              </div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.92rem', color: '#0f172a' }}>
                {activeFilter === 'all' ? 'No Requisitions Found' : `No ${activeFilter} requests`}
              </h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                {activeFilter === 'all' 
                  ? <>No equipment orders match <strong>{emailInput}</strong>.</>
                  : <>You have no requests matching the "{activeFilter}" filter.</>}
              </p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '6px',
                background: '#f1f5f9',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px',
                color: '#94a3b8'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>inbox</span>
              </div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.92rem', color: '#0f172a' }}>Track Your Requisitions</h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                Enter your email address above to view live approval and collection status.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            {lastRefreshed ? `Synced at ${lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'CIH Requisition Portal'}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 18px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
