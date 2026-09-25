import React, { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function Sidebar() {
  const { signOut } = useAuth();
  const [pendingReqCount, setPendingReqCount] = useState(0);

  useEffect(() => {
    // Clean up any previously stored dark theme attribute
    document.documentElement.removeAttribute('data-theme');
    try {
      localStorage.removeItem('app-theme');
    } catch (e) {
      // Ignore storage errors
    }

    let isMounted = true;
    const fetchPendingCount = async () => {
      try {
        const { count, error } = await supabase
          .from('item_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        
        let total = 0;
        if (!error && typeof count === 'number') {
          total = count;
        }
        try {
          const localQueue = JSON.parse(localStorage.getItem('cih_pending_requisitions') || '[]');
          total += localQueue.filter(r => r.status === 'pending').length;
        } catch (_) {}

        if (isMounted) setPendingReqCount(total);
      } catch (_) {}
    };

    fetchPendingCount();

    // Realtime channel for pending count updates across admins
    const channel = supabase
      .channel('realtime:sidebar_requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_requests' },
        () => {
          if (isMounted) fetchPendingCount();
        }
      )
      .subscribe();

    const handleFocus = () => {
      if (isMounted) fetchPendingCount();
    };
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(() => {
      if (isMounted && document.visibilityState === 'visible') fetchPendingCount();
    }, 25000);

    return () => { 
      isMounted = false; 
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
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
        <NavLink to="/tools" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="material-symbols-outlined nav-icon" style={{ verticalAlign: 'middle' }}>build</span> Tools
        </NavLink>
        <NavLink to="/assets" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="material-symbols-outlined nav-icon" style={{ verticalAlign: 'middle' }}>leaderboard</span> Assets
        </NavLink>
        <NavLink to="/projects" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="material-symbols-outlined nav-icon" style={{ verticalAlign: 'middle' }}>folder</span> Project
        </NavLink>
        <NavLink to="/requests" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="material-symbols-outlined nav-icon" style={{ verticalAlign: 'middle' }}>sync_alt</span>
          <span style={{ flex: 1 }}>Requests & Orders</span>
          {pendingReqCount > 0 && (
            <span style={{
              background: '#ff5421',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '1px 7px',
              borderRadius: '10px',
              marginLeft: 'auto'
            }} title={`${pendingReqCount} pending online equipment requisitions`}>
              {pendingReqCount}
            </span>
          )}
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
