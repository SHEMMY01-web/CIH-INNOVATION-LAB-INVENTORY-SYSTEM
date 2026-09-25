import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import TrackRequestsModal from './TrackRequestsModal';

export default function Navbar({ activeSection, onRequestEquipment }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [trackEmail, setTrackEmail] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleOpenTrack = (e) => {
      if (e.detail?.email) {
        setTrackEmail(e.detail.email);
      }
      setTrackModalOpen(true);
    };
    window.addEventListener('open-track-orders', handleOpenTrack);
    return () => window.removeEventListener('open-track-orders', handleOpenTrack);
  }, []);

  // Handle scroll detection for dynamic glassmorphism elevation
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.hash]);

  // Prevent background scrolling when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
    } else {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    };
  }, [mobileMenuOpen]);

  // Handle ESC key to dismiss drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavClick = (targetHash) => {
    setMobileMenuOpen(false);
    if (!targetHash) return;

    if (location.pathname === '/') {
      const element = document.querySelector(targetHash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      navigate('/' + targetHash);
    }
  };

  const isHome = location.pathname === '/';

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <nav className={`landing-nav ${scrolled ? 'nav-scrolled' : ''}`}>
        <div className="nav-container">
          {/* Logo Area */}
          <Link 
            to="/" 
            className="logo-area" 
            title="CIH Innovation Lab - Home"
            onClick={() => setMobileMenuOpen(false)}
          >
            <img 
              src="/IMAGES/cih-footer-logo.png" 
              alt="CIH Logo" 
              className="landing-logo" 
            />
            <div className="logo-text-group">
              <span className="logo-brand-pre">CIH</span>
              <span className="logo-text">Innovation Lab</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="nav-links">
            <Link 
              to="/" 
              className={`nav-link-item ${isHome && !location.hash ? 'active' : ''}`}
            >
              Home
            </Link>
            <Link 
              to="/catalog" 
              className={`nav-link-item ${location.pathname === '/catalog' ? 'active' : ''}`}
            >
              Catalog
            </Link>
            <Link 
              to="/#projects" 
              className={`nav-link-item ${location.hash === '#projects' ? 'active' : ''}`}
              onClick={(e) => {
                if (isHome) {
                  e.preventDefault();
                  handleNavClick('#projects');
                }
              }}
            >
              Projects
            </Link>
            <Link 
              to="/#about" 
              className={`nav-link-item ${location.hash === '#about' ? 'active' : ''}`}
              onClick={(e) => {
                if (isHome) {
                  e.preventDefault();
                  handleNavClick('#about');
                }
              }}
            >
              About Us
            </Link>
            <Link 
              to="/#comments" 
              className={`nav-link-item ${location.hash === '#comments' ? 'active' : ''}`}
              onClick={(e) => {
                if (isHome) {
                  e.preventDefault();
                  handleNavClick('#comments');
                }
              }}
            >
              Feedback
            </Link>
          </div>

          {/* Desktop & Tablet Actions */}
          <div className="nav-actions">
            {onRequestEquipment ? (
              <button
                type="button"
                className="nav-action-desktop"
                onClick={onRequestEquipment}
                style={{
                  background: 'linear-gradient(135deg, #ff5421 0%, #ff7a50 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 10px rgba(255, 84, 33, 0.35)',
                  fontFamily: 'inherit'
                }}
                title="Request equipment for your project"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>shopping_cart_checkout</span>
                <span>Request Tool</span>
              </button>
            ) : (
              <Link
                to="/catalog"
                className="nav-action-desktop"
                style={{
                  background: 'linear-gradient(135deg, #ff5421 0%, #ff7a50 100%)',
                  color: '#ffffff',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 10px rgba(255, 84, 33, 0.35)'
                }}
                title="Browse & order lab tools"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>shopping_cart_checkout</span>
                <span>Request Tool</span>
              </Link>
            )}

            <button
              type="button"
              className="nav-action-desktop"
              onClick={() => setTrackModalOpen(true)}
              style={{
                background: '#eff6ff',
                color: '#1c21df',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                padding: '7px 14px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease'
              }}
              title="Track your equipment requests and status"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>receipt_long</span>
              <span>My Requests</span>
            </button>

            {/* Mobile Animated Hamburger Button */}
            <button
              type="button"
              className={`mobile-menu-toggle ${mobileMenuOpen ? 'is-active' : ''}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6"></line>
                  <line x1="4" y1="12" x2="20" y2="12"></line>
                  <line x1="4" y1="18" x2="20" y2="18"></line>
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Backdrop */}
      <div 
        className={`mobile-drawer-backdrop ${mobileMenuOpen ? 'is-visible' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile Drawer Menu (Slides in from Right) */}
      <div 
        className={`mobile-drawer ${mobileMenuOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-modal={mobileMenuOpen ? "true" : "false"}
        aria-label="Mobile Navigation"
      >
        <div className="mobile-drawer-inner">
          <div className="mobile-drawer-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img 
                src="/IMAGES/cih-footer-logo.png" 
                alt="CIH Logo" 
                style={{ height: '30px', width: 'auto' }} 
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.96rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>CIH Innovation Lab</span>
              </div>
            </div>
            <button 
              type="button" 
              className="mobile-drawer-close"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Quick Action Buttons in Drawer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0 10px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            {onRequestEquipment ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onRequestEquipment();
                }}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #ff5421 0%, #ff7a50 100%)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(255, 84, 33, 0.3)',
                  fontFamily: 'inherit'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>shopping_cart_checkout</span>
                <span>Request Tool</span>
              </button>
            ) : (
              <Link
                to="/catalog"
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #ff5421 0%, #ff7a50 100%)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(255, 84, 33, 0.3)',
                  boxSizing: 'border-box'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>shopping_cart_checkout</span>
                <span>Request Tool</span>
              </Link>
            )}

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setTrackModalOpen(true);
              }}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '6px',
                border: '1px solid #bfdbfe',
                background: '#eff6ff',
                color: '#1c21df',
                fontWeight: 600,
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>receipt_long</span>
              <span>My Requests</span>
            </button>
          </div>

          <div className="mobile-nav-list">
            <Link 
              to="/" 
              className={`mobile-nav-item ${isHome && !location.hash ? 'is-active' : ''}`}
              onClick={() => handleNavClick()}
            >
              <span className="material-symbols-outlined mobile-nav-icon">home</span>
              <span className="mobile-nav-title">Home</span>
              <span className="material-symbols-outlined mobile-nav-arrow">chevron_right</span>
            </Link>

            <Link 
              to="/catalog" 
              className={`mobile-nav-item ${location.pathname === '/catalog' ? 'is-active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="material-symbols-outlined mobile-nav-icon">inventory_2</span>
              <span className="mobile-nav-title">Equipment Catalog</span>
              <span className="material-symbols-outlined mobile-nav-arrow">chevron_right</span>
            </Link>

            <Link 
              to="/#projects" 
              className={`mobile-nav-item ${location.hash === '#projects' ? 'is-active' : ''}`}
              onClick={(e) => {
                setMobileMenuOpen(false);
                if (isHome) {
                  e.preventDefault();
                  handleNavClick('#projects');
                }
              }}
            >
              <span className="material-symbols-outlined mobile-nav-icon">rocket_launch</span>
              <span className="mobile-nav-title">Projects</span>
              <span className="material-symbols-outlined mobile-nav-arrow">chevron_right</span>
            </Link>

            <Link 
              to="/#about" 
              className={`mobile-nav-item ${location.hash === '#about' ? 'is-active' : ''}`}
              onClick={(e) => {
                setMobileMenuOpen(false);
                if (isHome) {
                  e.preventDefault();
                  handleNavClick('#about');
                }
              }}
            >
              <span className="material-symbols-outlined mobile-nav-icon">info</span>
              <span className="mobile-nav-title">About Us</span>
              <span className="material-symbols-outlined mobile-nav-arrow">chevron_right</span>
            </Link>

            <Link 
              to="/#comments" 
              className={`mobile-nav-item ${location.hash === '#comments' ? 'is-active' : ''}`}
              onClick={(e) => {
                setMobileMenuOpen(false);
                if (isHome) {
                  e.preventDefault();
                  handleNavClick('#comments');
                }
              }}
            >
              <span className="material-symbols-outlined mobile-nav-icon">forum</span>
              <span className="mobile-nav-title">Community Feedback</span>
              <span className="material-symbols-outlined mobile-nav-arrow">chevron_right</span>
            </Link>
          </div>

          <div className="mobile-drawer-footer" style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              CIH Innovation Lab • Engineering Excellence
            </span>
          </div>
        </div>
      </div>

      {/* Live Request Tracking Modal */}
      <TrackRequestsModal 
        isOpen={trackModalOpen} 
        onClose={() => setTrackModalOpen(false)} 
        initialEmail={trackEmail} 
      />
    </>
  );
}
