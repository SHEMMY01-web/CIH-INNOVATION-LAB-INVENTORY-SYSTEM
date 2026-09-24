import React, { useEffect, useRef } from 'react';
import { useAlertModal } from '../contexts/AlertContext';

export default function AlertPopup() {
  const { modalState, handleClose } = useAlertModal();
  const confirmBtnRef = useRef(null);

  const {
    isOpen,
    title,
    message,
    type = 'info',
    confirmText = 'Got it',
    cancelText = 'Cancel',
    isDanger = false
  } = modalState;

  // Keyboard accessibility
  useEffect(() => {
    if (!isOpen) return;

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
          maxWidth: '440px',
          background: 'var(--card-bg, #ffffff)',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.6)',
          padding: '28px 24px 24px 24px',
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
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: config.bg,
            border: `1.5px solid ${config.border}`,
            boxShadow: `0 0 0 8px ${config.glow}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px',
            flexShrink: 0
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: '34px',
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
            margin: '0 0 8px 0',
            fontSize: '1.25rem',
            fontWeight: 700,
            fontFamily: 'var(--font-family, Outfit, sans-serif)',
            color: 'var(--text-color, #0f172a)',
            letterSpacing: '-0.01em'
          }}
        >
          {title}
        </h3>

        {/* Message */}
        <div
          id="alert-dialog-message"
          style={{
            margin: '0 0 24px 0',
            fontSize: '0.94rem',
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

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            width: '100%',
            justifyContent: isConfirm ? 'flex-end' : 'stretch',
            alignItems: 'center',
            boxSizing: 'border-box'
          }}
        >
          {isConfirm && (
            <button
              type="button"
              onClick={() => handleClose(false)}
              style={{
                flex: 1,
                padding: '11px 18px',
                borderRadius: '10px',
                border: '1px solid var(--border-color, #cbd5e1)',
                backgroundColor: 'var(--card-bg, #ffffff)',
                color: 'var(--text-secondary, #475569)',
                fontWeight: 600,
                fontSize: '0.92rem',
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
              flex: isConfirm ? 1 : 'none',
              width: isConfirm ? 'auto' : '100%',
              padding: '11px 22px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: isDanger ? '#ef4444' : 'var(--primary-color, #1c21df)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.92rem',
              cursor: 'pointer',
              boxShadow: isDanger
                ? '0 4px 12px rgba(239, 68, 68, 0.3)'
                : '0 4px 14px rgba(28, 33, 223, 0.3)',
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
                ? '0 6px 16px rgba(239, 68, 68, 0.4)'
                : '0 6px 18px rgba(28, 33, 223, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = isDanger
                ? '0 4px 12px rgba(239, 68, 68, 0.3)'
                : '0 4px 14px rgba(28, 33, 223, 0.3)';
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
            transform: scale(0.92) translateY(8px);
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
