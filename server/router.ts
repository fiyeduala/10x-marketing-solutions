import { makeCtx, type Ctx } from './context.js';
import { ConfigError, env } from './env.js';
import { HttpError, assertSameOrigin, errorResponse, json } from './http.js';
import * as admin from './routes/admin.js';
import * as candidate from './routes/candidate.js';
import * as certificates from './routes/certificates.js';
import * as exam from './routes/exam.js';
import * as payments from './routes/payments.js';

type Handler = (ctx: Ctx) => Promise<Response>;
const ID = '([0-9a-fA-F-]{36})';
const CERT = '([0-9A-Za-z-]{12,30})';

const routes: [string, RegExp, Handler][] = [
  ['GET', /^config$/, () => candidate.getPublicConfig()],
  ['POST', /^session$/, candidate.createSession],
  ['DELETE', /^session$/, candidate.signOut],
  ['GET', /^me$/, candidate.getMe],
  ['POST', /^recover$/, candidate.recover],
  ['POST', /^attempts$/, exam.startAttempt],
  ['GET', new RegExp(`^attempts/${ID}$`), exam.getAttempt],
  ['PUT', new RegExp(`^attempts/${ID}/answers$`), exam.saveAnswers],
  ['POST', new RegExp(`^attempts/${ID}/submit$`), exam.submitAttempt],
  ['POST', /^payments\/initialize$/, payments.initializePayment],
  ['POST', /^payments\/verify$/, payments.verifyPayment],
  ['POST', /^paystack\/webhook$/, payments.paystackWebhook],
  ['GET', new RegExp(`^certificates/${CERT}$`), certificates.getCertificate],
  ['GET', new RegExp(`^certificates/${CERT}/pdf$`), certificates.getCertificatePdf],
  ['GET', new RegExp(`^verify/${CERT}$`), certificates.verifyCertificate],
  ['GET', /^admin\/me$/, admin.adminMe],
  ['GET', /^admin\/summary$/, admin.adminSummary],
  ['GET', /^admin\/attempts$/, admin.adminAttempts],
  ['GET', /^admin\/export\.csv$/, admin.adminExport],
  ['GET', /^admin\/audit$/, admin.adminAudit],
  ['PATCH', /^admin\/config$/, admin.adminUpdateConfig],
  ['POST', new RegExp(`^admin/certificates/${CERT}/revoke$`), admin.adminRevoke],
];

/**
 * Resolves the API path. Vercel rewrites /api/v1/<path> to this single
 * function with ?__path=<path>; locally the original pathname arrives.
 */
export function apiPath(url: URL): string {
  const fromQuery = url.searchParams.get('__path');
  const raw = fromQuery ?? url.pathname.replace(/^\/api\/v1\/?/, '');
  return raw.replace(/^\/+|\/+$/g, '');
}

export async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = apiPath(url);
  const method = request.method.toUpperCase();
  try {
    const matches = routes.filter(([, pattern]) => pattern.test(path));
    if (!matches.length) throw new HttpError(404, 'not_found', 'Not found.');
    const route = matches.find(([m]) => m === method);
    if (!route) {
      return json({ error: { code: 'method_not_allowed', message: 'Method not allowed.' } }, 405, {
        Allow: [...new Set(matches.map(([m]) => m))].join(', '),
      });
    }
    // The webhook is server-to-server and authenticated by its signature.
    if (method !== 'GET' && path !== 'paystack/webhook') assertSameOrigin(request, safeBaseUrl());
    return await route[2](makeCtx(request, url, pattern(route[1], path)));
  } catch (err) {
    if (err instanceof HttpError) return errorResponse(err);
    if (err instanceof ConfigError) {
      console.error(`[config] ${err.message}`);
      return errorResponse(new HttpError(503, 'not_configured', 'This service is not available right now. Please try again later.'));
    }
    console.error(`[api] ${method} ${path}:`, err instanceof Error ? err.message : err);
    return errorResponse(new HttpError(500, 'server_error', 'Something went wrong on our side. Please try again.'));
  }
}

function pattern(re: RegExp, path: string): string[] {
  return (re.exec(path) ?? []).slice(1);
}

function safeBaseUrl(): string {
  try {
    return new URL(env.appBaseUrl()).origin;
  } catch {
    return '';
  }
}
