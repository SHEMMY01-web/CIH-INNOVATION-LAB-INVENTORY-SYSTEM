import React, { useEffect, useRef, useState } from 'react';
import { useAlertModal } from '../contexts/AlertContext';

export default function AlertPopup() {
  const { modalState, handleClose } = useAlertModal();
  const confirmBtnRef = useRef(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

  const {
    isOpen,
    title,
    message,
    type = 'info',
    confirmText = 'Got it',
    cancelText = '',
    isDanger = false,
    steDetails = null
  } = modalState;

  // Keyboard accessibility and reset states
  useEffect(() => {
    if (!isOpen) {
      setShowTechDetails(false);
      return;
    }

    // Focus confirm button when popup opens
    const timer = setTimeout(() => {
      confirmBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const isConfirm = type === 'confirm';
  const hasCancel = Boolean(cancelText);

  // Styling tokens per alert type
  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'check_circle',
          color: '#1c21df',
          bg: '#eff2fe',
          border: '#bfdbfe',
          glow: 'rgba(28, 33, 223, 0.2)'
        };
      case 'error':
        return {
          icon: 'error',
          color: '#ef4444',
          bg: '#fef2f2',
          border: '#fecaca',
          glow: 'rgba(239, 68, 68, 0.2)'
        };
      case 'warning':
        return {
          icon: 'warning',
          color: '#f59e0b',
          bg: '#fffbeb',
          border: '#fde68a',
          glow: 'rgba(245, 158, 11, 0.2)'
        };
      case 'confirm':
        return isDanger
          ? {
              icon: 'delete_forever',
              color: '#ef4444',
              bg: '#fef2f2',
              border: '#fecaca',
              glow: 'rgba(239, 68, 68, 0.2)'
            }
          : {
              icon: 'help_outline',
              color: 'var(--primary-color, #1c21df)',
              bg: '#eff6ff',
              border: '#bfdbfe',
              glow: 'rgba(28, 33, 223, 0.2)'
            };
      case 'info':
      default:
        return {
          icon: 'info',
          color: 'var(--primary-color, #1c21df)',
          bg: '#eff6ff',
          border: '#bfdbfe',
          glow: 'rgba(28, 33, 223, 0.2)'
        };
    }
  };

  const config = getTypeConfig();

  return (
    <div
      className="alert-popup-overlay"
      onClick={() => handleClose(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'alertOverlayFadeIn 0.2s ease-out'
      }}
    >
      <div
        className="alert-popup-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-message"
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--card-bg, #ffffff)',
          borderRadius: '6px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.6)',
          padding: '26px 24px 22px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          animation: 'alertCardPopIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          boxSizing: 'border-box'
        }}
      >
        {/* Status Icon Badge */}
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '6px',
            backgroundColor: config.bg,
            border: `1.5px solid ${config.border}`,
            boxShadow: `0 0 0 8px ${config.glow}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            flexShrink: 0
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: '32px',
              color: config.color,
              lineHeight: 1
            }}
          >
            {config.icon}
          </span>
        </div>

        {/* Title */}
        <h3
          id="alert-dialog-title"
          style={{
            margin: '0 0 12px 0',
            fontSize: '1.2rem',
            fontWeight: 600,
            fontFamily: 'var(--font-family, Outfit, sans-serif)',
            color: 'var(--text-color, #0f172a)',
            letterSpacing: '-0.01em'
          }}
        >
          {title}
        </h3>

        {/* Message: Standard ASD-STE100 Structured 3-Part View or Regular Text */}
        {steDetails ? (
          <div
            id="alert-dialog-message"
            style={{
              textAlign: 'left',
              width: '100%',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxSizing: 'border-box'
            }}
          >
            {/* Condition / Problem */}
            <div style={{
              padding: '9px 12px',
              background: '#f8fafc',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '0.84rem',
              lineHeight: 1.45
            }}>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', fontWeight: 500, marginBottom: '2px' }}>
                Problem
              </div>
              <div style={{ color: '#0f172a', fontWeight: 500 }}>
                {steDetails.problem}
              </div>
            </div>

            {/* Cause */}
            <div style={{
              padding: '9px 12px',
              background: '#fff7ed',
              borderRadius: '6px',
              border: '1px solid #fed7aa',
              fontSize: '0.84rem',
              lineHeight: 1.45
            }}>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#c2410c', fontWeight: 500, marginBottom: '2px' }}>
                Cause
              </div>
              <div style={{ color: '#9a3412', fontWeight: 500 }}>
                {steDetails.cause}
              </div>
            </div>

            {/* Required Action */}
            <div style={{
              padding: '9px 12px',
              background: '#eff2fe',
              borderRadius: '6px',
              border: '1px solid #bfdbfe',
              fontSize: '0.84rem',
              lineHeight: 1.45
            }}>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#1c21df', fontWeight: 500, marginBottom: '2px' }}>
                Required Action
              </div>
              <div style={{ color: '#1e3a8a', fontWeight: 500 }}>
                {steDetails.action}
              </div>
            </div>

            {/* Technical Diagnostics Accordion for Lab Administrators */}
            {steDetails.rawTechnical && (
              <div style={{ marginTop: '2px' }}>
                <button
                  type="button"
                  onClick={() => setShowTechDetails(prev => !prev)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    padding: '2px 0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                    {showTechDetails ? 'expand_less' : 'tune'}
                  </span>
                  <span>{showTechDetails ? 'Hide technical code' : 'Technical diagnostics'}</span>
                </button>
                {showTechDetails && (
                  <div style={{
                    marginTop: '4px',
                    padding: '8px 10px',
                    background: '#f1f5f9',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    fontFamily: 'monospace',
                    fontSize: '0.72rem',
                    color: '#475569',
                    wordBreak: 'break-all',
                    maxHeight: '75px',
                    overflowY: 'auto'
                  }}>
                    {steDetails.rawTechnical}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div
            id="alert-dialog-message"
            style={{
              margin: '0 0 20px 0',
              fontSize: '0.92rem',
              lineHeight: 1.55,
              color: 'var(--text-secondary, #475569)',
              whiteSpace: 'pre-line',
              maxHeight: '40vh',
              overflowY: 'auto',
              padding: '0 4px',
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            {message}
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            width: '100%',
            justifyContent: (isConfirm || hasCancel) ? 'flex-end' : 'stretch',
            alignItems: 'center',
            boxSizing: 'border-box'
          }}
        >
          {(isConfirm || hasCancel) && (
            <button
              type="button"
              onClick={() => handleClose(false)}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #cbd5e1)',
                backgroundColor: 'var(--card-bg, #ffffff)',
                color: 'var(--text-secondary, #475569)',
                fontWeight: 500,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--sidebar-active, #f1f5f9)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--card-bg, #ffffff)';
              }}
            >
              {cancelText || 'Cancel'}
            </button>
          )}

          <button
            ref={confirmBtnRef}
            type="button"
            onClick={() => handleClose(true)}
            style={{
              flex: (isConfirm || hasCancel) ? 1 : 'none',
              width: (isConfirm || hasCancel) ? 'auto' : '100%',
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: isDanger ? '#ef4444' : 'var(--primary-color, #1c21df)',
              color: '#ffffff',
              fontWeight: 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: isDanger
                ? '0 3px 10px rgba(239, 68, 68, 0.3)'
                : '0 3px 10px rgba(28, 33, 223, 0.3)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = isDanger
                ? '0 5px 14px rgba(239, 68, 68, 0.4)'
                : '0 5px 14px rgba(28, 33, 223, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = isDanger
                ? '0 3px 10px rgba(239, 68, 68, 0.3)'
                : '0 3px 10px rgba(28, 33, 223, 0.3)';
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes alertOverlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes alertCardPopIn {
          0% {
            opacity: 0;
            transform: scale(0.94) translateY(6px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
