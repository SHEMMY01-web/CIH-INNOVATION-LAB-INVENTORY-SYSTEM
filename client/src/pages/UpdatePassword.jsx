import React, { useState, useMemo } from 'react';
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
    { label: 'Fair', color: '#eab308' },
    { label: 'Good', color: '#22c55e' },
    { label: 'Strong', color: '#16a34a' },
    { label: 'Excellent', color: '#059669' }
  ];

  return { score, ...levels[Math.min(score, levels.length - 1)] };
}

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();

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
      setMessage({ text: 'Password updated securely!', type: 'success' });
      await supabase.auth.signOut();
      navigate('/login_successful');
    }
  };

  return (
    <section className="auth-section">
      <div className="auth-container">
        <div className="auth-header">
          <h1>Update Password</h1>
          <p>Please enter your new password below.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ position: 'relative' }}>
            <input 
              type={showPassword ? 'text' : 'password'}
              required 
              placeholder="New Password" 
              minLength={PASSWORD_MIN_LENGTH}
              style={{ width: '100%', paddingRight: '40px', boxSizing: 'border-box' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span 
              className="material-symbols-outlined toggle-password" 
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#666', userSelect: 'none' }}
            >
              {showPassword ? 'visibility' : 'visibility_off'}
            </span>
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

          <div className="form-group">
            <input 
              type={showPassword ? 'text' : 'password'}
              required 
              placeholder="Confirm New Password"
              minLength={PASSWORD_MIN_LENGTH}
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
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
    </section>
  );
}
