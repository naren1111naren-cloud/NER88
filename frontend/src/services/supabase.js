import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fprrdioltnkjbifgluro.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_CkX_0FD87YpOu5B9bYtK3w_lUk_SAWo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
