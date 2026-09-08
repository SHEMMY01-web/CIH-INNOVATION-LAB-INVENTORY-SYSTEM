import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
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
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: 'rgba(28, 33, 223, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#1c21df' }}>
            explore_off
          </span>
        </div>

        <h1 style={{ fontSize: '3rem', fontWeight: 800, margin: '0', color: '#1c21df' }}>404</h1>
        <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: '8px 0 4px', color: '#0f172a' }}>
          Page Not Found
        </p>
        <p style={{ fontSize: '0.92rem', color: '#64748b', margin: '0 0 28px', lineHeight: 1.6 }}>
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Link
            to="/"
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              border: 'none',
              background: '#1c21df',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(28, 33, 223, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>home</span>
            Go Home
          </Link>
          <Link
            to="/dashboard"
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#334155',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>dashboard</span>
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
