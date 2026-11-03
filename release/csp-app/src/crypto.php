<?php
declare(strict_types=1);

namespace Csp;

/** Crockford base32 without I, L, O, U: easy to read aloud and type. */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function crockford(int $length): string
{
    $out = '';
    for ($i = 0; $i < $length; $i++) $out .= CROCKFORD[random_int(0, 31)];
    return $out;
}

function base64url(string $bytes): string
{
    return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
}

/** 256-bit bearer token for a candidate's (or admin's) browser. */
function new_access_token(): string
{
    return base64url(random_bytes(32));
}

/** 80-bit recovery code, e.g. 7KQ2-M9XD-4TBR-ZP0H. Shown once, stored hashed. */
function new_recovery_code(): string
{
    return implode('-', [crockford(4), crockford(4), crockford(4), crockford(4)]);
}

/** Accepts lower case, spaces and the usual Crockford look-alikes. */
function normalise_recovery_code(string $input): ?string
{
    $cleaned = preg_replace('/[\s-]/', '', strtoupper($input));
    $cleaned = str_replace(['I', 'L', 'O'], ['1', '1', '0'], (string) $cleaned);
    if (!preg_match('/^[0-9A-HJKMNP-TV-Z]{16}$/', $cleaned)) return null;
    return implode('-', str_split($cleaned, 4));
}

/** 60-bit certificate number: 10X-CSP-XXXX-XXXX-XXXX (not enumerable). */
function new_certificate_number(): string
{
    return '10X-CSP-' . crockford(4) . '-' . crockford(4) . '-' . crockford(4);
}

function normalise_certificate_number(string $input): ?string
{
    $cleaned = preg_replace('/\s/', '', strtoupper($input));
    $cleaned = preg_replace('/^10X-?CSP-?/', '', (string) $cleaned);
    $cleaned = str_replace('-', '', (string) $cleaned);
    if (!preg_match('/^[0-9A-HJKMNP-TV-Z]{12}$/', $cleaned)) return null;
    return '10X-CSP-' . substr($cleaned, 0, 4) . '-' . substr($cleaned, 4, 4) . '-' . substr($cleaned, 8, 4);
}

/** Unguessable Paystack reference (only -, ., = and alphanumerics allowed). */
function new_payment_reference(): string
{
    return '10xcsp-' . bin2hex(random_bytes(12));
}

/** Keyed hash for tokens, recovery codes and IPs. Raw values are never stored. */
function keyed_hash(string $purpose, string $value): string
{
    return base64url(hash_hmac('sha256', "{$purpose}:{$value}", Env::appSecret(), true));
}

function uuid4(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    $h = bin2hex($b);
    return substr($h, 0, 8) . '-' . substr($h, 8, 4) . '-' . substr($h, 12, 4) . '-' . substr($h, 16, 4) . '-' . substr($h, 20);
}

/**
 * Fisher–Yates with an unbiased RNG. Returns a new array.
 * @template T
 * @param list<T> $items
 * @return list<T>
 */
function shuffle_secure(array $items): array
{
    $out = array_values($items);
    for ($i = count($out) - 1; $i > 0; $i--) {
        $j = random_int(0, $i);
        [$out[$i], $out[$j]] = [$out[$j], $out[$i]];
    }
    return $out;
}

// --- Time -------------------------------------------------------------------
// The database stores UTC DATETIME(3); the API speaks ISO 8601 with a Z, the
// same shape JavaScript's toISOString() produces.

function now_ms(): int
{
    return (int) floor(microtime(true) * 1000);
}

/** Milliseconds since the epoch → 'Y-m-d H:i:s.v' (UTC) for the database. */
function db_time(int $ms): string
{
    $seconds = intdiv($ms, 1000);
    return gmdate('Y-m-d H:i:s', $seconds) . sprintf('.%03d', $ms % 1000);
}

/** Database DATETIME (UTC) → milliseconds since the epoch. */
function ms(string $dbTime): int
{
    $dt = \DateTimeImmutable::createFromFormat('Y-m-d H:i:s.u', strlen($dbTime) === 19 ? "{$dbTime}.000" : $dbTime, new \DateTimeZone('UTC'));
    if (!$dt) throw new \RuntimeException('Unreadable time');
    return (int) $dt->format('U') * 1000 + intdiv((int) $dt->format('u'), 1000);
}

function iso_ms(int $ms): string
{
    return gmdate('Y-m-d\TH:i:s', intdiv($ms, 1000)) . sprintf('.%03dZ', $ms % 1000);
}

function iso(?string $dbTime): ?string
{
    return $dbTime === null ? null : iso_ms(ms($dbTime));
}

/** ISO 8601 from an outside source (e.g. Paystack's paid_at) → database time. */
function db_time_from_iso(?string $iso): ?string
{
    if ($iso === null || $iso === '') return null;
    try {
        $dt = new \DateTimeImmutable($iso);
    } catch (\Exception) {
        return null;
    }
    return db_time((int) $dt->format('U') * 1000 + intdiv((int) $dt->format('u'), 1000));
}
