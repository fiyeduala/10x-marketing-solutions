<?php
/** Small HTTP helpers shared by every route. */
declare(strict_types=1);

namespace Csp;

final class HttpError extends \RuntimeException
{
    /** @param array<string, mixed> $extra */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $extra = [],
    ) {
        parent::__construct($message);
    }
}

final class Response
{
    /** @param array<string, string> $headers */
    public function __construct(
        public readonly int $status,
        public readonly string $body,
        public readonly array $headers,
    ) {
    }

    public function send(): void
    {
        http_response_code($this->status);
        foreach ($this->headers as $name => $value) header("{$name}: {$value}");
        header('Content-Length: ' . strlen($this->body));
        echo $this->body;
    }
}

const BASE_HEADERS = [
    'Content-Type' => 'application/json; charset=utf-8',
    // Candidate data and results must never be cached by browsers or CDNs.
    'Cache-Control' => 'no-store, max-age=0',
    'X-Content-Type-Options' => 'nosniff',
    'Referrer-Policy' => 'no-referrer',
    'X-Robots-Tag' => 'noindex, nofollow',
];

/** @param array<string, string> $headers */
function json(mixed $data, int $status = 200, array $headers = []): Response
{
    $body = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    return new Response($status, $body, array_merge(BASE_HEADERS, $headers));
}

function error_response(HttpError $err): Response
{
    return json(['error' => array_merge(['code' => $err->errorCode, 'message' => $err->getMessage()], $err->extra)], $err->status);
}

/** Encodes a map so that an empty one is `{}`, never `[]`. */
function json_map(array $map): string
{
    return json_encode($map ?: new \stdClass(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}

/** Number as JSON would show it in the TypeScript version: 70 rather than 70.0. */
function num(int|float|string|null $value): int|float|null
{
    if ($value === null) return null;
    $f = (float) $value;
    return floor($f) === $f && abs($f) < 1e15 ? (int) $f : $f;
}

final class Request
{
    public readonly string $method;
    public readonly string $path;
    /** @var array<string, string> */
    public readonly array $query;
    public readonly string $ip;
    private ?string $body = null;
    private ?string $ipHashed = null;

    /** @param array<int, string> $params */
    public array $params = [];

    public function __construct()
    {
        $this->method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $query = [];
        foreach ($_GET as $k => $v) if (is_string($k) && is_string($v)) $query[$k] = $v;
        $this->query = $query;
        $this->path = api_path($query['__path'] ?? null, (string) ($_SERVER['REQUEST_URI'] ?? '/'));
        $this->ip = client_ip();
    }

    public function header(string $name): ?string
    {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        $value = $_SERVER[$key] ?? null;
        if ($value === null && $name === 'authorization') {
            // Apache hides Authorization from PHP unless .htaccess passes it on.
            $value = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null;
        }
        if ($value === null && $name === 'content-type') $value = $_SERVER['CONTENT_TYPE'] ?? null;
        if ($value === null && $name === 'content-length') $value = $_SERVER['CONTENT_LENGTH'] ?? null;
        return $value === null ? null : (string) $value;
    }

    public function query(string $name): ?string
    {
        return $this->query[$name] ?? null;
    }

    public function ipHash(): string
    {
        return $this->ipHashed ??= keyed_hash('ip', $this->ip);
    }

    /** Reads the raw body with a hard size cap. */
    public function text(int $limit = 32 * 1024): string
    {
        $declared = (int) ($this->header('content-length') ?? '0');
        if ($declared > $limit) throw new HttpError(413, 'payload_too_large', 'The request is too large.');
        if ($this->body === null) {
            $stream = fopen('php://input', 'rb');
            $this->body = $stream ? (string) stream_get_contents($stream, $limit + 1) : '';
            if ($stream) fclose($stream);
        }
        if (strlen($this->body) > $limit) throw new HttpError(413, 'payload_too_large', 'The request is too large.');
        return $this->body;
    }

    /** @return array<string, mixed> */
    public function json(): array
    {
        $type = strtolower($this->header('content-type') ?? '');
        if (!str_contains($type, 'application/json')) throw new HttpError(415, 'unsupported_media_type', 'Send JSON.');
        $text = $this->text();
        try {
            $parsed = json_decode($text, false, 64, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new HttpError(400, 'invalid_json', 'The request body is not valid JSON.');
        }
        if (!is_object($parsed)) throw new HttpError(400, 'invalid_body', 'The request body must be a JSON object.');
        return json_decode($text, true, 64, JSON_THROW_ON_ERROR);
    }

    public function bearerToken(): ?string
    {
        $auth = trim($this->header('authorization') ?? '');
        return preg_match('/^Bearer\s+([A-Za-z0-9_\-.]{20,2048})$/', $auth, $m) ? $m[1] : null;
    }

    /**
     * Rejects cross-site state-changing requests from browsers. This is a
     * defence-in-depth check, not authentication: every private route also
     * requires a bearer token, which browsers never attach automatically.
     */
    public function assertSameOrigin(string $allowedOrigin): void
    {
        $origin = $this->header('origin');
        if ($origin === null || $origin === '') return; // Non-browser clients omit it.
        if ($allowedOrigin !== '' && $origin === $allowedOrigin) return;
        $parts = parse_url($origin);
        $host = isset($parts['host']) ? $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '') : null;
        if ($host !== null && strcasecmp($host, (string) ($_SERVER['HTTP_HOST'] ?? '')) === 0) return;
        throw new HttpError(403, 'forbidden_origin', 'This request is not allowed from that origin.');
    }
}

/**
 * Resolves the API path. .htaccess rewrites /api/v1/<path> to
 * api/index.php?__path=<path>; the dev router passes the original pathname.
 */
function api_path(?string $fromQuery, string $uri): string
{
    $raw = $fromQuery ?? preg_replace('#^/api/v1/?#', '', (string) parse_url($uri, PHP_URL_PATH));
    return trim((string) $raw, '/');
}

/**
 * The connecting address, used only for rate limits (hashed). Behind a proxy
 * such as Cloudflare, set CLIENT_IP_HEADER (e.g. CF-Connecting-IP) so every
 * visitor does not share the proxy's address.
 */
function client_ip(): string
{
    if (!Env::isProduction() && env_read('TRUST_TEST_IP') === '1' && !empty($_SERVER['HTTP_X_TEST_CLIENT_IP'])) {
        return (string) $_SERVER['HTTP_X_TEST_CLIENT_IP'];
    }
    $header = env_read('CLIENT_IP_HEADER');
    if ($header !== null) {
        $value = $_SERVER['HTTP_' . strtoupper(str_replace('-', '_', $header))] ?? null;
        if (is_string($value) && ($first = trim(explode(',', $value)[0])) !== '') return $first;
    }
    return (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}
