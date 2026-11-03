<?php
declare(strict_types=1);

namespace Csp\Routes;

use Csp\Bank;
use Csp\Config;
use Csp\Db;
use Csp\Env;
use Csp\HttpError;
use Csp\Request;
use Csp\Response;
use function Csp\{admin_session_hash, audit, base64url, db_time, dummy_password_hash, iso, json, json_col, normalise_certificate_number, now_ms, num, rate_limit, require_admin, required_correct, uuid4, v_email, v_text};
use const Csp\ADMIN_SESSION_HOURS;

/** @return array{email:string,sessionId:string} */
function admin(Request $req): array
{
    rate_limit('admin', $req->ip, 300, 600);
    return require_admin($req);
}

/**
 * Password sign-in for allow-listed administrators. Every failure looks the
 * same, whether the email is unknown, has no password yet, or the password
 * is wrong.
 */
function admin_login(Request $req): Response
{
    rate_limit('admin-login', $req->ip, 10, 900);
    $body = $req->json();
    $failed = new HttpError(401, 'login_failed', 'That email and password do not match an administrator account.');
    if (!is_string($body['email'] ?? null) || !is_string($body['password'] ?? null) || strlen($body['password']) > 1024) throw $failed;
    try {
        $email = v_email($body['email']);
    } catch (HttpError) {
        throw $failed;
    }
    rate_limit('admin-login-email', $email, 20, 86_400);

    $user = Db::one('SELECT email, password_hash FROM admin_users WHERE email = ?', [$email]);
    $hash = $user['password_hash'] ?? null;
    $ok = password_verify($body['password'], $hash ?? dummy_password_hash()) && $hash !== null;
    if (!$ok) {
        audit('admin.login_failed', ['ipHash' => $req->ipHash()]);
        throw $failed;
    }
    if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
        Db::run('UPDATE admin_users SET password_hash = ? WHERE email = ?', [password_hash($body['password'], PASSWORD_DEFAULT), $email]);
    }

    $token = base64url(random_bytes(32));
    $now = now_ms();
    $expires = $now + ADMIN_SESSION_HOURS * 3_600_000;
    Db::run(
        'INSERT INTO admin_sessions (id, email, token_hash, created_at, expires_at, ip_hash) VALUES (?, ?, ?, ?, ?, ?)',
        [uuid4(), $email, admin_session_hash($token), db_time($now), db_time($expires), $req->ipHash()],
    );
    audit('admin.login', ['actor' => "admin:{$email}", 'ipHash' => $req->ipHash()]);
    return json(['token' => $token, 'email' => $email, 'expiresAt' => \Csp\iso_ms($expires)]);
}

function admin_logout(Request $req): Response
{
    $a = require_admin($req);
    Db::run('UPDATE admin_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', [db_time(now_ms()), $a['sessionId']]);
    return json(['ok' => true]);
}

function admin_me(Request $req): Response
{
    return json(['email' => admin($req)['email']]);
}

function admin_summary(Request $req): Response
{
    admin($req);
    $count = fn (string $sql) => (int) (Db::one($sql)['n'] ?? 0);
    $s = [
        'candidates' => $count('SELECT COUNT(*) AS n FROM assessment_candidates'),
        'attempts' => $count('SELECT COUNT(*) AS n FROM assessment_attempts'),
        'attempts_in_progress' => $count("SELECT COUNT(*) AS n FROM assessment_attempts WHERE status = 'in_progress'"),
        'attempts_passed' => $count("SELECT COUNT(*) AS n FROM assessment_attempts WHERE status = 'passed'"),
        'attempts_failed' => $count("SELECT COUNT(*) AS n FROM assessment_attempts WHERE status = 'failed'"),
        'payments_success' => $count("SELECT COUNT(*) AS n FROM certificate_payments WHERE status = 'success'"),
        'payments_duplicate' => $count("SELECT COUNT(*) AS n FROM certificate_payments WHERE status = 'duplicate_success'"),
        'payments_pending' => $count("SELECT COUNT(*) AS n FROM certificate_payments WHERE status = 'initialized'"),
        'payments_failed' => $count("SELECT COUNT(*) AS n FROM certificate_payments WHERE status IN ('failed', 'abandoned')"),
        'gross_success_kobo' => $count("SELECT COALESCE(SUM(amount_kobo), 0) AS n FROM certificate_payments WHERE status = 'success'"),
        'certificates_issued' => $count('SELECT COUNT(*) AS n FROM issued_certificates'),
        'certificates_revoked' => $count('SELECT COUNT(*) AS n FROM issued_certificates WHERE revoked_at IS NOT NULL'),
    ];
    $marked = $s['attempts_passed'] + $s['attempts_failed'];
    $s['pass_rate_percent'] = $marked ? num(round($s['attempts_passed'] / $marked * 1000) / 10) : null;
    $cfg = Config::get();
    $key = Env::paystackSecretKey();
    return json([
        'summary' => $s,
        'config' => $cfg + ['requiredCorrect' => required_correct($cfg['questionsPerAttempt'], $cfg['passMarkPercent'])],
        'questionBankVersion' => Bank::version(),
        'paystackConfigured' => $key !== null,
        'paystackMode' => $key === null ? 'not_configured' : (str_starts_with($key, 'sk_live_') ? 'live' : 'test'),
    ]);
}

const PAGE_SIZE = 25;

/** @return array{0:string,1:array} WHERE clause and its parameters. */
function attempt_filter(?string $status, ?string $emailFilter): array
{
    $where = [];
    $params = [];
    if ($status !== null && in_array($status, ['in_progress', 'passed', 'failed'], true)) {
        $where[] = 'a.status = ?';
        $params[] = $status;
    }
    if ($emailFilter !== null) {
        // '!' as the escape character works whatever the server's backslash mode.
        $where[] = "c.normalised_email LIKE ? ESCAPE '!'";
        $params[] = '%' . preg_replace('/[!%_]/', '!$0', $emailFilter) . '%';
    }
    return [$where ? 'WHERE ' . implode(' AND ', $where) : '', $params];
}

/** Attempts with their candidate, payments and certificate, newest first. */
function attempt_rows(string $where, array $params, int $limit, int $offset): array
{
    $rows = Db::all(
        "SELECT a.id, a.status, a.started_at, a.submitted_at, a.timed_out, a.correct_answers, a.total_questions, a.score_percentage,
                c.full_name, c.normalised_email, c.phone,
                ic.certificate_number, ic.revoked_at
           FROM assessment_attempts a
           JOIN assessment_candidates c ON c.id = a.candidate_id
           LEFT JOIN issued_certificates ic ON ic.attempt_id = a.id
           {$where}
          ORDER BY a.started_at DESC
          LIMIT {$limit} OFFSET {$offset}",
        $params,
    );
    $pays = [];
    if ($rows) {
        $ids = array_column($rows, 'id');
        $marks = implode(', ', array_fill(0, count($ids), '?'));
        foreach (Db::all("SELECT attempt_id, status, reference, amount_kobo, paid_at FROM certificate_payments WHERE attempt_id IN ({$marks}) ORDER BY created_at", $ids) as $p) {
            $pays[$p['attempt_id']][] = $p;
        }
    }
    return array_map(function ($r) use ($pays) {
        $list = $pays[$r['id']] ?? [];
        $paid = null;
        foreach ($list as $p) if ($p['status'] === 'success') { $paid = $p; break; }
        $duplicate = (bool) array_filter($list, fn ($p) => $p['status'] === 'duplicate_success');
        return [
            'id' => $r['id'],
            'name' => $r['full_name'],
            'email' => $r['normalised_email'],
            'phone' => $r['phone'],
            'status' => $r['status'],
            'startedAt' => iso($r['started_at']),
            'submittedAt' => iso($r['submitted_at']),
            'timedOut' => (bool) $r['timed_out'],
            'correctAnswers' => $r['correct_answers'] === null ? null : (int) $r['correct_answers'],
            'totalQuestions' => (int) $r['total_questions'],
            'scorePercentage' => num($r['score_percentage']),
            'paymentStatus' => $paid ? 'success' : ($duplicate ? 'duplicate_success' : ($list[0]['status'] ?? null)),
            'paymentReference' => $paid['reference'] ?? null,
            'amountKobo' => $paid ? (int) $paid['amount_kobo'] : null,
            'paidAt' => iso($paid['paid_at'] ?? null),
            'certificateNumber' => $r['certificate_number'],
            'certificateRevoked' => $r['revoked_at'] !== null,
        ];
    }, $rows);
}

function admin_attempts(Request $req): Response
{
    admin($req);
    $page = max(1, min(10_000, (int) ($req->query('page') ?? 1) ?: 1));
    $q = mb_substr(mb_strtolower(trim($req->query('q') ?? '')), 0, 120);
    [$where, $params] = attempt_filter($req->query('status'), $q === '' ? null : $q);
    $total = (int) (Db::one("SELECT COUNT(*) AS n FROM assessment_attempts a JOIN assessment_candidates c ON c.id = a.candidate_id {$where}", $params)['n'] ?? 0);
    $rows = attempt_rows($where, $params, PAGE_SIZE, ($page - 1) * PAGE_SIZE);
    return json(['page' => $page, 'pageSize' => PAGE_SIZE, 'total' => $total, 'rows' => $rows]);
}

function csv_cell(mixed $value): string
{
    $s = match (true) {
        $value === null => '',
        is_bool($value) => $value ? 'true' : 'false',
        default => (string) $value,
    };
    // Stop spreadsheet formula injection.
    if (preg_match('/^[=+\-@\t\r]/', $s)) $s = "'{$s}";
    return preg_match('/[",\n\r]/', $s) ? '"' . str_replace('"', '""', $s) . '"' : $s;
}

function admin_export(Request $req): Response
{
    $a = admin($req);
    [$where, $params] = attempt_filter($req->query('status'), null);
    $rows = attempt_rows($where, $params, 5000, 0);
    $header = ['attempt_id', 'name', 'email', 'phone', 'status', 'started_at', 'submitted_at', 'timed_out', 'correct', 'total',
        'score_percent', 'payment_status', 'payment_reference', 'amount_naira', 'paid_at', 'certificate_number', 'certificate_revoked'];
    $lines = [implode(',', $header)];
    foreach ($rows as $r) {
        $lines[] = implode(',', array_map('Csp\Routes\csv_cell', [
            $r['id'], $r['name'], $r['email'], $r['phone'], $r['status'], $r['startedAt'], $r['submittedAt'], $r['timedOut'], $r['correctAnswers'], $r['totalQuestions'],
            $r['scorePercentage'], $r['paymentStatus'], $r['paymentReference'], $r['amountKobo'] === null ? '' : number_format($r['amountKobo'] / 100, 2, '.', ''),
            $r['paidAt'], $r['certificateNumber'], $r['certificateRevoked'],
        ]));
    }
    audit('admin.export', ['actor' => "admin:{$a['email']}", 'ipHash' => $req->ipHash(), 'details' => ['rows' => count($rows)]]);
    return new Response(200, "\u{FEFF}" . implode("\r\n", $lines) . "\r\n", [
        'Content-Type' => 'text/csv; charset=utf-8',
        'Content-Disposition' => 'attachment; filename="csp-attempts-' . gmdate('Y-m-d') . '.csv"',
        'Cache-Control' => 'no-store, max-age=0',
        'X-Robots-Tag' => 'noindex, nofollow',
    ]);
}

function admin_revoke(Request $req): Response
{
    $a = admin($req);
    $number = normalise_certificate_number($req->params[0] ?? '');
    if ($number === null) throw new HttpError(404, 'not_found', 'That certificate was not found.');
    $body = $req->json();
    $reason = v_text($body['reason'] ?? null, 'reason', 500);
    $changed = Db::exec('UPDATE issued_certificates SET revoked_at = ?, revocation_reason = ? WHERE certificate_number = ? AND revoked_at IS NULL', [db_time(now_ms()), $reason, $number]);
    if ($changed === 0) throw new HttpError(404, 'not_found', 'No active certificate with that number.');
    $cert = Db::one('SELECT id, candidate_id, attempt_id FROM issued_certificates WHERE certificate_number = ?', [$number]);
    audit('certificate.revoked', [
        'actor' => "admin:{$a['email']}",
        'candidateId' => $cert['candidate_id'],
        'attemptId' => $cert['attempt_id'],
        'certificateId' => $cert['id'],
        'ipHash' => $req->ipHash(),
        'details' => ['reason' => $reason],
    ]);
    return json(['revoked' => true, 'number' => $number]);
}

const CONFIG_FIELDS = [
    'questionsPerAttempt' => ['column' => 'questions_per_attempt', 'min' => 5, 'max' => 40],
    'durationMinutes' => ['column' => 'duration_minutes', 'min' => 5, 'max' => 240],
    'passMarkPercent' => ['column' => 'pass_mark_percent', 'min' => 1, 'max' => 100],
    'certificateFeeKobo' => ['column' => 'certificate_fee_kobo', 'min' => 5000, 'max' => 10_000_000],
    'submissionGraceSeconds' => ['column' => 'submission_grace_seconds', 'min' => 0, 'max' => 300],
    'retakeCooldownMinutes' => ['column' => 'retake_cooldown_minutes', 'min' => 0, 'max' => 10_080],
    'maxAttemptsPerDay' => ['column' => 'max_attempts_per_day', 'min' => 1, 'max' => 50],
    'accessTokenTtlDays' => ['column' => 'access_token_ttl_days', 'min' => 1, 'max' => 365],
];

/** Changes apply to attempts started afterwards; open attempts keep their settings. */
function admin_update_config(Request $req): Response
{
    $a = admin($req);
    $body = $req->json();
    $update = [];
    foreach (CONFIG_FIELDS as $key => $spec) {
        if (!array_key_exists($key, $body)) continue;
        $v = $body[$key];
        // Same rules as JavaScript's Number(): numeric strings count, booleans and null do not.
        $n = is_int($v) || is_float($v) ? $v : (is_string($v) && is_numeric(trim($v)) ? trim($v) + 0 : null);
        if ($n === null || !is_finite((float) $n) || $n < $spec['min'] || $n > $spec['max'] || ($key !== 'passMarkPercent' && floor((float) $n) != $n)) {
            throw new HttpError(422, 'invalid_input', "{$key} must be between {$spec['min']} and {$spec['max']}.", ['field' => $key]);
        }
        $update[$spec['column']] = $key === 'passMarkPercent' ? num($n) : (int) $n;
    }
    if (array_key_exists('paymentsEnabled', $body)) {
        if (!is_bool($body['paymentsEnabled'])) throw new HttpError(422, 'invalid_input', 'paymentsEnabled must be true or false.');
        $update['payments_enabled'] = $body['paymentsEnabled'];
    }
    if (!$update) throw new HttpError(422, 'invalid_input', 'Nothing to change.');

    // Column names come only from the fixed list above.
    $sets = implode(', ', array_map(fn ($c) => "{$c} = ?", array_keys($update)));
    Db::run("UPDATE assessment_config SET {$sets} WHERE id = 1", array_values($update));
    Config::clear();
    audit('admin.config_changed', ['actor' => "admin:{$a['email']}", 'ipHash' => $req->ipHash(), 'details' => $update]);
    return json(['updated' => array_keys($update)]);
}

function admin_audit(Request $req): Response
{
    admin($req);
    $rows = Db::all('SELECT id, event_type, actor, attempt_id, payment_id, certificate_id, details, created_at FROM security_audit_events ORDER BY created_at DESC, id DESC LIMIT 100');
    return json(['events' => array_map(fn ($r) => [
        'id' => (int) $r['id'],
        'event_type' => $r['event_type'],
        'actor' => $r['actor'],
        'attempt_id' => $r['attempt_id'],
        'payment_id' => $r['payment_id'],
        'certificate_id' => $r['certificate_id'],
        'details' => (object) json_col($r['details']),
        'created_at' => iso($r['created_at']),
    ], $rows)]);
}
