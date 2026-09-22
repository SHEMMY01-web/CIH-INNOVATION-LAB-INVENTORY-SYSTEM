import React, { useEffect, useState, useMemo, useDeferredValue } from 'react';
import { supabase } from '../lib/supabase';
import ItemCard from '../components/ItemCard';
import Pagination from '../components/Pagination';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { smartSearch } from '../utils/searchUtils';
import { isLabTool, isLabAsset, enrichItemsWithType } from '../utils/inventoryClassifier';
import '../styles/landing.css';

export default function Catalog() {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // React 18 concurrent primitive: keeps typing responsive by deferring heavy fuzzy calculations
  const deferredSearch = useDeferredValue(searchQuery);

  useEffect(() => {
    let isMounted = true;

    const fetchAllItems = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const { data, error } = await supabase
          .from('items')
          .select('id, item_name, model, type, amount, store, status, image_url, project')
          .order('created_at', { ascending: false });

        if (isMounted) {
          if (!error && data) {
            setAllItems(enrichItemsWithType(data));
          } else if (error) {
            setFetchError('Unable to load the catalog. Please check your connection and try again.');
          }
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('[Catalog] Error loading items:', err);
          setFetchError('Unable to load the catalog. Please check your connection and try again.');
          setLoading(false);
        }
      }
    };

    fetchAllItems();

    return () => {
      isMounted = false;
    };
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

  // High-performance ambiguity-resilient fuzzy search with deferred query evaluation
  const filteredItems = useMemo(() => {
    return smartSearch(categoryItems, deferredSearch, item => [
      item.item_name || '',
      item.model || '',
      item.type || ''
    ]);
  }, [categoryItems, deferredSearch]);

  // Paginated slice
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  return (
    <div className="catalog-page">
      {/* ─── Navigation ────────────────────────────────────── */}
      <Navbar />

      <main id="main-content">
        {/* ─── Catalog Hero Banner with user gradient ───────── */}
        <div className="catalog-hero-banner">
          <div className="catalog-hero-bg">
            <picture>
              <source srcSet="/IMAGES/hero_bg_lab.webp" type="image/webp" />
              <img 
                src="/IMAGES/hero_bg_lab.png" 
                alt="CIH Innovation Lab Equipment Catalog" 
                fetchPriority="high"
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
                    id="catalog-search-input"
                    aria-label="Search catalog by equipment name or keyword"
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
                  aria-pressed={filter === 'all'}
                >
                  All Items ({allItems.length})
                </button>
                <button 
                  className={`chip ${filter === 'general' ? 'active' : ''}`} 
                  onClick={() => setFilter('general')}
                  aria-pressed={filter === 'general'}
                >
                  General Items ({generalCount})
                </button>
                <button 
                  className={`chip ${filter === 'assets' ? 'active' : ''}`} 
                  onClick={() => setFilter('assets')}
                  aria-pressed={filter === 'assets'}
                >
                  Heavy Assets ({assetCount})
                </button>
                <button 
                  className={`chip ${filter === 'tools' ? 'active' : ''}`} 
                  onClick={() => setFilter('tools')}
                  aria-pressed={filter === 'tools'}
                >
                  Lab Tools ({toolCount})
                </button>
              </div>
            </div>
          </div>

          {fetchError ? (
            <div className="empty-state" role="alert" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ef4444', marginBottom: '12px' }}>wifi_off</span>
              <h3>Failed to Load Catalog</h3>
              <p style={{ color: '#64748b', marginBottom: '20px' }}>{fetchError}</p>
              <button 
                className="btn-primary" 
                onClick={() => { setFetchError(null); setLoading(true); window.location.reload(); }}
                style={{ padding: '10px 24px', borderRadius: '8px' }}
              >
                Retry
              </button>
            </div>
          ) : loading ? (
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
      </main>

      {/* ─── Footer ────────────────────────────────────────── */}
      <Footer />
    </div>
  );
}
