import { keyedHash } from './crypto.js';
import { db, must } from './db.js';
import { HttpError, bearerToken } from './http.js';

export interface Candidate {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  createdAt: string;
}

export interface CandidateSession {
  candidate: Candidate;
  tokenId: string;
}

const unauthorised = () =>
  new HttpError(401, 'unauthorised', 'Your session has expired or is not valid. Use your recovery code to continue.');

export function tokenHash(token: string): string {
  return keyedHash('access-token', token);
}

/** Issues a new bearer token for a candidate. Only its hash is stored. */
export async function issueAccessToken(candidateId: string, ttlDays: number, token: string): Promise<void> {
  const expires = new Date(Date.now() + ttlDays * 86_400_000).toISOString();
  must(
    await db().from('assessment_access_tokens').insert({ candidate_id: candidateId, token_hash: tokenHash(token), expires_at: expires }),
    'issue token',
  );
}

/** Resolves the candidate behind `Authorization: Bearer <token>`, or throws 401. */
export async function requireCandidate(request: Request): Promise<CandidateSession> {
  const token = bearerToken(request);
  if (!token) throw unauthorised();
  const row = must(
    await db()
      .from('assessment_access_tokens')
      .select('id, expires_at, revoked_at, last_used_at, assessment_candidates (id, full_name, normalised_email, phone, created_at)')
      .eq('token_hash', tokenHash(token))
      .maybeSingle(),
    'token lookup',
  );
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) throw unauthorised();
  const c = row.assessment_candidates as unknown as {
    id: string;
    full_name: string;
    normalised_email: string;
    phone: string | null;
    created_at: string;
  } | null;
  if (!c) throw unauthorised();

  // Touch at most every five minutes to avoid a write on every autosave.
  if (!row.last_used_at || Date.now() - new Date(row.last_used_at).getTime() > 300_000) {
    await db().from('assessment_access_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', row.id);
  }
  return {
    tokenId: row.id,
    candidate: { id: c.id, fullName: c.full_name, email: c.normalised_email, phone: c.phone, createdAt: c.created_at },
  };
}

export interface Admin {
  email: string;
  userId: string;
}

/**
 * Admin requests carry a Supabase Auth access token. The token is checked by
 * Supabase itself, the email must be confirmed, and it must be on the
 * admin_users allow-list. Signing in alone grants nothing.
 */
export async function requireAdmin(request: Request): Promise<Admin> {
  const token = bearerToken(request);
  if (!token) throw new HttpError(401, 'unauthorised', 'Please sign in.');
  const { data, error } = await db().auth.getUser(token);
  const user = data?.user;
  if (error || !user?.email) throw new HttpError(401, 'unauthorised', 'Your admin session has expired. Please sign in again.');
  const email = user.email.toLowerCase();
  if (!user.email_confirmed_at) throw new HttpError(403, 'forbidden', 'This account is not authorised.');
  const allowed = must(await db().from('admin_users').select('email').eq('email', email).maybeSingle(), 'admin lookup');
  if (!allowed) throw new HttpError(403, 'forbidden', 'This account is not authorised.');
  return { email, userId: user.id };
}
