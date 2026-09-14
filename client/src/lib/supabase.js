import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Supabase] Missing environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.\n' +
    'Create a .env file in the client/ directory or set them in your Vercel dashboard.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

/**
 * Broadcasts an invalidation message to the Service Worker to purge API cache
 * whenever local mutations (checkouts, additions, edits, deletions) occur.
 */
export function invalidateApiCache() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'INVALIDATE_API_CACHE'
      });
    } catch (err) {
      console.warn('[SW] Cache invalidation broadcast failed:', err);
    }
  }
}
