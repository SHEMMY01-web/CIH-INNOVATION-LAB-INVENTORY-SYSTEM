import React, { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ImageLightbox from '../components/ImageLightbox';
import { isLabTool, isLabAsset, classifyItem, enrichItemsWithType } from '../utils/inventoryClassifier';
import '../styles/dashboard.css';

function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

function getItemImage(item) {
  if (!item) return null;
  if (item.image_url) return item.image_url;
  const slug = slugify(item.item_name);
  return slug ? `/IMAGES/items/${slug}.webp` : null;
}

export default function Dashboard() {
  const { user, isLoggingOut } = useAuth();
  
  const [items, setItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [lightboxItem, setLightboxItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    qtyInHand: 0,
    toBeReceived: 0,
    suppliers: 0,
    categories: 0,
    totalItems: 0,
    itemsPending: 0,
    totalAssets: 0,
    assetsPending: 0
  });

  useEffect(() => {
    if (!user) return;
    
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch All Items
        const { data: allItems } = await supabase
          .from('items')
          .select('*')
          .order('created_at', { ascending: false });

        if (!data) return;

        // Filter out any items assigned to a project for general stats
        const generalItems = (data || []).filter(i => !i.project || i.project.trim() === '');
        const enrichedItems = enrichItemsWithType(generalItems);

        const itemsData = enrichedItems.filter(i => {
          const t = (i.type || '').toLowerCase();
          return !t.startsWith('asset:') && !t.startsWith('tool:') && !isLabAsset(i) && !isLabTool(i);
        });

        const assetsData = enrichedItems.filter(i => {
          const t = (i.type || '').toLowerCase();
          return t.startsWith('asset:') || isLabAsset(i);
        });

        setItems(itemsData);
        setAssets(assetsData);

        // Dynamic stats calculation matching authentic lab inventory
        const totalStock = generalItems.reduce((s, r) => s + (r.amount ?? 0), 0);
        const totalToBeReceived = generalItems.reduce((s, r) => s + (r.to_be_received ?? 0), 0);
        const uniqueSuppliers = new Set(generalItems.map(i => i.supplier).filter(Boolean)).size;
        const uniqueCategories = new Set(enrichedItems.map(i => classifyItem(i)).filter(Boolean)).size;

        const itemsPending = itemsData.reduce((s, r) => s + (r.to_be_received ?? 0), 0);
        const assetsPending = assetsData.reduce((s, r) => s + (r.to_be_received ?? 0), 0);

        setStats({
          qtyInHand: totalStock,
          toBeReceived: totalToBeReceived,
          suppliers: uniqueSuppliers,
          categories: uniqueCategories,
          totalItems: itemsData.length,
          itemsPending: itemsPending,
          totalAssets: assetsData.length,
          assetsPending: assetsPending
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  if (!user) {
    return <Navigate to={isLoggingOut ? "/" : "/login"} replace />;
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <Topbar />
        
        <div className="dashboard-grid">
          {/* Tables Row */}
          <div className="tables-row">
            {/* Item List */}
            <div className="card table-card">
              <div className="card-header">
                <h3>Item List</h3>
                <Link to="/items" className="view-all">View All</Link>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Image</th>
                    <th>Availability</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={`skel-d-item-${idx}`}>
                        <td><span className="skeleton-box skeleton-text" style={{ width: '70%' }}></span></td>
                        <td><span className="skeleton-box skeleton-img" style={{ width: '36px', height: '36px' }}></span></td>
                        <td><span className="skeleton-box skeleton-badge"></span></td>
                        <td><span className="skeleton-box skeleton-text" style={{ width: '40%' }}></span></td>
                      </tr>
                    ))
                  ) : (
                    <>
                      {items.slice(0, 5).map(item => {
                        const imgSrc = getItemImage(item);
                        const isAvail = item.amount > 0 && item.status !== 'Out of Stock' && item.status !== 'unavailable';

                        return (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 500 }}>{item.item_name}</td>
                            <td>
                              {imgSrc ? (
                                <img 
                                  src={imgSrc} 
                                  alt={item.item_name} 
                                  width="36" 
                                  height="36" 
                                  style={{ objectFit: 'contain', background: '#fff', borderRadius: '4px', border: '1px solid #e2e8f0', cursor: 'pointer' }} 
                                  onClick={() => setLightboxItem(item)}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>image</span>
                              )}
                            </td>
                            <td>
                              <span className={`status-badge ${isAvail ? 'available' : 'unavailable'}`}>
                                {isAvail ? 'Available' : 'Out of Stock'}
                              </span>
                            </td>
                            <td>{item.amount} {item.store || 'pcs'}</td>
                          </tr>
                        );
                      })}
                      {items.length === 0 && (
                        <tr><td colSpan="4" style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>No items found</td></tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Asset List */}
            <div className="card table-card">
              <div className="card-header">
                <h3>Asset List</h3>
                <Link to="/assets" className="view-all">View All</Link>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Asset Name</th>
                    <th>Image</th>
                    <th>Availability</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={`skel-d-asset-${idx}`}>
                        <td><span className="skeleton-box skeleton-text" style={{ width: '70%' }}></span></td>
                        <td><span className="skeleton-box skeleton-img" style={{ width: '36px', height: '36px' }}></span></td>
                        <td><span className="skeleton-box skeleton-badge"></span></td>
                        <td><span className="skeleton-box skeleton-text" style={{ width: '40%' }}></span></td>
                      </tr>
                    ))
                  ) : (
                    <>
                      {assets.slice(0, 5).map(item => {
                        const imgSrc = getItemImage(item);
                        const isAvail = item.amount > 0 && item.status !== 'Out of Stock' && item.status !== 'unavailable';

                        return (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 500 }}>{item.item_name}</td>
                            <td>
                              {imgSrc ? (
                                <img 
                                  src={imgSrc} 
                                  alt={item.item_name} 
                                  width="36" 
                                  height="36" 
                                  style={{ objectFit: 'contain', background: '#fff', borderRadius: '4px', border: '1px solid #e2e8f0', cursor: 'pointer' }} 
                                  onClick={() => setLightboxItem(item)}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>image</span>
                              )}
                            </td>
                            <td>
                              <span className={`status-badge ${isAvail ? 'available' : 'unavailable'}`}>
                                {isAvail ? 'Available' : 'Out of Stock'}
                              </span>
                            </td>
                            <td>{item.amount} {item.store || 'pcs'}</td>
                          </tr>
                        );
                      })}
                      {assets.length === 0 && (
                        <tr><td colSpan="4" style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>No assets found</td></tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Cards Row */}
          <div className="summary-row">
            <div className="card summary-card">
              <h3>Item Summary</h3>
              <div className="summary-stats">
                <div className="stat">
                  <div className="icon blue"><span className="material-symbols-outlined">inventory_2</span></div>
                  <h4>{loading ? <span className="skeleton-box skeleton-text" style={{ width: '36px', height: '22px', display: 'inline-block' }}></span> : stats.qtyInHand}</h4>
                  <p>Quantity in Hand</p>
                </div>
                <div className="stat">
                  <div className="icon orange"><span className="material-symbols-outlined">pending_actions</span></div>
                  <h4>{loading ? <span className="skeleton-box skeleton-text" style={{ width: '36px', height: '22px', display: 'inline-block' }}></span> : stats.toBeReceived}</h4>
                  <p>To be received</p>
                </div>
              </div>
            </div>

            <div className="card summary-card">
              <h3>Product Summary</h3>
              <div className="summary-stats">
                <div className="stat">
                  <div className="icon blue"><span className="material-symbols-outlined">person</span></div>
                  <h4>{loading ? <span className="skeleton-box skeleton-text" style={{ width: '36px', height: '22px', display: 'inline-block' }}></span> : stats.suppliers}</h4>
                  <p>Number of Suppliers</p>
                </div>
                <div className="stat">
                  <div className="icon orange"><span className="material-symbols-outlined">category</span></div>
                  <h4>{loading ? <span className="skeleton-box skeleton-text" style={{ width: '36px', height: '22px', display: 'inline-block' }}></span> : stats.categories}</h4>
                  <p>Number of Categories</p>
                </div>
              </div>
            </div>

            <div className="card summary-card">
              <h3>Total items</h3>
              <div className="summary-stats">
                <div className="stat">
                  <div className="icon blue"><span className="material-symbols-outlined">inventory_2</span></div>
                  <h4>{loading ? <span className="skeleton-box skeleton-text" style={{ width: '36px', height: '22px', display: 'inline-block' }}></span> : stats.totalItems}</h4>
                  <p>Total Number of Items</p>
                </div>
                <div className="stat">
                  <div className="icon orange"><span className="material-symbols-outlined">pending_actions</span></div>
                  <h4>{loading ? <span className="skeleton-box skeleton-text" style={{ width: '36px', height: '22px', display: 'inline-block' }}></span> : stats.itemsPending}</h4>
                  <p>To be received</p>
                </div>
              </div>
            </div>

            <div className="card summary-card">
              <h3>Total assets</h3>
              <div className="summary-stats">
                <div className="stat">
                  <div className="icon blue"><span className="material-symbols-outlined">leaderboard</span></div>
                  <h4>{loading ? <span className="skeleton-box skeleton-text" style={{ width: '36px', height: '22px', display: 'inline-block' }}></span> : stats.totalAssets}</h4>
                  <p>Total Number of Assets</p>
                </div>
                <div className="stat">
                  <div className="icon orange"><span className="material-symbols-outlined">pending_actions</span></div>
                  <h4>{loading ? <span className="skeleton-box skeleton-text" style={{ width: '36px', height: '22px', display: 'inline-block' }}></span> : stats.assetsPending}</h4>
                  <p>To be received</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Image Lightbox */}
      <ImageLightbox
        isOpen={Boolean(lightboxItem)}
        onClose={() => setLightboxItem(null)}
        item={lightboxItem}
        imageUrl={getItemImage(lightboxItem)}
      />
    </div>
  );
}
