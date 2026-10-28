import { createHash } from 'node:crypto';
import { loadAttempt } from '../attempts.js';
import { audit } from '../audit.js';
import { requireCandidate } from '../auth.js';
import { getConfig } from '../config.js';
import type { Ctx } from '../context.js';
import { newPaymentReference } from '../crypto.js';
import { db, must } from '../db.js';
import { env } from '../env.js';
import { HttpError, json, readJson, readText } from '../http.js';
import { applyVerifiedTransaction, PAYMENT_COLUMNS, type PaymentRow } from '../payments.js';
import { initializeTransaction, signatureIsValid, verifyTransaction } from '../paystack.js';
import { rateLimit } from '../ratelimit.js';
import { uuid } from '../validate.js';

const REUSE_CHECKOUT_MS = 20 * 60_000;

/** Starts (or resumes) a Paystack checkout for a passed attempt's certificate fee. */
export async function initializePayment(ctx: Ctx): Promise<Response> {
  const { candidate } = await requireCandidate(ctx.request);
  await rateLimit('pay-init', ctx.ip, 15, 3600);
  const body = await readJson(ctx.request);
  const cfg = await getConfig();
  const attempt = await loadAttempt(uuid(body.attemptId, 'attempt'), candidate.id);

  // Payment is only possible for an attempt the server marked as passed.
  if (attempt.status !== 'passed') {
    throw new HttpError(409, 'not_eligible', 'A certificate is only available after a passing result.');
  }
  const existingCert = must(
    await db().from('issued_certificates').select('certificate_number').eq('attempt_id', attempt.id).maybeSingle(),
    'cert check',
  );
  if (existingCert) return json({ alreadyIssued: true, certificateNumber: existingCert.certificate_number });
  if (!cfg.paymentsEnabled || !env.paystackSecretKey()) {
    throw new HttpError(503, 'payments_unavailable', 'Card payment is not available right now. Please try again later.');
  }

  // An earlier checkout may have been paid already, or may still be usable.
  const open = must(
    await db().from('certificate_payments').select(PAYMENT_COLUMNS).eq('attempt_id', attempt.id).eq('status', 'initialized').maybeSingle(),
    'open payment',
  ) as PaymentRow | null;
  if (open) {
    const result = await applyVerifiedTransaction(open, await verifyTransaction(open.reference), 'candidate-init');
    if (result.certificateNumber) return json({ alreadyIssued: true, certificateNumber: result.certificateNumber });
    if (result.outcome === 'pending' && open.authorization_url && Date.now() - new Date(open.created_at).getTime() < REUSE_CHECKOUT_MS) {
      return json({ authorizationUrl: open.authorization_url, reference: open.reference });
    }
    if (result.outcome === 'pending') {
      await db().from('certificate_payments').update({ status: 'abandoned' }).eq('id', open.id).eq('status', 'initialized');
    }
  }

  const reference = newPaymentReference();
  const { data: payment, error } = await db()
    .from('certificate_payments')
    .insert({
      candidate_id: candidate.id,
      attempt_id: attempt.id,
      reference,
      amount_kobo: cfg.certificateFeeKobo,
      currency: cfg.currency,
    })
    .select(PAYMENT_COLUMNS)
    .single();
  if (error?.code === '23505') throw new HttpError(409, 'payment_in_progress', 'A payment is already being set up. Please try again.');
  must({ data: payment, error }, 'create payment');

  try {
    const checkout = await initializeTransaction({
      email: candidate.email,
      amountKobo: cfg.certificateFeeKobo,
      currency: cfg.currency,
      reference,
      callbackUrl: `${env.appBaseUrl()}/customer-support-assessment/payment-callback`,
      metadata: { purpose: 'csp_certificate', attempt_id: attempt.id, payment_id: payment!.id },
    });
    await db().from('certificate_payments').update({ authorization_url: checkout.authorizationUrl }).eq('id', payment!.id);
    await audit({ type: 'payment.initialized', candidateId: candidate.id, attemptId: attempt.id, paymentId: payment!.id, ipHash: ctx.ipHash() });
    return json({ authorizationUrl: checkout.authorizationUrl, reference });
  } catch (err) {
    await db().from('certificate_payments').update({ status: 'failed', gateway_response: 'initialize_failed' }).eq('id', payment!.id);
    throw err;
  }
}

/** Called after Paystack redirects back. The server asks Paystack directly. */
export async function verifyPayment(ctx: Ctx): Promise<Response> {
  const { candidate } = await requireCandidate(ctx.request);
  await rateLimit('pay-verify', ctx.ip, 40, 600);
  const body = await readJson(ctx.request);
  const reference = typeof body.reference === 'string' && /^[A-Za-z0-9.=-]{8,100}$/.test(body.reference) ? body.reference : null;
  if (!reference) throw new HttpError(404, 'not_found', 'That payment was not found.');

  const payment = must(
    await db().from('certificate_payments').select(PAYMENT_COLUMNS).eq('reference', reference).eq('candidate_id', candidate.id).maybeSingle(),
    'payment by reference',
  ) as PaymentRow | null;
  if (!payment) throw new HttpError(404, 'not_found', 'That payment was not found.');

  if (payment.status === 'success' || payment.status === 'duplicate_success') {
    const cert = must(
      await db().from('issued_certificates').select('certificate_number').eq('attempt_id', payment.attempt_id).maybeSingle(),
      'cert for payment',
    );
    return json({ status: 'success', attemptId: payment.attempt_id, certificateNumber: cert?.certificate_number ?? null });
  }

  const result = await applyVerifiedTransaction(payment, await verifyTransaction(reference), 'candidate-verify');
  const status = result.certificateNumber ? 'success' : result.outcome === 'pending' ? 'pending' : 'failed';
  if (status === 'failed') {
    await audit({ type: 'payment.not_accepted', candidateId: candidate.id, paymentId: payment.id, details: { outcome: result.outcome } });
  }
  return json({ status, outcome: result.outcome, attemptId: payment.attempt_id, certificateNumber: result.certificateNumber });
}

/**
 * Paystack webhook. The signature proves the message came from Paystack, but
 * the payment is still re-verified with Paystack's API before anything is
 * issued. Duplicate deliveries are recognised by the body hash.
 */
export async function paystackWebhook(ctx: Ctx): Promise<Response> {
  const raw = await readText(ctx.request, 256 * 1024);
  if (!signatureIsValid(raw, ctx.request.headers.get('x-paystack-signature'))) {
    await rateLimit('webhook-bad', ctx.ip, 30, 600);
    await audit({ type: 'webhook.invalid_signature', actor: 'paystack-webhook', ipHash: ctx.ipHash() });
    throw new HttpError(401, 'invalid_signature', 'Invalid signature.');
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'invalid_json', 'Invalid body.');
  }
  const type = String(event.event ?? 'unknown').slice(0, 80);
  const reference = typeof event.data?.reference === 'string' ? event.data.reference.slice(0, 100) : null;
  const bodyHash = createHash('sha256').update(raw).digest('hex');

  const { data: logged, error } = await db()
    .from('paystack_webhook_events')
    .insert({ body_hash: bodyHash, event_type: type, reference })
    .select('id')
    .single();
  if (error?.code === '23505') return json({ received: true, duplicate: true });
  must({ data: logged, error }, 'log webhook');

  try {
    let outcome = 'ignored';
    if (type === 'charge.success' && reference) {
      const payment = must(
        await db().from('certificate_payments').select(PAYMENT_COLUMNS).eq('reference', reference).maybeSingle(),
        'webhook payment',
      ) as PaymentRow | null;
      outcome = payment
        ? (await applyVerifiedTransaction(payment, await verifyTransaction(reference), 'paystack-webhook')).outcome
        : 'unknown_reference';
    }
    await db().from('paystack_webhook_events').update({ outcome, processed_at: new Date().toISOString() }).eq('id', logged!.id);
    return json({ received: true });
  } catch (err) {
    // Let Paystack retry: forget this delivery so the retry is not treated as a duplicate.
    await db().from('paystack_webhook_events').delete().eq('id', logged!.id);
    throw err;
  }
}
