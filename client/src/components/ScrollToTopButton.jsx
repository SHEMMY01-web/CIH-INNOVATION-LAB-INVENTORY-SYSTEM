import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const location = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setVisible(false);
  }, [location.pathname]);

  // Check if any modal or overlay is active in the document
  const checkIsModalActive = useCallback(() => {
    if (typeof document === 'undefined') return false;
    return (
      document.body.classList.contains('modal-open') ||
      Boolean(document.querySelector('.side-modal-overlay.open, .center-modal-overlay.open, .mobile-drawer.is-open, .modal-backdrop'))
    );
  }, []);

  // Update button visibility based on scroll depth and active modals
  const updateButtonState = useCallback(() => {
    if (checkIsModalActive()) {
      setVisible(false);
      return;
    }

    const scrollY = window.scrollY || document.documentElement.scrollTop;
    if (scrollY > 220) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [checkIsModalActive]);

  // Listen to scroll and resize events
  useEffect(() => {
    window.addEventListener('scroll', updateButtonState, { passive: true });
    window.addEventListener('resize', updateButtonState, { passive: true });
    updateButtonState();

    return () => {
      window.removeEventListener('scroll', updateButtonState);
      window.removeEventListener('resize', updateButtonState);
    };
  }, [updateButtonState]);

  // MutationObserver to instantly hide button when any modal mounts, opens, or locks scroll
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const observer = new MutationObserver(() => {
      updateButtonState();
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, [updateButtonState]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <button
      type="button"
      className={`floating-scroll-top-btn ${visible ? 'visible' : ''}`}
      onClick={scrollToTop}
      aria-label="Scroll to top"
      title="Scroll to top"
      id="global-scroll-to-top"
    >
      <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>
        expand_less
      </span>
    </button>
  );
}
