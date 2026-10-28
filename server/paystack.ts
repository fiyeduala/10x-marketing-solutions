import { createHmac } from 'node:crypto';
import { safeEqual } from './crypto.js';
import { env } from './env.js';
import { HttpError } from './http.js';

/**
 * Minimal Paystack client. Endpoints and fields follow Paystack's published
 * OpenAPI specification (PaystackOSS/openapi):
 *   POST /transaction/initialize
 *   GET  /transaction/verify/{reference}
 * Webhooks are signed with HMAC-SHA512 of the raw body using the secret key,
 * sent in the `x-paystack-signature` header.
 */

export interface VerifiedTransaction {
  id: number;
  status: string; // 'success' | 'failed' | 'abandoned' | 'ongoing' | 'pending' | 'reversed' | ...
  reference: string;
  amount: number;
  currency: string;
  paidAt: string | null;
  channel: string | null;
  gatewayResponse: string | null;
}

function secretKey(): string {
  const key = env.paystackSecretKey();
  if (!key) throw new HttpError(503, 'payments_unavailable', 'Card payment is not available right now. Please try again later.');
  return key;
}

async function call(path: string, init: RequestInit): Promise<{ status: number; body: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${env.paystackApiBase()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${secretKey()}`, 'Content-Type': 'application/json', ...init.headers },
    });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  } catch (err) {
    console.error(`[paystack] ${path}: ${(err as Error).name}`);
    throw new HttpError(502, 'payment_provider_unreachable', 'We could not reach the payment provider. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}

export async function initializeTransaction(input: {
  email: string;
  amountKobo: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<{ authorizationUrl: string; accessCode: string; reference: string }> {
  const { status, body } = await call('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
  if (status !== 200 || !body?.status || !body.data?.authorization_url) {
    console.error(`[paystack] initialize failed: HTTP ${status} ${body?.message ?? ''}`);
    throw new HttpError(502, 'payment_init_failed', 'We could not start the payment. Please try again.');
  }
  return { authorizationUrl: body.data.authorization_url, accessCode: body.data.access_code, reference: body.data.reference };
}

/**
 * Asks Paystack directly for the transaction's state. Returns null when
 * Paystack has no record of the reference (for example, checkout never opened).
 */
export async function verifyTransaction(reference: string): Promise<VerifiedTransaction | null> {
  const { status, body } = await call(`/transaction/verify/${encodeURIComponent(reference)}`, { method: 'GET' });
  if (status === 404 || (status === 400 && body?.status === false)) return null;
  if (status !== 200 || !body?.status || !body.data) {
    console.error(`[paystack] verify failed: HTTP ${status} ${body?.message ?? ''}`);
    throw new HttpError(502, 'payment_verify_failed', 'We could not confirm the payment yet. Please try again shortly.');
  }
  const d = body.data;
  return {
    id: Number(d.id),
    status: String(d.status),
    reference: String(d.reference),
    amount: Number(d.amount),
    currency: String(d.currency),
    paidAt: d.paid_at ?? d.paidAt ?? null,
    channel: d.channel ?? null,
    gatewayResponse: d.gateway_response ?? null,
  };
}

export function signatureIsValid(rawBody: string, signature: string | null): boolean {
  const key = env.paystackSecretKey();
  if (!key || !signature) return false;
  const expected = createHmac('sha512', key).update(rawBody, 'utf8').digest('hex');
  return safeEqual(expected, signature.trim().toLowerCase());
}
