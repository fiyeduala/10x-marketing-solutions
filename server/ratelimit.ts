import { keyedHash } from './crypto.js';
import { db } from './db.js';
import { HttpError } from './http.js';

/**
 * Fixed-window limit keyed on a hashed identifier (usually the IP). If the
 * limiter itself fails we allow the request rather than lock candidates out.
 */
export async function rateLimit(action: string, identifier: string, limit: number, windowSeconds: number): Promise<void> {
  const key = `${action}:${keyedHash('rl', identifier)}`;
  const { data, error } = await db().rpc('csp_rate_limit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) {
    console.error(`[ratelimit] ${action}: ${error.message}`);
    return;
  }
  if (data === false) {
    throw new HttpError(429, 'rate_limited', 'Too many requests. Please wait a few minutes and try again.');
  }
}
