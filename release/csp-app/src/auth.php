<?php
declare(strict_types=1);

namespace Csp;

function unauthorised(): HttpError
{
    return new HttpError(401, 'unauthorised', 'Your session has expired or is not valid. Use your recovery code to continue.');
}

function token_hash(string $token): string
{
    return keyed_hash('access-token', $token);
}

/** Issues a new bearer token for a candidate. Only its hash is stored. */
function issue_access_token(string $candidateId, int $ttlDays, string $token): void
{
    Db::run(
        'INSERT INTO assessment_access_tokens (id, candidate_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
        [uuid4(), $candidateId, token_hash($token), db_time(now_ms() + $ttlDays * 86_400_000)],
    );
}

/**
 * Resolves the candidate behind `Authorization: Bearer <token>`, or throws 401.
 * @return array{tokenId:string,candidate:array{id:string,fullName:string,email:string,phone:?string,createdAt:string}}
 */
function require_candidate(Request $req): array
{
    $token = $req->bearerToken();
    if ($token === null) throw unauthorised();
    $row = Db::one(
        'SELECT t.id, t.expires_at, t.revoked_at, t.last_used_at, c.id AS c_id, c.full_name, c.normalised_email, c.phone, c.created_at
           FROM assessment_access_tokens t JOIN assessment_candidates c ON c.id = t.candidate_id
          WHERE t.token_hash = ?',
        [token_hash($token)],
    );
    if (!$row || $row['revoked_at'] !== null || ms($row['expires_at']) <= now_ms()) throw unauthorised();

    // Touch at most every five minutes to avoid a write on every autosave.
    if ($row['last_used_at'] === null || now_ms() - ms($row['last_used_at']) > 300_000) {
        Db::run('UPDATE assessment_access_tokens SET last_used_at = ? WHERE id = ?', [db_time(now_ms()), $row['id']]);
    }
    return [
        'tokenId' => $row['id'],
        'candidate' => [
            'id' => $row['c_id'],
            'fullName' => $row['full_name'],
            'email' => $row['normalised_email'],
            'phone' => $row['phone'],
            'createdAt' => iso($row['created_at']),
        ],
    ];
}

// --- Administrators ---------------------------------------------------------
// The Vercel version signs admins in with Supabase Auth. Here the API does it
// itself: a password hash in admin_users (set from the command line with
// tools/admin-password.php) and short-lived, revocable sessions whose tokens
// are stored only as keyed hashes. Being on the allow-list grants nothing
// until a password has been set.

const ADMIN_SESSION_HOURS = 8;

function admin_session_hash(string $token): string
{
    return keyed_hash('admin-session', $token);
}

/** @return array{email:string,sessionId:string} */
function require_admin(Request $req): array
{
    $token = $req->bearerToken();
    if ($token === null) throw new HttpError(401, 'unauthorised', 'Please sign in.');
    $row = Db::one(
        'SELECT s.id, s.email, s.created_at, s.expires_at, s.revoked_at, a.password_hash, a.password_changed_at
           FROM admin_sessions s JOIN admin_users a ON a.email = s.email
          WHERE s.token_hash = ?',
        [admin_session_hash($token)],
    );
    $valid = $row
        && $row['revoked_at'] === null
        && ms($row['expires_at']) > now_ms()
        && $row['password_hash'] !== null
        // Changing the password signs out every earlier session.
        && ($row['password_changed_at'] === null || ms($row['created_at']) >= ms($row['password_changed_at']));
    if (!$valid) throw new HttpError(401, 'unauthorised', 'Your admin session has expired. Please sign in again.');
    return ['email' => $row['email'], 'sessionId' => $row['id']];
}

/** A hash to verify against when the account does not exist, so timing does not reveal which emails are admins. */
function dummy_password_hash(): string
{
    static $hash = null;
    return $hash ??= password_hash('not-a-real-password-' . bin2hex(random_bytes(8)), PASSWORD_DEFAULT);
}
