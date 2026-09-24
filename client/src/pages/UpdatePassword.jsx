import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import '../styles/forgot.css';

const PASSWORD_MIN_LENGTH = 8;

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: '#e2e8f0' };
  
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: 'Too short', color: '#ef4444' },
    { label: 'Weak', color: '#f97316' },
    { label: 'Fair', color: '#f59e0b' },
    { label: 'Good', color: '#60a5fa' },
    { label: 'Strong', color: '#3b82f6' },
    { label: 'Excellent', color: '#1c21df' }
  ];

  return { score, ...levels[Math.min(score, levels.length - 1)] };
}

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  // Tracks whether the user arrived here via a cryptographically signed email recovery link
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const navigate = useNavigate();

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(() => {
    let isMounted = true;

    // Fast-path: Supabase appends #access_token=...&type=recovery to the URL
    // when the user arrives from the password reset email link.
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      if (isMounted) {
        setIsRecoverySession(true);
        setIsCheckingSession(false);
      }
      try {
        window.history.replaceState(null, '', window.location.pathname);
      } catch (e) {
        console.warn('[UpdatePassword] Failed to clean URL hash:', e);
      }
      return () => {
        isMounted = false;
      };
    }

    // Supabase emits PASSWORD_RECOVERY event when it processes the recovery token
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (!isMounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoverySession(true);
        setIsCheckingSession(false);
      }
    });

    // Fallback: check if there's an existing authenticated session (non-recovery)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (!session) {
        // No session at all — link is invalid or expired
        setMessage({
          text: 'This password reset link is invalid or has expired. Please request a new one.',
          type: 'error'
        });
      }
      // Even if a session exists, isRecoverySession stays false unless event fires
      setIsCheckingSession(false);
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 🔴 Security gate: block password change from non-recovery sessions.
    // Prevents a lab bystander from changing a logged-in user's password.
    if (!isRecoverySession) {
      setMessage({
        text: 'Blocked: Password updates require arriving via a verified email reset link. Please check your email or request a new reset link.',
        type: 'error'
      });
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setMessage({ text: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`, type: 'error' });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }

    if (strength.score < 2) {
      setMessage({ text: 'Please choose a stronger password with uppercase letters, numbers, or symbols.', type: 'error' });
      return;
    }

    setIsLoading(true);
    setMessage({ text: '', type: '' });

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage({ text: error.message, type: 'error' });
      setIsLoading(false);
    } else {
      setMessage({ text: 'Password updated securely! Signing out all sessions...', type: 'success' });
      // scope: 'global' revokes all refresh tokens across every device/browser
      await supabase.auth.signOut({ scope: 'global' });
      navigate('/login_successful');
    }
  };

  // Show verification spinner while checking session pedigree
  if (isCheckingSession) {
    return (
      <main className="auth-section" id="main-content">
        <div className="auth-container">
          <p style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>
            Verifying recovery credentials…
          </p>
        </div>
      </main>
    );
  }



  return (
    <main className="auth-section" id="main-content">
      <div className="auth-container">
        <Link to="/" className="logo" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }} title="Back to Innovation Lab Home">
          <img src="/IMAGES/cih-removebg-preview.png" alt="CIH Logo" style={{ height: '36px', objectFit: 'contain' }} />
          <span style={{ fontSize: '1.4rem', fontWeight: '700', fontFamily: "'Outfit', sans-serif" }}>Inventory</span>
        </Link>
        <div className="auth-header">
          <h1>Update Password</h1>
          <p>Please enter your new password below.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ position: 'relative' }}>
            <label htmlFor="update-password" className="sr-only">New Password</label>
            <input 
              type={showPassword ? 'text' : 'password'} 
              id="update-password"
              aria-label="New Password"
              required 
              placeholder="New Password" 
              minLength={PASSWORD_MIN_LENGTH}
              style={{ width: '100%', paddingRight: '46px', boxSizing: 'border-box' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="toggle-password-btn"
              onClick={() => setShowPassword(prev => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                borderRadius: '6px',
                transition: 'color 0.2s ease, background-color 0.2s ease',
                userSelect: 'none'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                {showPassword ? 'visibility' : 'visibility_off'}
              </span>
            </button>
          </div>

          {/* Password strength indicator */}
          {password && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                {[...Array(5)].map((_, i) => (
                  <div key={i} style={{
                    flex: 1,
                    height: '4px',
                    borderRadius: '2px',
                    background: i < strength.score ? strength.color : '#e2e8f0',
                    transition: 'background 0.3s ease'
                  }} />
                ))}
              </div>
              <span style={{ fontSize: '0.78rem', color: strength.color, fontWeight: 600 }}>
                {strength.label}
              </span>
            </div>
          )}

          <div className="form-group" style={{ position: 'relative' }}>
            <label htmlFor="update-confirm-password" className="sr-only">Confirm New Password</label>
            <input 
              type={showPassword ? 'text' : 'password'} 
              id="update-confirm-password"
              aria-label="Confirm New Password"
              required 
              placeholder="Confirm New Password"
              minLength={PASSWORD_MIN_LENGTH}
              style={{ width: '100%', paddingRight: '46px', boxSizing: 'border-box' }}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button
              type="button"
              className="toggle-password-btn"
              onClick={() => setShowPassword(prev => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                borderRadius: '6px',
                transition: 'color 0.2s ease, background-color 0.2s ease',
                userSelect: 'none'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                {showPassword ? 'visibility' : 'visibility_off'}
              </span>
            </button>
            {confirmPassword && password !== confirmPassword && (
              <span style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                Passwords do not match
              </span>
            )}
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
            value={message.type === 'success' ? 'Success ✓' : (isLoading ? 'Updating...' : 'Set New Password')} 
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
