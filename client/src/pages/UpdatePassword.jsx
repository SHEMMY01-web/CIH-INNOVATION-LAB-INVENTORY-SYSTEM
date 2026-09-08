import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import '../styles/forgot.css';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ text: '', type: '' });

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage({ text: error.message, type: 'error' });
      setIsLoading(false);
    } else {
      setMessage({ text: 'Password updated securely!', type: 'success' });
      
      // CRITICAL SECURITY FIX: immediately sign out to prevent auto-login
      await supabase.auth.signOut();

      // Redirect to success page, which prompts manual login
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
