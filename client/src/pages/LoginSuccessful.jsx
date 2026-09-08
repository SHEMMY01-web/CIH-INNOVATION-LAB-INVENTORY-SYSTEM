import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/forgot.css';

export default function LoginSuccessful() {
  return (
    <section className="auth-section">
      <div className="auth-container" style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '20px', color: '#2e7d32' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '64px' }}>check_circle</span>
        </div>
        
        <div className="auth-header">
          <h1>Success!</h1>
          <p>
            Your password has been successfully updated.
          </p>
        </div>

        <Link to="/login" className="btn-primary" style={{ display: 'block', textDecoration: 'none', textAlign: 'center', marginTop: '20px' }}>
          Go to Login
        </Link>
      </div>
    </section>
  );
}
