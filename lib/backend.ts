import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;
export function getBackend() {
  if (typeof window === 'undefined') return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, {
    // Keep valid legacy magic links usable while the project SMTP template is
    // being switched to numeric OTP delivery.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'algebra:school-auth:v1' },
  });
  return client;
}

export async function schoolApi<T>(body: Record<string, unknown>): Promise<T> {
  const backend = getBackend();
  if (!backend) throw new Error('School accounts are not connected yet. Please contact Khalid.');
  const { data, error } = await backend.functions.invoke('school-activity', { body });
  if (error) {
    let message = 'Could not connect to your account. Please try again.';
    if (error.context instanceof Response) {
      try { message = (await error.context.json()).error || message; } catch { /* Use the safe fallback. */ }
    }
    throw new Error(message);
  }
  return data as T;
}
