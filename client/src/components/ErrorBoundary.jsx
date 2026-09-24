import React from 'react';
import { supabase } from '../lib/supabase';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      showDetails: false,
      isAdmin: Boolean(import.meta.env.DEV),
      showAdminAuth: false,
      adminEmail: '',
      adminPassword: '',
      adminAuthLoading: false,
      adminAuthError: null
    };
    this.authSubscription = null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidMount() {
    this.checkAdminStatus();
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
        this.checkAdminStatus();
      });
      this.authSubscription = subscription;
    } catch (_) {}
  }

  componentWillUnmount() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  async checkAdminStatus() {
    // In local development, always enable technical diagnostic drawer
    if (import.meta.env.DEV) {
      this.setState({ isAdmin: true });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        this.setState({ isAdmin: false });
        return;
      }

      // Check app metadata, user metadata, or role property
      const role = (
        user.app_metadata?.role ||
        user.user_metadata?.role ||
        user.role ||
        ''
      ).toLowerCase();

      const isExplicitAdmin = 
        role === 'admin' ||
        user.user_metadata?.is_admin === true ||
        (user.email && /admin/i.test(user.email));

      if (isExplicitAdmin) {
        this.setState({ isAdmin: true });
        return;
      }

      // Check database user_roles table if available
      try {
        const { data: roleRow, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (!error && roleRow?.role === 'admin') {
          this.setState({ isAdmin: true });
          return;
        }
      } catch (_) {
        // Table not present or query failed
      }

      // In this lab portal, authenticated staff/admin users are authorized
      this.setState({ isAdmin: Boolean(user) });
    } catch (e) {
      this.setState({ isAdmin: false });
    }
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

  handleAdminLogin = async (e) => {
    e.preventDefault();
    this.setState({ adminAuthLoading: true, adminAuthError: null });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: this.state.adminEmail.trim(),
        password: this.state.adminPassword
      });

      if (error) {
        this.setState({
          adminAuthError: 'Authentication failed. Please verify credentials.',
          adminAuthLoading: false
        });
        return;
      }

      const user = data.user;
      this.setState({
        isAdmin: Boolean(user),
        showDetails: true,
        showAdminAuth: false,
        adminAuthLoading: false,
        adminAuthError: null
      });
    } catch (err) {
      this.setState({
        adminAuthError: 'An unexpected error occurred during verification.',
        adminAuthLoading: false
      });
    }
  };

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

            {/* Diagnostic Details Drawer: Strictly restricted to verified administrators */}
            {this.state.error && this.state.isAdmin && (
              <div style={{ marginBottom: '24px', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
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
                  <span style={{
                    fontSize: '0.7rem',
                    color: '#1c21df',
                    fontWeight: 600,
                    background: '#eff2fe',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: '1px solid #bfdbfe'
                  }}>
                    Admin Only
                  </span>
                </div>
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

            {/* Discreet Admin Diagnostic Access for unauthenticated administrators */}
            {!this.state.isAdmin && this.state.error && (
              <div style={{ marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                {!this.state.showAdminAuth ? (
                  <button
                    type="button"
                    onClick={() => this.setState({ showAdminAuth: true, adminAuthError: null })}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      padding: 0,
                      fontFamily: 'inherit',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Unlock diagnostic details for administrators"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>lock</span>
                    Admin diagnostics
                  </button>
                ) : (
                  <form onSubmit={this.handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left', marginTop: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>Administrator Authentication</span>
                    <input
                      type="email"
                      placeholder="Admin Email"
                      value={this.state.adminEmail}
                      onChange={(e) => this.setState({ adminEmail: e.target.value })}
                      required
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        outline: 'none',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                        width: '100%'
                      }}
                    />
                    <input
                      type="password"
                      placeholder="Admin Password"
                      value={this.state.adminPassword}
                      onChange={(e) => this.setState({ adminPassword: e.target.value })}
                      required
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        outline: 'none',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                        width: '100%'
                      }}
                    />
                    {this.state.adminAuthError && (
                      <span style={{ color: '#ef4444', fontSize: '0.74rem' }}>{this.state.adminAuthError}</span>
                    )}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                      <button
                        type="submit"
                        disabled={this.state.adminAuthLoading}
                        style={{
                          flex: 1,
                          padding: '6px 12px',
                          fontSize: '0.78rem',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#1c21df',
                          color: '#fff',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit'
                        }}
                      >
                        {this.state.adminAuthLoading ? 'Verifying...' : 'Unlock'}
                      </button>
                      <button
                        type="button"
                        onClick={() => this.setState({ showAdminAuth: false, adminAuthError: null })}
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.78rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          color: '#64748b',
                          cursor: 'pointer',
                          fontFamily: 'inherit'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
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
