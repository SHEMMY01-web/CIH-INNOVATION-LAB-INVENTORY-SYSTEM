import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Component that automatically scrolls to hash targets (e.g. #projects, #about, #comments)
 * across page transitions in React Router.
 */
export default function ScrollToHashElement() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) return;

    const targetId = hash.replace(/^#/, '');

    const tryScroll = () => {
      const element = document.getElementById(targetId) || document.querySelector(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
      }
      return false;
    };

    // Attempt immediate scroll
    if (tryScroll()) return;

    // Retry across mounting frames for lazy-loaded pages
    let cancelled = false;
    const timeouts = [
      setTimeout(() => { if (!cancelled) tryScroll(); }, 60),
      setTimeout(() => { if (!cancelled) tryScroll(); }, 180),
      setTimeout(() => { if (!cancelled) tryScroll(); }, 350),
      setTimeout(() => { if (!cancelled) tryScroll(); }, 600),
      setTimeout(() => { if (!cancelled) tryScroll(); }, 1000)
    ];

    return () => {
      cancelled = true;
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [pathname, hash]);

  return null;
}
