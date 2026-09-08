import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import '../styles/login.css'; // Or whatever global styles for auth

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        <div className="logo">
          <img src="/IMAGES/cih-removebg-preview.png" alt="CIH Logo" />
          <h1>Inventory</h1>
        </div>
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
                type="password" 
                id="login-password" 
                required 
                placeholder="Password" 
                style={{ width: '100%', paddingRight: '40px', boxSizing: 'border-box' }}
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
              />
            </div>
            <div className="forgot" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <a href="/forgot_password">Forgot Password?</a>
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
