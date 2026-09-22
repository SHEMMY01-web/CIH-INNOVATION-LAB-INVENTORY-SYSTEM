import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Topbar({ onSearch }) {
  const { user } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="user-greeting-name">
          {getGreeting()} 
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '28px', color: 'var(--accent-color)', marginLeft: '8px' }}>waving_hand</span>
        </h1>
        <p className="user-greeting-time">{formattedDate}</p>
      </div>

      <div className="topbar-right">
        {onSearch && (
          <div className="search-box">
            <span className="material-symbols-outlined search-icon" style={{ verticalAlign: 'middle', fontSize: '20px' }}>search</span>
            <input 
              type="text" 
              placeholder="Search" 
              aria-label="Search records"
              name="search"
              onChange={onSearch} 
            />
          </div>
        )}

        <div className="user-profile">
          <div className="avatar"></div>
          <div className="user-info">
            <strong className="user-info-name">{user?.email || 'User'}</strong>
            <span className="user-info-role">Staff</span>
          </div>
        </div>
      </div>
    </header>
  );
}
