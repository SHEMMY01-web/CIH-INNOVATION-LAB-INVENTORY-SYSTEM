import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ItemCard from '../components/ItemCard';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/landing.css';

export default function Home() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ items: 0, assets: 0, projects: 0, tools: 0 });

  // Comments state
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentName, setCommentName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    document.body.classList.add('landing-body');
    return () => document.body.classList.remove('landing-body');
  }, []);

  useEffect(() => {
    const fetchPreviewItems = async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .limit(4);

      if (!error && data) {
        setItems(data);
      }
      setLoading(false);
    };

    const fetchStats = async () => {
      const { data: allItems } = await supabase.from('items').select('*');
      const { data: projects } = await supabase.from('projects').select('id');
      if (allItems) {
        const generalItems = allItems.filter(i => {
          const t = (i.type || '').toLowerCase();
          return !t.startsWith('asset:') && !t.startsWith('tool:');
        });
        const assets = allItems.filter(i => (i.type || '').toLowerCase().startsWith('asset:'));
        const tools = allItems.filter(i => (i.type || '').toLowerCase().startsWith('tool:'));
        setStats({
          items: generalItems.length,
          assets: assets.length,
          projects: projects?.length > 0 ? projects.length : 3,
          tools: tools.length > 0 ? tools.length : 15
        });
      }
    };

    const fetchComments = async () => {
      setCommentsLoading(true);
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setComments(data);
      }
      setCommentsLoading(false);
    };

    fetchPreviewItems();
    fetchStats();
    fetchComments();
  }, []);

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || commentText.length > 500) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('comments')
        .insert([{ name: commentName.trim() || 'Anonymous', comment: commentText.trim() }]);

      if (error) throw error;

      setMessage({ text: 'Comment posted successfully!', type: 'success' });
      setCommentName('');
      setCommentText('');

      // Re-fetch comments
      const { data } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setComments(data);

      setTimeout(() => setMessage({ text: '', type: '' }), 5000);
    } catch (err) {
      setMessage({ text: 'Something went wrong while posting your comment.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* ─── Navigation ────────────────────────────────────── */}
      <Navbar />

      {/* ─── Hero Section with Background Image + Overlay ──── */}
      <header className="hero-section" id="home">
        <div className="hero-bg-image">
          <picture>
            <source srcSet="/IMAGES/hero-bg.webp" type="image/webp" />
            <img 
              src="/IMAGES/hero-bg.jpg" 
              alt="Community Innovation Hub Lab" 
              aria-hidden="true" 
              onError={(e) => { e.currentTarget.src = '/IMAGES/hero-bg.jpg'; }}
            />
          </picture>
        </div>
        <div className="hero-overlay"></div>

        <div className="hero-content">
          <div className="hero-badge">
            <span className="dot"></span>
            Community Innovation Hub
          </div>
          <h1 className="hero-title">
            Welcome to the <span className="highlight">Innovation Lab</span>
          </h1>
          <p className="hero-subtitle">
            Discover tools, assets, and resources to bring your next big idea to life.
            Explore our catalog, collaborate with peers, and build the future.
          </p>
          <div className="hero-actions">
            <a href="#items" className="hero-btn-primary">
              Browse Catalog
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span>
            </a>
            <Link to="/login" className="hero-btn-secondary">
              Staff Portal
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>lock_open</span>
            </Link>
          </div>
        </div>

        <div className="hero-scroll-indicator">
          <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>expand_more</span>
          Scroll to explore
        </div>
      </header>

      {/* ─── Stats Banner ──────────────────────────────────── */}
      <section className="stats-banner">
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-number">{stats.items}</div>
            <div className="stat-label">General Items</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">{stats.assets}</div>
            <div className="stat-label">Assets Tracked</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">{stats.tools}</div>
            <div className="stat-label">Tools Available</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">{stats.projects}</div>
            <div className="stat-label">Active Projects</div>
          </div>
        </div>
      </section>

      {/* ─── About Us Section ──────────────────────────────── */}
      <section id="about" className="about-section">
        <div className="section-container">
          <div className="about-grid">
            <div className="about-image">
              <img 
                src="/IMAGES/about-team.webp" 
                alt="Team collaborating at CIH Innovation Lab" 
                loading="lazy"
                onError={(e) => { e.currentTarget.src = '/IMAGES/empty-state.png'; }}
              />
            </div>
            <div className="about-text">
              <h2 className="section-title">About <span className="accent">Us</span></h2>
              <p>
                The CIH Innovation Lab is a hub for creativity, engineering, and problem-solving.
                We provide state-of-the-art equipment, software, and a collaborative environment
                for innovators to thrive.
              </p>
              <h3>How it works</h3>
              <ul className="about-features">
                <li>
                  <div className="feature-icon">
                    <span className="material-symbols-outlined">explore</span>
                  </div>
                  <div>
                    <strong>Discover Resources</strong>
                    <p>Browse our extensive catalog of general items, advanced tools, and heavy assets available for borrowing.</p>
                  </div>
                </li>
                <li>
                  <div className="feature-icon">
                    <span className="material-symbols-outlined">handshake</span>
                  </div>
                  <div>
                    <strong>Collaborate</strong>
                    <p>Work with peers on cutting-edge projects, share knowledge, and build the future together.</p>
                  </div>
                </li>
                <li>
                  <div className="feature-icon">
                    <span className="material-symbols-outlined">rocket_launch</span>
                  </div>
                  <div>
                    <strong>Build and Launch</strong>
                    <p>Use our lab spaces to prototype, test, and finally launch your innovative solutions.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Projects Section ──────────────────────────────── */}
      <section id="projects" className="projects-section">
        <div className="section-container">
          <div className="section-header-center">
            <h2 className="section-title">Our <span className="orange">Projects</span></h2>
            <p className="section-subtitle">A glimpse into what our community has built using the lab's resources.</p>
          </div>
          <div className="projects-grid">
            <div className="project-card">
              <img 
                src="/IMAGES/projects/project-rover.webp" 
                alt="Autonomous Rover V2" 
                className="project-img" 
                loading="lazy"
                onError={(e) => { e.currentTarget.src = '/IMAGES/empty-state.png'; }}
              />
              <div className="project-info">
                <h3>Autonomous Rover V2</h3>
                <p>An AI-powered robotic rover designed for rough terrain navigation and environmental mapping.</p>
              </div>
            </div>
            <div className="project-card">
              <img 
                src="/IMAGES/projects/project-iot.webp" 
                alt="Smart Campus IoT" 
                className="project-img" 
                loading="lazy"
                onError={(e) => { e.currentTarget.src = '/IMAGES/empty-state.png'; }}
              />
              <div className="project-info">
                <h3>Smart Campus IoT</h3>
                <p>A network of sensors deployed across campus to monitor air quality and energy consumption.</p>
              </div>
            </div>
            <div className="project-card">
              <img 
                src="/IMAGES/projects/project-ai.webp" 
                alt="Predictive Maintenance AI" 
                className="project-img" 
                loading="lazy"
                onError={(e) => { e.currentTarget.src = '/IMAGES/empty-state.png'; }}
              />
              <div className="project-info">
                <h3>Predictive Maintenance AI</h3>
                <p>Machine learning models built to predict equipment failure before it happens, saving costs and downtime.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Catalog / Items Section ──────────────────────── */}
      <section id="items" className="catalog-section">
        <div className="section-container">
          <div className="catalog-top-bar">
            <div className="catalog-header">
              <h2 className="section-title">Available <span className="accent">Inventory</span></h2>
            </div>
          </div>

          {loading ? (
            <div className="catalog-grid skeleton-grid">
              {[1, 2, 3, 4].map(i => (
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
            <div className="catalog-grid">
              {items.map(item => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '48px' }}>
            <Link to="/catalog" className="view-all-btn">
              View All Items <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Comments Section ──────────────────────────────── */}
      <section id="comments" className="comments-section">
        <div className="section-container">
          <div className="comments-wrapper">
            <div className="comments-header">
              <h2 className="section-title">Community <span className="orange">Feedback</span></h2>
              <p>Leave your thoughts, suggestions, or feedback about the lab.</p>
            </div>

            <form onSubmit={handleCommentSubmit} className="comment-form">
              <div className="input-group">
                <label htmlFor="comment-name">Name</label>
                <input
                  type="text"
                  id="comment-name"
                  placeholder="Your name (optional)"
                  maxLength={50}
                  value={commentName}
                  onChange={(e) => setCommentName(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label htmlFor="comment-text">Comment *</label>
                <textarea
                  id="comment-text"
                  rows="4"
                  placeholder="Share your experience..."
                  required
                  maxLength={500}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                ></textarea>
                <span style={{ fontSize: '0.75rem', color: commentText.length > 450 ? '#ef4444' : '#94a3b8', textAlign: 'right', display: 'block', marginTop: '4px' }}>
                  {commentText.length}/500
                </span>
              </div>
              <button type="submit" className="primary-btn submit-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Posting...' : 'Post Comment'}
                {!isSubmitting && <span className="material-symbols-outlined">send</span>}
              </button>
              {message.text && (
                <div className={`form-message ${message.type === 'success' ? 'success' : 'error'}`}>
                  {message.text}
                </div>
              )}
            </form>

            <div className="comments-list">
              {commentsLoading ? (
                <div className="catalog-loading">
                  <div className="spinner"></div>
                  <p>Loading comments...</p>
                </div>
              ) : comments.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                  No comments yet. Be the first to share your thoughts!
                </p>
              ) : (
                comments.map(comment => (
                  <div key={comment.id} className="comment-item">
                    <div className="comment-author">
                      <span className="material-symbols-outlined">account_circle</span>
                      {comment.name || 'Anonymous'}
                    </div>
                    <div className="comment-date">
                      {new Date(comment.created_at).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric'
                      })}
                    </div>
                    <p className="comment-body">{comment.comment}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────── */}
      <Footer />
    </>
  );
}
