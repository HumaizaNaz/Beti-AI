// lib/supabase/admin.ts — server only: uses the service-role key.
import { createClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';

export function createSupabaseAdmin() {
  const env = serverEnv();
  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
