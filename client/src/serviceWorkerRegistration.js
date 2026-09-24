/**
 * Service Worker Registration for CIH Innovation Lab Inventory
 */

export function register() {
  if ('serviceWorker' in navigator) {
    let refreshing = false;

    // When the service worker controlling this page changes (e.g. after update + skipWaiting),
    // automatically reload the active window so mobile users immediately see the new deployment.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        console.log('[PWA] Controller changed. Seamlessly reloading for latest version...');
        window.location.reload();
      }
    });

    window.addEventListener('load', () => {
      const swUrl = '/sw.js';

      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          console.log('[PWA] Service Worker registered with scope:', registration.scope);

          // Check for service worker updates immediately on page load
          registration.update().catch(() => null);

          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) return;

            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('[PWA] New content is available; activating immediately.');
                  installingWorker.postMessage({ type: 'SKIP_WAITING' });
                } else {
                  console.log('[PWA] Content is cached for offline use.');
                }
              }
            };
          };
        })
        .catch((error) => {
          console.warn('[PWA] Service Worker registration failed:', error);
        });
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
