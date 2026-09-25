/**
 * Utility functions for deduplicating, synchronizing, and organizing
 * equipment requisitions across Supabase and local storage fallbacks.
 */

/**
 * Creates a unique semantic fingerprint for a request based on core properties.
 * If two records share the same item, email, quantity, and needed date,
 * they represent the exact same requisition.
 */
export function getRequestSignature(req) {
  if (!req) return '';
  const itemId = req.item_id || (req.items && req.items.id) || req.item_name || '';
  const email = (req.requester_email || req.email || '').trim().toLowerCase();
  const date = req.needed_date || '';
  const qty = req.quantity || 1;
  const project = (req.project_name || 'General').trim().toLowerCase();
  return `${itemId}::${email}::${date}::${qty}::${project}`;
}

/**
 * Deduplicates and unifies a list of remote and local requisitions.
 * - Prioritizes confirmed remote records from Supabase.
 * - Detects and eliminates duplicate remote entries (from double-clicks).
 * - Identifies local fallback items that already exist in Supabase and prunes them from localStorage.
 * - Deduplicates remaining local offline items so they never appear twice.
 * 
 * @param {Array} remoteList - Records fetched from Supabase item_requests
 * @param {string} filterEmail - Optional email to filter/scope local records
 * @returns {Array} Clean, deduplicated, sorted array of requests
 */
export function deduplicateRequisitions(remoteList = [], filterEmail = '') {
  const cleanEmail = filterEmail ? filterEmail.trim().toLowerCase() : '';

  // 1. Deduplicate remote records first (in case of double submission to the DB)
  const uniqueRemote = [];
  const seenRemoteSignatures = new Map();
  const seenRemoteIds = new Set();

  for (const item of remoteList) {
    if (!item || !item.id) continue;
    if (seenRemoteIds.has(item.id)) continue;

    const sig = getRequestSignature(item);
    const existing = seenRemoteSignatures.get(sig);

    if (existing) {
      // If two remote records have identical signatures within 5 minutes, keep the most recently updated
      const timeA = new Date(existing.created_at || 0).getTime();
      const timeB = new Date(item.created_at || 0).getTime();
      if (Math.abs(timeA - timeB) < 5 * 60 * 1000) {
        // Duplicate row from rapid double-tap — skip the duplicate
        continue;
      }
    }

    seenRemoteIds.add(item.id);
    seenRemoteSignatures.set(sig, item);
    uniqueRemote.push(item);
  }

  // 2. Read local queues
  let localPending = [];
  let userOrders = [];
  try {
    localPending = JSON.parse(localStorage.getItem('cih_pending_requisitions') || '[]');
  } catch (_) {
    localPending = [];
  }
  try {
    userOrders = JSON.parse(localStorage.getItem('cih_user_orders') || '[]');
  } catch (_) {
    userOrders = [];
  }

  // 3. Combine local records and deduplicate among themselves
  const combinedLocal = [...localPending, ...userOrders];
  const uniqueLocal = [];
  const seenLocalSignatures = new Set();
  const seenLocalIds = new Set();
  const duplicateLocalIdsToPrune = new Set();

  for (const item of combinedLocal) {
    if (!item) continue;
    const id = item.id || `LOCAL-${Math.random()}`;
    const sig = getRequestSignature(item);

    // If this item already exists in Supabase (by ID or by matching signature), mark for pruning
    if (seenRemoteIds.has(id) || seenRemoteSignatures.has(sig)) {
      duplicateLocalIdsToPrune.add(id);
      continue;
    }

    // If we've already included this local item in our deduplicated local list, mark for pruning
    if (seenLocalIds.has(id) || (sig && seenLocalSignatures.has(sig))) {
      duplicateLocalIdsToPrune.add(id);
      continue;
    }

    // If an email filter is provided, only keep records matching this email
    if (cleanEmail) {
      const itemEmail = (item.requester_email || item.email || '').trim().toLowerCase();
      if (itemEmail !== cleanEmail) {
        continue;
      }
    }

    seenLocalIds.add(id);
    if (sig) seenLocalSignatures.add(sig);
    uniqueLocal.push(item);
  }

  // 4. Prune stale/duplicate items from localStorage so they don't persist
  if (duplicateLocalIdsToPrune.size > 0) {
    try {
      const cleanedPending = localPending.filter(
        item => !duplicateLocalIdsToPrune.has(item.id) && !seenRemoteSignatures.has(getRequestSignature(item))
      );
      localStorage.setItem('cih_pending_requisitions', JSON.stringify(cleanedPending));

      const cleanedUserOrders = userOrders.filter(
        item => !duplicateLocalIdsToPrune.has(item.id) && !seenRemoteSignatures.has(getRequestSignature(item))
      );
      localStorage.setItem('cih_user_orders', JSON.stringify(cleanedUserOrders.slice(0, 30)));
    } catch (_) {}
  }

  // 5. Combine remote and remaining local offline records
  const result = [...uniqueRemote, ...uniqueLocal];

  // 6. Sort descending by creation date
  result.sort((a, b) => {
    const timeA = new Date(a.created_at || a.needed_date || 0).getTime();
    const timeB = new Date(b.created_at || b.needed_date || 0).getTime();
    return timeB - timeA;
  });

  return result;
}

/**
 * Formats a short, readable reference ID for a requisition (e.g., REQ-8F2B).
 */
export function getShortRequestId(req) {
  if (!req || !req.id) return 'REQ-CIH';
  const idStr = String(req.id).replace(/^REQ-/, '');
  const clean = idStr.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `REQ-${clean.slice(0, 6) || 'CIH'}`;
}

/**
 * Formats a date string into a user-friendly label (e.g., "Mon, Sep 28, 2026").
 */
export function formatFriendlyDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (_) {
    return dateStr;
  }
}
