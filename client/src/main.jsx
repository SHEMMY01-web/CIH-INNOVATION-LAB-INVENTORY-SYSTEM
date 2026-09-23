import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import * as serviceWorkerRegistration from './serviceWorkerRegistration'

import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

// Gracefully handle dynamic import chunk / preload errors (e.g. after new deployments)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Vite] Preload error detected:', event.payload);
  event.preventDefault(); // Prevent throwing unhandled error to ErrorBoundary

  const lastReload = sessionStorage.getItem('vite_preload_retry');
  const now = Date.now();
  // Throttle reloads to at most once per 10s to avoid reload loops
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    sessionStorage.setItem('vite_preload_retry', String(now));
    window.location.reload();
  }
});

// Register service worker for offline-first caching
serviceWorkerRegistration.register();
