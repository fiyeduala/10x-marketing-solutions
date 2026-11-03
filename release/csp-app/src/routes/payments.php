<?php
declare(strict_types=1);

namespace Csp\Routes;

use Csp\Config;
use Csp\Db;
use Csp\Env;
use Csp\HttpError;
use Csp\Request;
use Csp\Response;
use function Csp\{apply_verified_transaction, audit, db_time, is_duplicate, json, load_attempt, ms, new_payment_reference, now_ms, paystack_initialize, paystack_signature_valid, paystack_verify, rate_limit, require_candidate, uuid4, v_uuid};
use const Csp\PAYMENT_COLUMNS;

const REUSE_CHECKOUT_MS = 20 * 60_000;

/** Starts (or resumes) a Paystack checkout for a passed attempt's certificate fee. */
function initialize_payment(Request $req): Response
{
    $candidate = require_candidate($req)['candidate'];
    rate_limit('pay-init', $req->ip, 15, 3600);
    $body = $req->json();
    $cfg = Config::get();
    $attempt = load_attempt(v_uuid($body['attemptId'] ?? null, 'attempt'), $candidate['id']);

    // Payment is only possible for an attempt the server marked as passed.
    if ($attempt['status'] !== 'passed') {
        throw new HttpError(409, 'not_eligible', 'A certificate is only available after a passing result.');
    }
    $existing = Db::one('SELECT certificate_number FROM issued_certificates WHERE attempt_id = ?', [$attempt['id']]);
    if ($existing) return json(['alreadyIssued' => true, 'certificateNumber' => $existing['certificate_number']]);
    if (!$cfg['paymentsEnabled'] || Env::paystackSecretKey() === null) {
        throw new HttpError(503, 'payments_unavailable', 'Card payment is not available right now. Please try again later.');
    }

    // An earlier checkout may have been paid already, or may still be usable.
    $open = Db::one('SELECT ' . PAYMENT_COLUMNS . " FROM certificate_payments WHERE attempt_id = ? AND status = 'initialized'", [$attempt['id']]);
    if ($open) {
        $result = apply_verified_transaction($open, paystack_verify($open['reference']), 'candidate-init');
        if ($result['certificateNumber']) return json(['alreadyIssued' => true, 'certificateNumber' => $result['certificateNumber']]);
        if ($result['outcome'] === 'pending' && $open['authorization_url'] && now_ms() - ms($open['created_at']) < REUSE_CHECKOUT_MS) {
            return json(['authorizationUrl' => $open['authorization_url'], 'reference' => $open['reference']]);
        }
        if ($result['outcome'] === 'pending') {
            Db::run("UPDATE certificate_payments SET status = 'abandoned', open_key = NULL WHERE id = ? AND status = 'initialized'", [$open['id']]);
        }
    }

    $reference = new_payment_reference();
    $paymentId = uuid4();
    try {
        Db::run(
            'INSERT INTO certificate_payments (id, candidate_id, attempt_id, reference, amount_kobo, currency, created_at, open_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$paymentId, $candidate['id'], $attempt['id'], $reference, $cfg['certificateFeeKobo'], $cfg['currency'], db_time(now_ms()), $attempt['id']],
        );
    } catch (\PDOException $e) {
        if (is_duplicate($e)) throw new HttpError(409, 'payment_in_progress', 'A payment is already being set up. Please try again.');
        throw $e;
    }

    try {
        $checkout = paystack_initialize(
            $candidate['email'],
            $cfg['certificateFeeKobo'],
            $cfg['currency'],
            $reference,
            Env::appBaseUrl() . '/customer-support-assessment/payment-callback',
            ['purpose' => 'csp_certificate', 'attempt_id' => $attempt['id'], 'payment_id' => $paymentId],
        );
        Db::run('UPDATE certificate_payments SET authorization_url = ? WHERE id = ?', [$checkout['authorizationUrl'], $paymentId]);
        audit('payment.initialized', ['candidateId' => $candidate['id'], 'attemptId' => $attempt['id'], 'paymentId' => $paymentId, 'ipHash' => $req->ipHash()]);
        return json(['authorizationUrl' => $checkout['authorizationUrl'], 'reference' => $reference]);
    } catch (\Throwable $err) {
        Db::run("UPDATE certificate_payments SET status = 'failed', gateway_response = 'initialize_failed', open_key = NULL WHERE id = ?", [$paymentId]);
        throw $err;
    }
}

/** Called after Paystack redirects back. The server asks Paystack directly. */
function verify_payment(Request $req): Response
{
    $candidate = require_candidate($req)['candidate'];
    rate_limit('pay-verify', $req->ip, 40, 600);
    $body = $req->json();
    $reference = is_string($body['reference'] ?? null) && preg_match('/^[A-Za-z0-9.=-]{8,100}$/', $body['reference']) ? $body['reference'] : null;
    if ($reference === null) throw new HttpError(404, 'not_found', 'That payment was not found.');

    $payment = Db::one('SELECT ' . PAYMENT_COLUMNS . ' FROM certificate_payments WHERE reference = ? AND candidate_id = ?', [$reference, $candidate['id']]);
    if (!$payment) throw new HttpError(404, 'not_found', 'That payment was not found.');

    if ($payment['status'] === 'success' || $payment['status'] === 'duplicate_success') {
        $cert = Db::one('SELECT certificate_number FROM issued_certificates WHERE attempt_id = ?', [$payment['attempt_id']]);
        return json(['status' => 'success', 'attemptId' => $payment['attempt_id'], 'certificateNumber' => $cert['certificate_number'] ?? null]);
    }

    $result = apply_verified_transaction($payment, paystack_verify($reference), 'candidate-verify');
    $status = $result['certificateNumber'] ? 'success' : ($result['outcome'] === 'pending' ? 'pending' : 'failed');
    if ($status === 'failed') {
        audit('payment.not_accepted', ['candidateId' => $candidate['id'], 'paymentId' => $payment['id'], 'details' => ['outcome' => $result['outcome']]]);
    }
    return json(['status' => $status, 'outcome' => $result['outcome'], 'attemptId' => $payment['attempt_id'], 'certificateNumber' => $result['certificateNumber']]);
}

/**
 * Paystack webhook. The signature proves the message came from Paystack, but
 * the payment is still re-verified with Paystack's API before anything is
 * issued. Duplicate deliveries are recognised by the body hash.
 */
function paystack_webhook(Request $req): Response
{
    $raw = $req->text(256 * 1024);
    if (!paystack_signature_valid($raw, $req->header('x-paystack-signature'))) {
        rate_limit('webhook-bad', $req->ip, 30, 600);
        audit('webhook.invalid_signature', ['actor' => 'paystack-webhook', 'ipHash' => $req->ipHash()]);
        throw new HttpError(401, 'invalid_signature', 'Invalid signature.');
    }

    $event = json_decode($raw, true);
    if (!is_array($event)) throw new HttpError(400, 'invalid_json', 'Invalid body.');
    $type = mb_substr(is_scalar($event['event'] ?? null) ? (string) $event['event'] : 'unknown', 0, 80);
    $reference = is_string($event['data']['reference'] ?? null) ? substr($event['data']['reference'], 0, 100) : null;

    try {
        Db::run('INSERT INTO paystack_webhook_events (body_hash, event_type, reference, received_at) VALUES (?, ?, ?, ?)', [hash('sha256', $raw), $type, $reference, db_time(now_ms())]);
    } catch (\PDOException $e) {
        if (is_duplicate($e, 'paystack_webhook_events_body_uq')) return json(['received' => true, 'duplicate' => true]);
        throw $e;
    }
    $loggedId = (int) Db::pdo()->lastInsertId();

    try {
        $outcome = 'ignored';
        if ($type === 'charge.success' && $reference !== null) {
            $payment = Db::one('SELECT ' . PAYMENT_COLUMNS . ' FROM certificate_payments WHERE reference = ?', [$reference]);
            $outcome = $payment
                ? apply_verified_transaction($payment, paystack_verify($reference), 'paystack-webhook')['outcome']
                : 'unknown_reference';
        }
        Db::run('UPDATE paystack_webhook_events SET outcome = ?, processed_at = ? WHERE id = ?', [$outcome, db_time(now_ms()), $loggedId]);
        return json(['received' => true]);
    } catch (\Throwable $err) {
        // Let Paystack retry: forget this delivery so the retry is not treated as a duplicate.
        Db::run('DELETE FROM paystack_webhook_events WHERE id = ?', [$loggedId]);
        throw $err;
    }
}
