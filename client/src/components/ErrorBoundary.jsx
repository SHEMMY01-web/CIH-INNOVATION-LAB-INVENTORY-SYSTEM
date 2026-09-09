import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
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

            {import.meta.env.DEV && this.state.error && (
              <pre style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                padding: '14px',
                fontSize: '0.78rem',
                color: '#991b1b',
                textAlign: 'left',
                overflow: 'auto',
                maxHeight: '120px',
                marginBottom: '24px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {this.state.error.toString()}
              </pre>
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
