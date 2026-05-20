// js/app.js
// Shared utilities that run on EVERY protected page

/**
 * Returns "Good Morning", "Good Afternoon", or "Good Evening"
 * based on the current local hour.
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/**
 * Populates all dynamic user-facing elements once the session is known.
 * Targets the consistent CSS classes used across all page templates.
 */
async function populateUserInfo() {
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session) return;

  const email    = session.user.email ?? '';
  const meta     = session.user.user_metadata ?? {};
  // Use full_name from metadata if set, else use the email prefix
  const fullName = meta.full_name || email.split('@')[0];
  const role     = meta.role      || 'User';

  // ── Topbar user profile (present on every dashboard page) ────────────────
  const nameEl = document.querySelector('.user-info-name');
  const roleEl = document.querySelector('.user-info-role');
  const avatarEl = document.querySelector('.user-profile .avatar');
  
  if (nameEl) nameEl.textContent = fullName;
  
  // 1. Hide the role (per user request)
  if (roleEl) roleEl.style.display = 'none';

  // 2. Display avatar only if available from OAuth
  const avatarUrl = meta.avatar_url || meta.picture;
  if (avatarEl) {
    if (avatarUrl) {
      avatarEl.style.backgroundImage = `url('${avatarUrl}')`;
      avatarEl.style.backgroundSize = 'cover';
      avatarEl.style.backgroundPosition = 'center';
      avatarEl.style.display = 'block';
    } else {
      avatarEl.style.display = 'none'; // Don't show empty gray box
    }
  }

  // ── Dashboard-specific: greeting & time salutation ────────────────────────
  const greetingNameEl = document.querySelector('.user-greeting-name');
  const greetingTimeEl = document.querySelector('.user-greeting-time');
  if (greetingNameEl) {
    greetingNameEl.textContent = `Hello, ${fullName}`;
  }
  if (greetingTimeEl) {
    greetingTimeEl.textContent = getGreeting();
  }
}

/**
 * Updates the pagination record-count text after data is loaded.
 * Call this with the total count from Supabase.
 * @param {number} total  – total records in the table
 * @param {number} shown  – how many are currently displayed
 */
function updatePaginationText(total, shown) {
  document.querySelectorAll('.total-records').forEach(el => {
    el.textContent = `Showing 1 to ${shown} of ${total} records`;
  });
}

// Run on every page load
document.addEventListener('DOMContentLoaded', () => {
  populateUserInfo();
  initTheme();
});

/**
 * Dark / Light Mode Toggle
 * Applies saved theme from localStorage and wires up the toggle buttons.
 */
function initTheme() {
  const saved = localStorage.getItem('app-theme') || 'light';
  applyTheme(saved);

  // Wire up sidebar toggle buttons on every page
  document.querySelectorAll('.theme-toggle .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Determine mode from the icon text inside the span
      const icon = btn.querySelector('.material-symbols-outlined');
      const mode = icon && icon.textContent.trim() === 'dark_mode' ? 'dark' : 'light';
      applyTheme(mode);
      localStorage.setItem('app-theme', mode);
    });
  });
}

function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);

  // Sync the active class on the toggle buttons
  document.querySelectorAll('.theme-toggle .toggle-btn').forEach(btn => {
    const icon = btn.querySelector('.material-symbols-outlined');
    const btnMode = icon && icon.textContent.trim() === 'dark_mode' ? 'dark' : 'light';
    btn.classList.toggle('active', btnMode === mode);
  });
}


/**
 * Superfast SessionStorage Caching Layer
 * Fetches data from DB or returns instantly from Cache if < 5 mins old
 */
window.fetchFromDB = async function(tableName) {
  const cacheKey = `sb_cache_${tableName}`;
  const cacheTimeKey = `sb_cache_time_${tableName}`;
  
  const cached = sessionStorage.getItem(cacheKey);
  const cacheTime = sessionStorage.getItem(cacheTimeKey);
  
  // Cache valid for 5 minutes
  if (cached && cacheTime && (Date.now() - parseInt(cacheTime) < 5 * 60 * 1000)) {
    return { data: JSON.parse(cached), error: null };
  }

  // Fetch from DB if no cache or expired
  let query = sbClient.from(tableName).select('*');
  
  if (tableName === 'items') {
    query = query.order('created_at', { ascending: false });
  } else if (tableName === 'transactions') {
    query = query.select('*, items(*)').order('timestamp', { ascending: false });
  } else if (tableName === 'projects') {
    query = query.order('name', { ascending: true });
  }

  const { data, error } = await query;
  if (error) {
    console.error(`Error fetching ${tableName}:`, error.message);
    return { data: null, error };
  }

  sessionStorage.setItem(cacheKey, JSON.stringify(data));
  sessionStorage.setItem(cacheTimeKey, Date.now().toString());
  return { data, error: null };
};

/**
 * Clear the cache instantly (called after any mutation to ensure fresh data)
 */
window.invalidateCache = function(tableName) {
  if (tableName) {
    sessionStorage.removeItem(`sb_cache_${tableName}`);
    sessionStorage.removeItem(`sb_cache_time_${tableName}`);
  } else {
    // If no table specified, clear all
    sessionStorage.removeItem('sb_cache_items');
    sessionStorage.removeItem('sb_cache_time_items');
    sessionStorage.removeItem('sb_cache_projects');
    sessionStorage.removeItem('sb_cache_time_projects');
    sessionStorage.removeItem('sb_cache_transactions');
    sessionStorage.removeItem('sb_cache_time_transactions');
  }
};
