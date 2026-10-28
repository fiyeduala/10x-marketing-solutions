/** Small HTTP helpers shared by every route. */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

const baseHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  // Candidate data and results must never be cached by browsers or CDNs.
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
};

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...baseHeaders, ...headers } });
}

export function errorResponse(err: HttpError): Response {
  return json({ error: { code: err.code, message: err.message, ...err.extra } }, err.status);
}

const MAX_BODY_BYTES = 32 * 1024;

/** Reads the raw body with a hard size cap. */
export async function readText(request: Request, limit = MAX_BODY_BYTES): Promise<string> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > limit) throw new HttpError(413, 'payload_too_large', 'The request is too large.');
  const text = await request.text();
  if (new TextEncoder().encode(text).length > limit) {
    throw new HttpError(413, 'payload_too_large', 'The request is too large.');
  }
  return text;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().includes('application/json')) {
    throw new HttpError(415, 'unsupported_media_type', 'Send JSON.');
  }
  const text = await readText(request);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid_json', 'The request body is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'invalid_body', 'The request body must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

/** Best-effort client IP from Vercel's edge headers. Used only for rate limits (hashed). */
export function clientIp(request: Request): string {
  const h = request.headers;
  return (
    h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip')?.trim() ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export function bearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+([A-Za-z0-9_\-.]{20,2048})$/.exec(auth.trim());
  return match ? match[1] : null;
}

/**
 * Rejects cross-site state-changing requests from browsers. This is a
 * defence-in-depth check, not authentication: every private route also
 * requires a bearer token, which browsers never attach automatically.
 */
export function assertSameOrigin(request: Request, allowedOrigin: string): void {
  const origin = request.headers.get('origin');
  if (!origin) return; // Non-browser clients (and same-origin GETs) omit it.
  const self = new URL(request.url).origin;
  if (origin !== self && origin !== allowedOrigin) {
    throw new HttpError(403, 'forbidden_origin', 'This request is not allowed from that origin.');
  }
}
