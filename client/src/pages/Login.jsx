import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import '../styles/login.css'; // Or whatever global styles for auth

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // If already logged in, redirect
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      navigate('/dashboard');
    }
    
    setLoading(false);
  };

  return (
    <section className="auth-section">
      <div className="auth-container form_section">
        <Link to="/" className="logo" style={{ textDecoration: 'none', color: 'inherit' }} title="Back to Innovation Lab Home">
          <img src="/IMAGES/cih-removebg-preview.png" alt="CIH Logo" />
          <h1>Inventory</h1>
        </Link>
        <div className="auth-header welcome">
          <h1>Welcome,</h1>
          <p>Please Login here</p>
        </div>
        
        {error && <p id="login-message" style={{color: '#e53935', fontSize: '0.9rem', minHeight: '18px', margin: '0 0 8px 0'}}>{error}</p>}

        <div>
          <form id="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <input 
                type="email" 
                id="login-email" 
                required 
                placeholder="Email"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
              />
            </div>
            <div className="form-group" style={{ position: 'relative' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                id="login-password" 
                required 
                placeholder="Password" 
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
            <div className="forgot" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <Link to="/forgot_password">Forgot Password?</Link>
            </div>
            
            <input 
              type="submit" 
              id="login-btn" 
              className="btn-primary login-btn" 
              value={loading ? 'Logging in...' : 'Login'} 
              disabled={loading}
            />
          </form>
        </div>
      </div>
    </section>
  );
}
