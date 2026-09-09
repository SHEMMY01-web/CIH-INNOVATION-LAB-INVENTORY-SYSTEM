import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProtectedRoute - Centralized authentication guard for administrative views.
 * Prevents unauthorized mounting, data fetching, or layout flashes.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading, isLoggingOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '16px',
        background: 'var(--bg-color, #ffffff)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e2e8f0',
          borderTopColor: '#1c21df',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
          Verifying credentials...
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    // If user is explicitly logging out, redirect to home; otherwise preserve intended location
    if (isLoggingOut) {
      return <Navigate to="/" replace />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
