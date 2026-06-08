// js/landing.js

let allItems = [];
let filteredItems = [];

// DOM Elements
const gridContainer = document.getElementById('catalog-grid');
const loadingIndicator = document.getElementById('catalog-loading');
const emptyState = document.getElementById('catalog-empty');
const statsElement = document.getElementById('catalog-stats');
const searchInput = document.getElementById('catalog-search');
const filterChips = document.querySelectorAll('.chip');
const themeToggleBtn = document.getElementById('landing-theme-toggle');

// Comment DOM Elements
const commentForm = document.getElementById('comment-form');
const commentNameInput = document.getElementById('comment-name');
const commentTextInput = document.getElementById('comment-text');
const commentsListContainer = document.getElementById('comments-list');
const commentMessage = document.getElementById('comment-message');
const commentsLoading = document.getElementById('comments-loading');

/**
 * Initialize the landing page
 */
async function initLandingPage() {
  setupThemeToggle();
  setupEventListeners();
  setupCommentsForm();
  await Promise.all([
    fetchAndRenderItems(),
    fetchComments()
  ]);
}

/**
 * Setup Theme Toggle for the Landing Page
 */
function setupThemeToggle() {
  const currentTheme = localStorage.getItem('app-theme') || 'light';
  updateThemeIcons(currentTheme);

  themeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('app-theme', newTheme);
    updateThemeIcons(newTheme);
  });
}

function updateThemeIcons(theme) {
  const lightIcon = themeToggleBtn.querySelector('.light-icon');
  const darkIcon = themeToggleBtn.querySelector('.dark-icon');
  
  if (theme === 'dark') {
    lightIcon.style.display = 'none';
    darkIcon.style.display = 'block';
  } else {
    lightIcon.style.display = 'block';
    darkIcon.style.display = 'none';
  }
}

/**
 * Fetch items from Supabase anonymously
 */
async function fetchAndRenderItems() {
  try {
    // Show loading skeleton
    loadingIndicator.style.display = 'grid';
    gridContainer.style.display = 'none';
    emptyState.style.display = 'none';
    statsElement.textContent = '';

    // Fetch items directly using the sbClient provided by auth.js
    const { data, error } = await sbClient
      .from('items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Filter out project items for the public catalog
    allItems = data.filter(item => !item.project || item.project.trim() === '');
    filteredItems = [...allItems];

    renderGrid();
  } catch (error) {
    loadingIndicator.style.display = 'none';
    emptyState.style.display = 'flex';
    emptyState.querySelector('h3').textContent = 'Oops! Something went wrong';
    emptyState.querySelector('p').textContent = 'Please check your internet connection and try refreshing the page. 😊';
  }
}

/**
 * Render the item cards into the grid
 */
function renderGrid() {
  loadingIndicator.style.display = 'none';

  if (filteredItems.length === 0) {
    gridContainer.style.display = 'none';
    emptyState.style.display = 'flex';
    statsElement.textContent = '0 items found';
    return;
  }

  gridContainer.style.display = 'grid';
  emptyState.style.display = 'none';
  
  const totalAvailable = filteredItems.length;
  let itemsToRender = filteredItems;
  const isLanding = !window.location.pathname.includes('catalog');
  
  if (isLanding) {
    itemsToRender = filteredItems.slice(0, 8);
  }
  
  statsElement.textContent = isLanding 
    ? `Showing ${itemsToRender.length} of ${totalAvailable} items`
    : `${totalAvailable} item${totalAvailable !== 1 ? 's' : ''} available`;

  const html = itemsToRender.map(item => {
    // Parse Type
    const rawType = item.type || 'General';
    const displayType = rawType.includes(':') ? rawType.split(':')[1].trim() : rawType;
    
    // Determine Availability
    // An item is "Available" if it has an amount > 0 and status isn't "Out of Stock"
    const isAvailable = (item.amount > 0) && (item.status !== 'Out of Stock') && (item.status !== 'Damaged');
    
    // Status Text
    let statusText = 'Available';
    if (!isAvailable) {
      statusText = 'Unavailable';
      if (item.status === 'Out of Stock') statusText = 'Out of Stock';
      else if (item.status === 'Damaged') statusText = 'Damaged';
    }

    // Image Setup
    let imageHtml = '';
    if (item.image_url) {
      imageHtml = `<img src="${item.image_url}" alt="${item.item_name}" class="card-image" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                   <span class="material-symbols-outlined card-image-placeholder" style="display:none;">image</span>`;
    } else {
      imageHtml = `<span class="material-symbols-outlined card-image-placeholder">image</span>`;
    }

    return `
      <div class="item-card">
        <div class="card-image-container">
          ${imageHtml}
        </div>
        <div class="card-content">
          <span class="card-type">${displayType}</span>
          <h3 class="card-title">${item.item_name || 'Unnamed Item'}</h3>
          <p class="card-model">${item.model || 'No Model Specified'}</p>
          
          <div class="card-footer">
            <div class="status-badge ${isAvailable ? 'available' : 'unavailable'}">
              <div class="status-dot"></div>
              ${statusText}
            </div>
            <div class="qty-info">
              ${item.amount || 0} <span>${item.store || 'pcs'}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  gridContainer.innerHTML = html;
}

/**
 * Setup Event Listeners for Search and Filter
 */
function setupEventListeners() {
  // Search
  searchInput.addEventListener('input', (e) => {
    applyFilters();
  });

  // Filter Chips
  filterChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      // Update active state
      filterChips.forEach(c => c.classList.remove('active'));
      e.target.classList.add('active');
      
      applyFilters();
    });
  });
}

/**
 * Apply Search and Category Filters
 */
function applyFilters() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const activeFilter = document.querySelector('.chip.active').dataset.filter;

  filteredItems = allItems.filter(item => {
    // 1. Text Search Filter
    const matchName = (item.item_name || '').toLowerCase().includes(searchTerm);
    const matchModel = (item.model || '').toLowerCase().includes(searchTerm);
    const matchType = (item.type || '').toLowerCase().includes(searchTerm);
    const matchesSearch = matchName || matchModel || matchType;

    if (!matchesSearch) return false;

    // 2. Category Filter
    const itemType = (item.type || '').toLowerCase();
    
    if (activeFilter === 'all') return true;
    if (activeFilter === 'assets' && itemType.startsWith('asset')) return true;
    if (activeFilter === 'tools' && itemType.startsWith('tool')) return true;
    if (activeFilter === 'general' && !itemType.startsWith('asset') && !itemType.startsWith('tool')) return true;
    
    return false;
  });

  renderGrid();
}

/**
 * Setup Comments Form
 */
function setupCommentsForm() {
  if (!commentForm) return;

  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = commentNameInput.value.trim() || 'Anonymous';
    const text = commentTextInput.value.trim();
    
    if (!text) return;
    
    const submitBtn = document.getElementById('submit-comment-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Posting... <span class="spinner" style="width: 16px; height: 16px; border-width: 2px; margin-bottom: 0; display: inline-block;"></span>';
    
    try {
      // Check internet connectivity first
      if (!navigator.onLine) {
        throw new Error('offline');
      }

      const { data, error } = await sbClient
        .from('comments')
        .insert([{ name, comment: text }]);
        
      if (error) throw error;
      
      // Success
      commentMessage.textContent = 'Comment posted successfully!';
      commentMessage.className = 'form-message success';
      commentForm.reset();
      
      // Refresh comments
      await fetchComments();
      
      setTimeout(() => {
        commentMessage.textContent = '';
        commentMessage.className = 'form-message';
      }, 5000);
      
    } catch (error) {
      commentMessage.textContent = 'Something went wrong while posting your comment. Please check your connection and try again. 😊';
      commentMessage.className = 'form-message error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Post Comment <span class="material-symbols-outlined">send</span>';
    }
  });
}

/**
 * Fetch and Render Comments
 */
async function fetchComments() {
  if (!commentsListContainer || !commentsLoading) return;
  
  try {
    commentsLoading.style.display = 'flex';
    // Clear existing (excluding loader)
    Array.from(commentsListContainer.children).forEach(child => {
      if (child.id !== 'comments-loading') child.remove();
    });

    const { data, error } = await sbClient
      .from('comments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (error) throw error;
    
    commentsLoading.style.display = 'none';
    
    if (!data || data.length === 0) {
      commentsListContainer.innerHTML = '<p style="color: var(--landing-text-muted); text-align: center;">No comments yet. Be the first to share your thoughts!</p>';
      return;
    }
    
    const html = data.map(comment => {
      const date = new Date(comment.created_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
      return `
        <div class="comment-item">
          <div class="comment-author">
            <span class="material-symbols-outlined">account_circle</span>
            ${comment.name || 'Anonymous'}
          </div>
          <div class="comment-date">${date}</div>
          <p class="comment-body">${comment.comment}</p>
        </div>
      `;
    }).join('');
    
    commentsListContainer.innerHTML = html;
    
  } catch (error) {
    commentsLoading.style.display = 'none';
    commentsListContainer.innerHTML = '<p style="color: var(--landing-text-muted); text-align: center;">Comments are not available right now. Please check your connection and try again later. 😊</p>';
  }
}

// Run on Load
document.addEventListener('DOMContentLoaded', initLandingPage);
