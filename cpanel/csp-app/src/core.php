<?php
/** Configuration, audit log, rate limiting and input validation. */
declare(strict_types=1);

namespace Csp;

const CERTIFICATE_TITLE = 'Certificate of Competency in Customer Support';
const ASSESSMENT_NAME = '10X Customer Support Professional Assessment';

final class Config
{
    private static ?array $cached = null;

    /**
     * The single settings row. Read once per request (PHP has no shared
     * memory between requests, so there is nothing to keep fresh).
     * @return array{questionsPerAttempt:int,durationMinutes:int,passMarkPercent:float|int,certificateFeeKobo:int,currency:string,submissionGraceSeconds:int,retakeCooldownMinutes:int,maxAttemptsPerDay:int,accessTokenTtlDays:int,privacyNoticeVersion:string,paymentsEnabled:bool}
     */
    public static function get(): array
    {
        if (self::$cached) return self::$cached;
        $row = Db::one('SELECT * FROM assessment_config WHERE id = 1');
        if (!$row) throw new \RuntimeException('assessment_config row missing');
        return self::$cached = [
            'questionsPerAttempt' => (int) $row['questions_per_attempt'],
            'durationMinutes' => (int) $row['duration_minutes'],
            'passMarkPercent' => num($row['pass_mark_percent']),
            'certificateFeeKobo' => (int) $row['certificate_fee_kobo'],
            'currency' => (string) $row['currency'],
            'submissionGraceSeconds' => (int) $row['submission_grace_seconds'],
            'retakeCooldownMinutes' => (int) $row['retake_cooldown_minutes'],
            'maxAttemptsPerDay' => (int) $row['max_attempts_per_day'],
            'accessTokenTtlDays' => (int) $row['access_token_ttl_days'],
            'privacyNoticeVersion' => (string) $row['privacy_notice_version'],
            'paymentsEnabled' => (bool) $row['payments_enabled'],
        ];
    }

    public static function clear(): void
    {
        self::$cached = null;
    }
}

/** Questions needed to pass, e.g. 21 of 30 at 70%. */
function required_correct(int $total, float|int $passMarkPercent): int
{
    return (int) ceil(($passMarkPercent * $total) / 100 - 1e-9);
}

/**
 * Best-effort audit write. Never include secrets, tokens or card data.
 * @param array{actor?:string,candidateId?:?string,attemptId?:?string,paymentId?:?string,certificateId?:?string,details?:array,ipHash?:?string} $e
 */
function audit(string $type, array $e = []): void
{
    try {
        Db::run(
            'INSERT INTO security_audit_events (event_type, actor, candidate_id, attempt_id, payment_id, certificate_id, details, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$type, $e['actor'] ?? 'system', $e['candidateId'] ?? null, $e['attemptId'] ?? null, $e['paymentId'] ?? null, $e['certificateId'] ?? null, json_map($e['details'] ?? []), $e['ipHash'] ?? null],
        );
    } catch (\Throwable $err) {
        error_log("[audit] {$type}: " . $err->getMessage());
    }
}

/**
 * Fixed-window limit keyed on a hashed identifier (usually the IP). If the
 * limiter itself fails we allow the request rather than lock candidates out.
 */
function rate_limit(string $action, string $identifier, int $limit, int $windowSeconds): void
{
    $key = $action . ':' . keyed_hash('rl', $identifier);
    $now = time();
    $window = gmdate('Y-m-d H:i:s', intdiv($now, $windowSeconds) * $windowSeconds);
    try {
        Db::run('INSERT INTO rate_limit_buckets (bucket_key, window_start, hits) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE hits = hits + 1', [$key, $window]);
        $hits = (int) (Db::one('SELECT hits FROM rate_limit_buckets WHERE bucket_key = ? AND window_start = ?', [$key, $window])['hits'] ?? 0);
        // Occasional cleanup of stale windows.
        if (random_int(1, 100) === 1) Db::run('DELETE FROM rate_limit_buckets WHERE window_start < ?', [gmdate('Y-m-d H:i:s', $now - 2 * 86400)]);
    } catch (\Throwable $err) {
        error_log("[ratelimit] {$action}: " . $err->getMessage());
        return;
    }
    if ($hits > $limit) throw new HttpError(429, 'rate_limited', 'Too many requests. Please wait a few minutes and try again.');
}

// --- Validation -------------------------------------------------------------

function v_uuid(mixed $value, string $what = 'id'): string
{
    if (!is_string($value) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $value)) {
        throw new HttpError(404, 'not_found', "That {$what} was not found.");
    }
    return strtolower($value);
}

function invalid(string $field, string $message): never
{
    throw new HttpError(422, 'invalid_input', $message, ['field' => $field]);
}

/** NFC-normalised, single-spaced name: letters, marks, spaces, apostrophes, hyphens, full stops. */
function v_full_name(mixed $value): string
{
    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) invalid('fullName', 'Enter your full name.');
    $name = class_exists(\Normalizer::class) ? (string) \Normalizer::normalize($value, \Normalizer::FORM_C) : $value;
    $name = trim((string) preg_replace('/\s+/u', ' ', $name));
    // JavaScript counts UTF-16 code units; match it so both versions accept the same names.
    $length = intdiv(strlen((string) mb_convert_encoding($name, 'UTF-16LE', 'UTF-8')), 2);
    if ($length < 2) invalid('fullName', 'Enter your full name.');
    if ($length > 100) invalid('fullName', 'Your name must be 100 characters or fewer.');
    if (!preg_match("/^\\p{L}[\\p{L}\\p{M}'\u{2019}.\\- ]*$/u", $name)) {
        invalid('fullName', 'Use letters only, with spaces, hyphens or apostrophes where needed.');
    }
    return $name;
}

function v_email(mixed $value): string
{
    if (!is_string($value)) invalid('email', 'Enter your email address.');
    $e = mb_strtolower(trim($value));
    if (mb_strlen($e) > 254 || !preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u', $e)) invalid('email', 'Enter a valid email address, like name@example.com.');
    return $e;
}

function v_optional_phone(mixed $value): ?string
{
    if ($value === null || $value === '') return null;
    if (!is_string($value)) invalid('phone', 'Enter a valid phone number, or leave it blank.');
    $p = trim($value);
    if ($p === '') return null;
    if (!preg_match('/^\+?[0-9 ()-]{7,20}$/', $p) || strlen((string) preg_replace('/\D/', '', $p)) < 7) {
        invalid('phone', 'Enter a valid phone number, or leave it blank.');
    }
    return $p;
}

function v_text(mixed $value, string $field, int $max): string
{
    if (!is_string($value) || trim($value) === '') invalid($field, 'This field is required.');
    $t = trim($value);
    if (mb_strlen($t) > $max) invalid($field, "Use {$max} characters or fewer.");
    return $t;
}
