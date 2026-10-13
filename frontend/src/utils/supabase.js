import { createClient } from '@supabase/supabase-js';

export const SUPABASE_PROJECT_ID =
  (import.meta.env.VITE_SUPABASE_PROJECT_ID && import.meta.env.VITE_SUPABASE_PROJECT_ID.trim()) ||
  'fprrdioltnkjbifgluro';

export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL.trim()) ||
  'https://fprrdioltnkjbifgluro.supabase.co';

export const SUPABASE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY.trim()) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY && import.meta.env.VITE_SUPABASE_ANON_KEY.trim()) ||
  'sb_publishable_CkX_0FD87YpOu5B9bYtK3w_lUk_SAWo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export default supabase;
