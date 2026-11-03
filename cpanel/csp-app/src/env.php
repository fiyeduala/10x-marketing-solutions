<?php
/**
 * Server-only settings. Real environment variables win; otherwise values come
 * from csp-app/.env, which lives outside public_html so it can never be
 * downloaded. See .env.example for the full list.
 */
declare(strict_types=1);

namespace Csp;

final class ConfigError extends \RuntimeException
{
    public function __construct(public readonly string $variable)
    {
        parent::__construct("Missing server configuration: {$variable}");
    }
}

function load_env_file(string $path): void
{
    if (!is_file($path) || !is_readable($path)) return;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) continue;
        [$name, $value] = array_map('trim', explode('=', $line, 2));
        if (preg_match('/^"(.*)"$|^\'(.*)\'$/s', $value, $m)) $value = $m[1] !== '' ? $m[1] : ($m[2] ?? '');
        // An existing environment variable always takes precedence.
        if ($name !== '' && getenv($name) === false && !array_key_exists($name, $_ENV)) $_ENV[$name] = $value;
    }
}

function env_read(string $name): ?string
{
    $value = getenv($name);
    if ($value === false) $value = $_ENV[$name] ?? null;
    if ($value === null) return null;
    $value = trim((string) $value);
    return $value === '' ? null : $value;
}

function env_require(string $name): string
{
    return env_read($name) ?? throw new ConfigError($name);
}

final class Env
{
    public static function isProduction(): bool
    {
        // Anything other than an explicit "development" is treated as production.
        return env_read('APP_ENV') !== 'development';
    }

    public static function appSecret(): string
    {
        return env_require('APP_SECRET');
    }

    public static function paystackSecretKey(): ?string
    {
        return env_read('PAYSTACK_SECRET_KEY');
    }

    /** Override only for automated tests against a local mock. Ignored in production. */
    public static function paystackApiBase(): string
    {
        $override = self::isProduction() ? null : env_read('PAYSTACK_API_BASE');
        return rtrim($override ?? 'https://api.paystack.co', '/');
    }

    /** Public origin used for Paystack callbacks and certificate links. */
    public static function appBaseUrl(): string
    {
        return rtrim(env_require('APP_BASE_URL'), '/');
    }
}
