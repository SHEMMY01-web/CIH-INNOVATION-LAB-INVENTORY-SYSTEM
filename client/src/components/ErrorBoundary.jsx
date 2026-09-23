import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    // Auto-recover from stale chunks or preload errors after new deployments
    const isChunkOrPreloadError = error?.message && (
      error.message.includes('dynamically imported module') ||
      error.message.includes('Unable to preload') ||
      error.message.includes('Unexpected token')
    );

    if (isChunkOrPreloadError) {
      const lastRetry = sessionStorage.getItem('chunk_auto_retry');
      const now = Date.now();
      if (!lastRetry || now - parseInt(lastRetry, 10) > 15000) {
        sessionStorage.setItem('chunk_auto_retry', String(now));
        if ('caches' in window) {
          caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
            .finally(() => { window.location.reload(); });
        } else {
          window.location.reload();
        }
      }
    }
  }

  handleReload = async () => {
    this.setState({ hasError: false, error: null, showDetails: false });
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch (e) {
        console.warn('[ErrorBoundary] Cache purge error:', e);
      }
    }
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '40px 24px',
          fontFamily: "'Inter', sans-serif",
          background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
          color: '#0f172a',
          textAlign: 'center'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '48px 40px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#ef4444' }}>
                error
              </span>
            </div>

            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: '0.95rem', color: '#64748b', margin: '0 0 24px', lineHeight: 1.6 }}>
              An unexpected error occurred. This has been logged and our team will investigate.
            </p>

            {this.state.error && (
              <div style={{ marginBottom: '24px', textAlign: 'left' }}>
                <button
                  type="button"
                  onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                    fontFamily: 'inherit',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    {this.state.showDetails ? 'expand_less' : 'expand_more'}
                  </span>
                  {this.state.showDetails ? 'Hide technical details' : 'Show technical details'}
                </button>
                {this.state.showDetails && (
                  <pre style={{
                    marginTop: '8px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '10px',
                    padding: '12px',
                    fontSize: '0.76rem',
                    color: '#991b1b',
                    textAlign: 'left',
                    overflow: 'auto',
                    maxHeight: '140px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {this.state.error.toString()}
                    {this.state.error?.stack ? `\n\nStack:\n${this.state.error.stack}` : ''}
                  </pre>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleGoHome}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease'
                }}
              >
                Go Home
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#1c21df',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 2px 8px rgba(28, 33, 223, 0.3)',
                  transition: 'all 0.2s ease'
                }}
              >
                Reload Page
              </button>
            </div>
          </div>

          <p style={{ marginTop: '24px', fontSize: '0.8rem', color: '#94a3b8' }}>
            CIH Innovation Lab Inventory System
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
