import React, { useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Sidebar() {
  const { signOut } = useAuth();

  useEffect(() => {
    // Clean up any previously stored dark theme attribute
    document.documentElement.removeAttribute('data-theme');
    try {
      localStorage.removeItem('app-theme');
    } catch (e) {
      // Ignore storage errors
    }
  }, []);

  return (
    <aside className="sidebar">
      <Link to="/" className="sidebar-header" style={{ textDecoration: 'none', color: 'inherit' }} title="Back to Innovation Lab Home">
        <img src="/IMAGES/cih-footer-logo.png" alt="CIH Logo" className="sidebar-logo" />
        <h2>Inventory</h2>
      </Link>

      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="material-symbols-outlined nav-icon" style={{ verticalAlign: 'middle' }}>dashboard</span> Dashboard
        </NavLink>
        <NavLink to="/items" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="material-symbols-outlined nav-icon" style={{ verticalAlign: 'middle' }}>inventory</span> Items
        </NavLink>
        <NavLink to="/assets" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="material-symbols-outlined nav-icon" style={{ verticalAlign: 'middle' }}>leaderboard</span> Assets
        </NavLink>
        <NavLink to="/projects" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="material-symbols-outlined nav-icon" style={{ verticalAlign: 'middle' }}>folder</span> Project
        </NavLink>
        <NavLink to="/requests" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="material-symbols-outlined nav-icon" style={{ verticalAlign: 'middle' }}>sync_alt</span> Requested & Returned
        </NavLink>
        <NavLink to="/grn-report" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="material-symbols-outlined nav-icon" style={{ verticalAlign: 'middle' }}>description</span> GRN Report
        </NavLink>
      </nav>

      <button 
        type="button" 
        className="logout-btn" 
        onClick={async (e) => {
          e.preventDefault();
          await signOut();
        }}
      >
        <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px', marginRight: '5px' }}>logout</span>Logout
      </button>
    </aside>
  );
}
