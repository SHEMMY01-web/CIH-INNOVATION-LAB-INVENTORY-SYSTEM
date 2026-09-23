import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import TrackRequestsModal from './TrackRequestsModal';

export default function Navbar({ activeSection, onRequestEquipment }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [trackEmail, setTrackEmail] = useState('');
  const location = useLocation();

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
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
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
    if (location.pathname === '/' && targetHash) {
      const element = document.querySelector(targetHash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
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
            {isHome ? (
              <>
                <a 
                  href="#projects" 
                  className="nav-link-item"
                  onClick={() => handleNavClick('#projects')}
                >
                  Projects
                </a>
                <a 
                  href="#about" 
                  className="nav-link-item"
                  onClick={() => handleNavClick('#about')}
                >
                  About Us
                </a>
                <a 
                  href="#comments" 
                  className="nav-link-item"
                  onClick={() => handleNavClick('#comments')}
                >
                  Feedback
                </a>
              </>
            ) : (
              <>
                <Link to="/#projects" className="nav-link-item">Projects</Link>
                <Link to="/#about" className="nav-link-item">About Us</Link>
                <Link to="/#comments" className="nav-link-item">Feedback</Link>
              </>
            )}
          </div>

          {/* Desktop & Tablet Actions */}
          <div className="nav-actions">
            {onRequestEquipment ? (
              <button
                type="button"
                onClick={onRequestEquipment}
                style={{
                  background: 'linear-gradient(135deg, #ff5421 0%, #ff7a50 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
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
                style={{
                  background: 'linear-gradient(135deg, #ff5421 0%, #ff7a50 100%)',
                  color: '#ffffff',
                  borderRadius: '10px',
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
              onClick={() => setTrackModalOpen(true)}
              style={{
                background: '#eff6ff',
                color: '#1c21df',
                border: '1px solid #bfdbfe',
                borderRadius: '10px',
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
              <span className="hamburger-box">
                <span className="hamburger-inner"></span>
              </span>
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

      {/* Mobile Drawer Menu */}
      <div 
        className={`mobile-drawer ${mobileMenuOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile Navigation"
      >
        <div className="mobile-drawer-inner">
          <div className="mobile-drawer-header">
            <div className="mobile-drawer-title">Navigation Menu</div>
            <button 
              type="button" 
              className="mobile-drawer-close"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="mobile-nav-list">
            <Link 
              to="/" 
              className={`mobile-nav-item ${isHome && !location.hash ? 'is-active' : ''}`}
              onClick={() => handleNavClick()}
            >
              <span className="material-symbols-outlined mobile-nav-icon">home</span>
              <div className="mobile-nav-text">
                <strong>Home</strong>
                <span>Welcome & lab overview</span>
              </div>
              <span className="material-symbols-outlined mobile-nav-arrow">chevron_right</span>
            </Link>

            <Link 
              to="/catalog" 
              className={`mobile-nav-item ${location.pathname === '/catalog' ? 'is-active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="material-symbols-outlined mobile-nav-icon">inventory_2</span>
              <div className="mobile-nav-text">
                <strong>Equipment Catalog</strong>
                <span>Browse tools, assets & electronics</span>
              </div>
              <span className="material-symbols-outlined mobile-nav-arrow">chevron_right</span>
            </Link>

            {isHome ? (
              <>
                <a 
                  href="#projects" 
                  className="mobile-nav-item"
                  onClick={() => handleNavClick('#projects')}
                >
                  <span className="material-symbols-outlined mobile-nav-icon">rocket_launch</span>
                  <div className="mobile-nav-text">
                    <strong>Projects</strong>
                    <span>Innovations built by members</span>
                  </div>
                  <span className="material-symbols-outlined mobile-nav-arrow">chevron_right</span>
                </a>

                <a 
                  href="#about" 
                  className="mobile-nav-item"
                  onClick={() => handleNavClick('#about')}
                >
                  <span className="material-symbols-outlined mobile-nav-icon">info</span>
                  <div className="mobile-nav-text">
                    <strong>About Us</strong>
                    <span>Our mission, vision & facility</span>
                  </div>
                  <span className="material-symbols-outlined mobile-nav-arrow">chevron_right</span>
                </a>

                <a 
                  href="#comments" 
                  className="mobile-nav-item"
                  onClick={() => handleNavClick('#comments')}
                >
                  <span className="material-symbols-outlined mobile-nav-icon">forum</span>
                  <div className="mobile-nav-text">
                    <strong>Community Feedback</strong>
                    <span>Share notes & thoughts</span>
                  </div>
                  <span className="material-symbols-outlined mobile-nav-arrow">chevron_right</span>
                </a>
              </>
            ) : (
              <>
                <Link 
                  to="/#projects" 
                  className="mobile-nav-item"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="material-symbols-outlined mobile-nav-icon">rocket_launch</span>
                  <div className="mobile-nav-text">
                    <strong>Projects</strong>
                    <span>Innovations built by members</span>
                  </div>
                  <span className="material-symbols-outlined mobile-nav-arrow">chevron_right</span>
                </Link>

                <Link 
                  to="/#about" 
                  className="mobile-nav-item"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="material-symbols-outlined mobile-nav-icon">info</span>
                  <div className="mobile-nav-text">
                    <strong>About Us</strong>
                    <span>Our mission, vision & facility</span>
                  </div>
                  <span className="material-symbols-outlined mobile-nav-arrow">chevron_right</span>
                </Link>

                <Link 
                  to="/#comments" 
                  className="mobile-nav-item"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="material-symbols-outlined mobile-nav-icon">forum</span>
                  <div className="mobile-nav-text">
                    <strong>Community Feedback</strong>
                    <span>Share notes & thoughts</span>
                  </div>
                  <span className="material-symbols-outlined mobile-nav-arrow">chevron_right</span>
                </Link>
              </>
            )}
          </div>

          <div className="mobile-drawer-footer" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {onRequestEquipment ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onRequestEquipment();
                }}
                style={{
                  width: '100%',
                  padding: '12px 18px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #ff5421 0%, #ff7a50 100%)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(255, 84, 33, 0.3)',
                  fontFamily: 'inherit'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>shopping_cart_checkout</span>
                <span>Request Equipment Online</span>
              </button>
            ) : (
              <Link
                to="/catalog"
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  width: '100%',
                  padding: '12px 18px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #ff5421 0%, #ff7a50 100%)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(255, 84, 33, 0.3)',
                  boxSizing: 'border-box'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>shopping_cart_checkout</span>
                <span>Request Equipment Online</span>
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
                padding: '11px 16px',
                borderRadius: '12px',
                border: '1px solid #bfdbfe',
                background: '#eff6ff',
                color: '#1c21df',
                fontWeight: 600,
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>receipt_long</span>
              <span>Track My Requests</span>
            </button>
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
