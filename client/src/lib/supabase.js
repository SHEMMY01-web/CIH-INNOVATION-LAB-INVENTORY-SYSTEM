import { createClient } from '@supabase/supabase-js'

const defaultUrl = 'https://kkltrgjszsuozlrnjrnb.supabase.co';
const defaultAnonKey = 'sb_publishable_XhJwMl5PFjt7uEoKqlMwxw_pXJ0vcur';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || defaultUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || defaultAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
