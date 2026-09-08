import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Sidebar() {
  const { signOut } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('app-theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/IMAGES/cih-footer-logo.png" alt="Logo" className="sidebar-logo" />
        <h2>Inventory</h2>
      </div>

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

      <div className="theme-toggle">
        <button 
          type="button"
          className={`toggle-btn ${theme === 'light' ? 'active' : ''}`}
          onClick={() => handleThemeChange('light')}
        >
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px', marginRight: '5px' }}>light_mode</span>Light
        </button>
        <button 
          type="button"
          className={`toggle-btn ${theme === 'dark' ? 'active' : ''}`}
          onClick={() => handleThemeChange('dark')}
        >
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px', marginRight: '5px' }}>dark_mode</span>Dark
        </button>
      </div>

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
