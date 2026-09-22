import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import '../styles/forgot.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  const retryTimerRef = useRef(null);

  // Cleanup timer on unmount to prevent setState on dead component
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ text: '', type: '' });

    const origin = window.location.origin;
    const redirectTo = `${origin}/update_password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) {
      console.warn('[ForgotPassword] Reset error:', error.message);
      // OWASP CWE-204: Prevent account enumeration via timing/error discrepancy.
      // Only surface rate limit (429) errors; normalize all other responses.
      if (error.status === 429 || error.message?.toLowerCase().includes('rate limit')) {
        setMessage({ text: 'Too many requests. Please wait a few minutes before trying again.', type: 'error' });
        setIsLoading(false);
        return;
      }
    }

    setMessage({ 
      text: 'If an account exists with this email, a password reset link has been sent. Please check your inbox.', 
      type: 'success' 
    });
    // Re-enable button after 30 seconds in case user needs to retry
    retryTimerRef.current = setTimeout(() => {
      setIsLoading(false);
      setMessage({ text: '', type: '' });
    }, 30000);
  };

  return (
    <main className="auth-section" id="main-content">
      <div className="auth-container">
        <Link to="/" className="logo" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }} title="Back to Innovation Lab Home">
          <img src="/IMAGES/cih-removebg-preview.png" alt="CIH Logo" style={{ height: '36px', objectFit: 'contain' }} />
          <span style={{ fontSize: '1.4rem', fontWeight: '700', fontFamily: "'Outfit', sans-serif" }}>Inventory</span>
        </Link>
        <div className="auth-header">
          <h1>Forgot Password</h1>
          <p>
            Enter your registered email address. We'll send you a link to reset
            your password.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="forgot-email" className="sr-only">Email address</label>
            <input 
              type="email" 
              id="forgot-email"
              aria-label="Email address"
              required 
              placeholder="Email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <p style={{ 
            fontSize: '0.9rem', 
            minHeight: '18px', 
            margin: '0 0 8px 0',
            color: message.type === 'error' ? '#e53935' : '#2e7d32'
          }}>
            {message.text}
          </p>
          <input 
            type="submit" 
            className="btn-primary" 
            value={message.type === 'success' ? 'Link Sent ✓' : (isLoading ? 'Sending...' : 'Send Reset Link')} 
            disabled={isLoading || message.type === 'success'}
          />
        </form>
        <div className="back-link">
          <Link to="/login">&larr; Back to Login</Link>
        </div>
      </div>
    </main>
  );
}
