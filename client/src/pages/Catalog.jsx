import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import ItemCard from '../components/ItemCard';
import Pagination from '../components/Pagination';
import Footer from '../components/Footer';
import { smartSearch } from '../utils/searchUtils';
import { isLabTool, isLabAsset, enrichItemsWithType } from '../utils/inventoryClassifier';
import '../styles/landing.css';

export default function Catalog() {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  useEffect(() => {
    const fetchAllItems = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAllItems(enrichItemsWithType(data));
      }
      setLoading(false);
    };

    fetchAllItems();
  }, []);

  // Reset pagination when search or filter category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filter]);

  // Filter by category
  const categoryItems = useMemo(() => {
    return allItems.filter(item => {
      const t = (item.type || '').toLowerCase();
      if (filter === 'assets') return t.startsWith('asset:') || isLabAsset(item);
      if (filter === 'tools') return t.startsWith('tool:') || isLabTool(item);
      if (filter === 'general') return !t.startsWith('asset:') && !t.startsWith('tool:') && !isLabAsset(item) && !isLabTool(item);
      return true;
    });
  }, [allItems, filter]);

  const assetCount = useMemo(() => allItems.filter(i => (i.type || '').toLowerCase().startsWith('asset:') || isLabAsset(i)).length, [allItems]);
  const toolCount = useMemo(() => allItems.filter(i => (i.type || '').toLowerCase().startsWith('tool:') || isLabTool(i)).length, [allItems]);
  const generalCount = useMemo(() => Math.max(0, allItems.length - assetCount - toolCount), [allItems, assetCount, toolCount]);

  // High-performance ambiguity-resilient fuzzy search with top match bubbling
  const filteredItems = useMemo(() => {
    return smartSearch(categoryItems, searchQuery, item => [
      item.item_name || '',
      item.model || '',
      item.type || ''
    ]);
  }, [categoryItems, searchQuery]);

  // Paginated slice
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  return (
    <div className="catalog-page">
      {/* ─── Navigation ────────────────────────────────────── */}
      <nav className="landing-nav">
        <div className="nav-container">
          <Link to="/" className="logo-area" style={{ textDecoration: 'none' }}>
            <img src="/IMAGES/cih-footer-logo.png" alt="CIH Logo" className="landing-logo" />
            <span className="logo-text">Innovation Lab Inventory</span>
          </Link>
          <div className="nav-links">
            <Link to="/">Home</Link>
            <Link to="/#about">About Us</Link>
            <Link to="/#projects">Projects</Link>
          </div>
          <div className="nav-actions">
            <Link to="/login" className="login-btn-nav">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>login</span> Staff Login
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Catalog Hero Banner with user gradient ───────── */}
      <div className="catalog-hero-banner">
        <div className="catalog-hero-bg">
          <picture>
            <source srcSet="/IMAGES/hero_bg_lab.webp" type="image/webp" />
            <img 
              src="/IMAGES/hero_bg_lab.png" 
              alt="CIH Innovation Lab Equipment Catalog" 
              onError={(e) => { e.currentTarget.src = '/IMAGES/hero-bg.jpg'; }}
            />
          </picture>
        </div>
        <div className="catalog-hero-overlay"></div>
        <div className="section-container catalog-hero-inner">
          <h1 className="catalog-hero-title">
            Innovation Lab <span className="accent-orange">Catalog</span>
          </h1>
          <p className="catalog-hero-desc">
            Explore verified components, microcontrollers, robotics hardware, sensors, heavy assets, and tools.
          </p>
        </div>
      </div>

      {/* ─── Catalog Section ──────────────────────────────── */}
      <section className="catalog-section" style={{ paddingTop: '40px', minHeight: '60vh' }}>
        <div className="section-container">
          <div className="catalog-top-bar">
            <div className="catalog-controls" style={{ width: '100%' }}>
              <div className="search-container">
                <span className="material-symbols-outlined search-icon">search</span>
                <input 
                  type="text" 
                  placeholder="Search catalog by item name or keyword (e.g. 'we-do', 'soil sensor', 'uno')..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button 
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="clear-search-btn"
                    title="Clear search"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                  </button>
                )}
              </div>

              <div className="filter-chips">
                <button 
                  className={`chip ${filter === 'all' ? 'active' : ''}`} 
                  onClick={() => setFilter('all')}
                >
                  All Items ({allItems.length})
                </button>
                <button 
                  className={`chip ${filter === 'general' ? 'active' : ''}`} 
                  onClick={() => setFilter('general')}
                >
                  General Items ({generalCount})
                </button>
                <button 
                  className={`chip ${filter === 'assets' ? 'active' : ''}`} 
                  onClick={() => setFilter('assets')}
                >
                  Heavy Assets ({assetCount})
                </button>
                <button 
                  className={`chip ${filter === 'tools' ? 'active' : ''}`} 
                  onClick={() => setFilter('tools')}
                >
                  Lab Tools ({toolCount})
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="catalog-grid skeleton-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-img"></div>
                  <div className="skeleton-body">
                    <div className="skeleton-line short"></div>
                    <div className="skeleton-line"></div>
                    <div className="skeleton-line medium"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="catalog-grid">
                {paginatedItems.map(item => (
                  <ItemCard key={item.id} item={item} />
                ))}
                
                {filteredItems.length === 0 && (
                  <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                    <span className="material-symbols-outlined">search_off</span>
                    <h3>No items found</h3>
                    <p>Try adjusting your search terms or selecting a different category filter.</p>
                  </div>
                )}
              </div>

              {filteredItems.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  pageSize={pageSize}
                  totalRecords={filteredItems.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setCurrentPage(1);
                  }}
                  pageSizeOptions={[8, 12, 24, 48]}
                />
              )}
            </>
          )}
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────── */}
      <Footer />
    </div>
  );
}
