import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';
import { HttpError } from './http.js';

let client: SupabaseClient | null = null;

/** Server-role client. RLS denies every other role, so only this can read or write. */
export function db(): SupabaseClient {
  client ??= createClient(env.supabaseUrl(), env.supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'X-Client-Info': '10x-csp-server' } },
  });
  return client;
}

/** Unwraps a Supabase result, logging the database error without leaking it. */
export function must<T>(result: { data: T; error: { message: string; code?: string } | null }, context: string): T {
  if (result.error) {
    console.error(`[db] ${context}: ${result.error.code ?? ''} ${result.error.message}`);
    throw new HttpError(500, 'server_error', 'Something went wrong on our side. Please try again.');
  }
  return result.data;
}
