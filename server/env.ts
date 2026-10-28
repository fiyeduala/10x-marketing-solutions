/**
 * Server-only environment. Never import this (or anything under server/)
 * from src/ — Vite would not expose these values, but the import would also
 * drag the answer key into the browser bundle.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export function requireEnv(name: string): string {
  const value = read(name);
  if (!value) throw new ConfigError(name);
  return value;
}

export class ConfigError extends Error {
  constructor(readonly variable: string) {
    super(`Missing server configuration: ${variable}`);
  }
}

export const env = {
  supabaseUrl: () => requireEnv('SUPABASE_URL'),
  /** Service-role or `sb_secret_` key. Server only. */
  supabaseSecretKey: () => requireEnv('SUPABASE_SECRET_KEY'),
  /** Pepper for hashing tokens, recovery codes and IP addresses. */
  appSecret: () => requireEnv('APP_SECRET'),
  paystackSecretKey: () => read('PAYSTACK_SECRET_KEY'),
  /**
   * Override only for automated tests against a local mock. Ignored in the
   * Vercel production environment.
   */
  paystackApiBase: () =>
    (process.env.VERCEL_ENV !== 'production' && read('PAYSTACK_API_BASE')) || 'https://api.paystack.co',
  /** Public origin used for Paystack callbacks and certificate links. */
  appBaseUrl: (): string => {
    const explicit = read('APP_BASE_URL');
    if (explicit) return explicit.replace(/\/+$/, '');
    const vercel = read('VERCEL_URL');
    if (vercel) return `https://${vercel}`;
    throw new ConfigError('APP_BASE_URL');
  },
  isProduction: () => process.env.VERCEL_ENV === 'production',
};
