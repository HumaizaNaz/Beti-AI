// lib/auth.ts
import { createSupabaseServer } from '@/lib/supabase/server';

export async function currentUserId(): Promise<string | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
