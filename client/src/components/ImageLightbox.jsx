import React, { useEffect } from 'react';

export default function ImageLightbox({ isOpen, onClose, imageSrc, title }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="img-lightbox-overlay" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Image preview'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px'
      }}
    >
      <div 
        className="img-lightbox-card" 
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '85vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc'
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '1rem', color: '#0f172a' }}>
            {title || 'Item Image'}
          </span>
          <button 
            onClick={onClose}
            aria-label="Close image preview"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '24px',
              color: '#64748b',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px'
            }}
          >
            &times;
          </button>
        </div>

        <div 
          style={{
            padding: '24px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '260px',
            backgroundColor: '#ffffff'
          }}
        >
          {imageSrc ? (
            <img 
              src={imageSrc} 
              alt={title || 'Item'} 
              style={{
                maxWidth: '75vw',
                maxHeight: '65vh',
                objectFit: 'contain',
                borderRadius: '8px',
                display: 'block'
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '64px', color: '#cbd5e1' }}>
                broken_image
              </span>
              <p style={{ marginTop: '8px', fontSize: '0.95rem' }}>No image available for this item.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
