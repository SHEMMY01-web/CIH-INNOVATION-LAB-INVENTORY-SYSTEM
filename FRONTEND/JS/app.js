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
  if (nameEl) nameEl.textContent = fullName;
  if (roleEl) roleEl.textContent = role;

  // ── Dashboard-specific: greeting & time salutation ────────────────────────
  const greetingNameEl = document.querySelector('.user-greeting-name');
  const greetingTimeEl = document.querySelector('.user-greeting-time');
  if (greetingNameEl) {
    greetingNameEl.textContent = `Hello, ${fullName} 👋`;
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
document.addEventListener('DOMContentLoaded', populateUserInfo);
