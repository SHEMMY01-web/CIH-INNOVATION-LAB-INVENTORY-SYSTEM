import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getItemImage } from '../utils/slugify';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';

export default function TrackRequestsModal({ isOpen, onClose, initialEmail = '' }) {
  useBodyScrollLock(isOpen);
  const [emailInput, setEmailInput] = useState(initialEmail);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

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
      // Load any requests stored in localStorage for this browser
      try {
        const localOrders = JSON.parse(localStorage.getItem('cih_user_orders') || '[]');
        if (localOrders.length > 0) {
          setRequests(localOrders);
          setHasSearched(true);
        } else {
          setRequests([]);
          setHasSearched(false);
        }
      } catch (_) {}
    }
  }, [isOpen, initialEmail]);

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

  const fetchUserRequests = useCallback(async (email) => {
    if (!email || !email.trim()) return;
    const cleanEmail = email.trim().toLowerCase();
    setLoading(true);
    setHasSearched(true);

    let remoteList = [];
    try {
      // 1. Fetch remote requests matching this email
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

    // 2. Merge with locally saved requests if offline or matching
    try {
      const localQueue = JSON.parse(localStorage.getItem('cih_pending_requisitions') || '[]');
      const userOrders = JSON.parse(localStorage.getItem('cih_user_orders') || '[]');
      
      const remoteIds = new Set(remoteList.map(r => r.id));
      const matchingLocal = [...localQueue, ...userOrders].filter(r => 
        !remoteIds.has(r.id) && (r.requester_email || r.email || '').toLowerCase() === cleanEmail
      );

      setRequests([...remoteList, ...matchingLocal]);
    } catch (_) {
      setRequests(remoteList);
    } finally {
      setLoading(false);
      try {
        localStorage.setItem('cih_last_user_email', cleanEmail);
      } catch (_) {}
    }
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (emailInput.trim()) {
      fetchUserRequests(emailInput);
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
          maxWidth: '520px',
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
            box-shadow: 0 2px 8px rgba(28, 33, 223, 0.08);
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
            <h2 id="track-modal-title" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              My Equipment Requests
            </h2>
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
                placeholder="Enter email address"
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

        {/* Requests List Area */}
        <div style={{
          padding: '14px 18px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748b' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '32px', animation: 'spin 1s linear infinite' }}>
                progress_activity
              </span>
              <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>Loading your requests...</div>
            </div>
          ) : requests.length > 0 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>
                  Showing {requests.length} {requests.length === 1 ? 'request' : 'requests'}
                </span>
                <button
                  type="button"
                  onClick={() => fetchUserRequests(emailInput)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#1c21df',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0
                  }}
                  title="Refresh latest status from lab database"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>refresh</span>
                  Refresh Status
                </button>
              </div>

              {requests.map((req) => {
                const status = (req.status || 'pending').toLowerCase();
                const isPending = status === 'pending';
                const isApproved = status === 'approved';
                const isDeclined = status === 'declined';
                const itemImg = getItemImage(req.items);
                const isExpanded = expandedId === req.id;

                return (
                  <div 
                    key={req.id} 
                    className={`track-request-row ${isExpanded ? 'is-expanded' : ''}`}
                  >
                    {/* Compact Summary Header (Click to expand/collapse) */}
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
                        padding: '10px 12px',
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
                              width: '34px',
                              height: '34px',
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
                            width: '34px',
                            height: '34px',
                            borderRadius: '6px',
                            background: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#94a3b8',
                            flexShrink: 0
                          }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>build</span>
                          </div>
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h4 style={{
                            margin: 0,
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {req.items?.item_name || req.item_name || 'Equipment'}
                          </h4>
                          <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span>Qty: <strong>{req.quantity} {req.items?.store || 'pcs'}</strong></span>
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
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          background: isPending ? '#fffbeb' : (isApproved ? '#eff2fe' : '#fef2f2'),
                          color: isPending ? '#b45309' : (isApproved ? '#1c21df' : '#b91c1c'),
                          border: `1px solid ${isPending ? '#fef3c7' : (isApproved ? '#bfdbfe' : '#fecaca')}`
                        }}>
                          {isPending && <span className="pulse-dot" />}
                          {isApproved && <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check_circle</span>}
                          {isDeclined && <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>cancel</span>}
                          <span>{isPending ? 'Pending' : (isApproved ? 'Approved' : 'Declined')}</span>
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
                        padding: '10px 12px 12px 12px',
                        borderTop: '1px solid #f1f5f9',
                        background: '#fafbfc',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        fontSize: '0.78rem'
                      }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                          gap: '8px',
                          background: '#ffffff',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Project</span>
                            <strong style={{ color: '#1c21df' }}>{req.project_name || 'General'}</strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Expected Return</span>
                            <strong style={{ color: '#0f172a' }}>{req.return_date || 'Permanent / Purchase'}</strong>
                          </div>
                          {req.purpose && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Purpose</span>
                              <span style={{ color: '#334155' }}>{req.purpose}</span>
                            </div>
                          )}
                        </div>

                        {/* Status Message / Admin Instructions */}
                        {isPending && (
                          <div style={{
                            padding: '7px 9px',
                            background: '#fffbeb',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            color: '#92400e',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            border: '1px solid #fef3c7'
                          }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#f59e0b' }}>schedule</span>
                            <span>Awaiting lab administrator review & approval.</span>
                          </div>
                        )}

                        {isApproved && (
                          <div style={{
                            padding: '7px 9px',
                            background: '#eff2fe',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            color: '#1c21df',
                            border: '1px solid #bfdbfe'
                          }}>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: req.admin_notes ? '3px' : '0' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified</span>
                              <span>Ready for Pickup at the Innovation Lab!</span>
                            </div>
                            {req.admin_notes && (
                              <div style={{ color: '#2563eb', paddingLeft: '20px' }}>
                                <strong>Pickup Note:</strong> {req.admin_notes}
                              </div>
                            )}
                          </div>
                        )}

                        {isDeclined && (
                          <div style={{
                            padding: '7px 9px',
                            background: '#fef2f2',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            color: '#991b1b',
                            border: '1px solid #fecaca'
                          }}>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: req.admin_notes ? '3px' : '0' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#ef4444' }}>cancel</span>
                              <span>Requisition could not be approved.</span>
                            </div>
                            {req.admin_notes && (
                              <div style={{ color: '#b91c1c', paddingLeft: '20px' }}>
                                <strong>Reason:</strong> {req.admin_notes}
                              </div>
                            )}
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
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>search_off</span>
              </div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.92rem', color: '#0f172a' }}>No Requests Found</h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                No active or past equipment orders match <strong>{emailInput}</strong>.
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
                Enter your email address to see live approval and pickup status.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 16px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
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
