import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const location = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setVisible(false);
  }, [location.pathname]);

  // Listen for scroll events on window
  useEffect(() => {
    const toggleVisibility = () => {
      // Show when scrolled down more than 220px
      if (window.scrollY > 220 || document.documentElement.scrollTop > 220) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    toggleVisibility();

    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

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
