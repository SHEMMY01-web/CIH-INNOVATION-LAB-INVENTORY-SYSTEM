import React, { useState, useEffect, useRef } from 'react';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowBackOnline(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setShowBackOnline(false);
      }, 3500);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowBackOnline(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline && !showBackOnline) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        borderRadius: '30px',
        backgroundColor: isOffline ? '#1e293b' : '#059669',
        color: '#ffffff',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.15)',
        fontSize: '0.85rem',
        fontWeight: 600,
        fontFamily: 'var(--font-family, sans-serif)',
        animation: 'slideInOffline 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{
          fontSize: '20px',
          color: isOffline ? '#f59e0b' : '#6ee7b7'
        }}
      >
        {isOffline ? 'cloud_off' : 'cloud_done'}
      </span>
      <span>
        {isOffline
          ? 'Working Offline • Serving cached items & images'
          : 'Back Online • Connected to live database'}
      </span>

      <style>{`
        @keyframes slideInOffline {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
