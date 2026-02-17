import { supabase } from '@/lib/supabase';

// Deprecated: Alias for Supabase client
export const insforge = {
  auth: {
    ...supabase.auth,
    // Add compatibility wrappers if needed
    getCurrentUser: async () => supabase.auth.getSession(),
  },
  database: supabase, // Direct alias since Supabase client IS the database client
};

export const INSFORGE_CONFIG = {
  baseUrl: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

