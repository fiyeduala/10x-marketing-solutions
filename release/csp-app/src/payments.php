<?php
declare(strict_types=1);

namespace Csp;

// --- Paystack ---------------------------------------------------------------
// Minimal client. Endpoints and fields follow Paystack's published OpenAPI
// specification (PaystackOSS/openapi):
//   POST /transaction/initialize
//   GET  /transaction/verify/{reference}
// Webhooks are signed with HMAC-SHA512 of the raw body using the secret key,
// sent in the `x-paystack-signature` header.

function paystack_secret(): string
{
    $key = Env::paystackSecretKey();
    if ($key === null) throw new HttpError(503, 'payments_unavailable', 'Card payment is not available right now. Please try again later.');
    return $key;
}

/** @return array{status:int,body:mixed} */
function paystack_call(string $path, string $method, ?array $payload = null): array
{
    $ch = curl_init(Env::paystackApiBase() . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . paystack_secret(), 'Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_POSTFIELDS => $payload === null ? null : json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $errno = curl_errno($ch);
    curl_close($ch);
    if ($raw === false || $errno !== 0) {
        error_log("[paystack] {$path}: curl error {$errno}");
        throw new HttpError(502, 'payment_provider_unreachable', 'We could not reach the payment provider. Please try again.');
    }
    return ['status' => $status, 'body' => json_decode((string) $raw, true)];
}

/** @return array{authorizationUrl:string,accessCode:?string,reference:string} */
function paystack_initialize(string $email, int $amountKobo, string $currency, string $reference, string $callbackUrl, array $metadata): array
{
    $r = paystack_call('/transaction/initialize', 'POST', [
        'email' => $email,
        'amount' => $amountKobo,
        'currency' => $currency,
        'reference' => $reference,
        'callback_url' => $callbackUrl,
        'metadata' => $metadata,
    ]);
    $body = is_array($r['body']) ? $r['body'] : [];
    if ($r['status'] !== 200 || empty($body['status']) || empty($body['data']['authorization_url'])) {
        error_log("[paystack] initialize failed: HTTP {$r['status']} " . (is_string($body['message'] ?? null) ? $body['message'] : ''));
        throw new HttpError(502, 'payment_init_failed', 'We could not start the payment. Please try again.');
    }
    return ['authorizationUrl' => (string) $body['data']['authorization_url'], 'accessCode' => $body['data']['access_code'] ?? null, 'reference' => (string) ($body['data']['reference'] ?? $reference)];
}

/**
 * Asks Paystack directly for the transaction's state. Returns null when
 * Paystack has no record of the reference (for example, checkout never opened).
 * @return array{id:int,status:string,reference:string,amount:int,currency:string,paidAt:?string,channel:?string,gatewayResponse:?string}|null
 */
function paystack_verify(string $reference): ?array
{
    $r = paystack_call('/transaction/verify/' . rawurlencode($reference), 'GET');
    $body = is_array($r['body']) ? $r['body'] : [];
    if ($r['status'] === 404 || ($r['status'] === 400 && ($body['status'] ?? null) === false)) return null;
    if ($r['status'] !== 200 || empty($body['status']) || !is_array($body['data'] ?? null)) {
        error_log("[paystack] verify failed: HTTP {$r['status']} " . (is_string($body['message'] ?? null) ? $body['message'] : ''));
        throw new HttpError(502, 'payment_verify_failed', 'We could not confirm the payment yet. Please try again shortly.');
    }
    $d = $body['data'];
    return [
        'id' => (int) ($d['id'] ?? 0),
        'status' => (string) ($d['status'] ?? ''),
        'reference' => (string) ($d['reference'] ?? ''),
        'amount' => (int) ($d['amount'] ?? 0),
        'currency' => (string) ($d['currency'] ?? ''),
        'paidAt' => isset($d['paid_at']) ? (string) $d['paid_at'] : (isset($d['paidAt']) ? (string) $d['paidAt'] : null),
        'channel' => isset($d['channel']) ? (string) $d['channel'] : null,
        'gatewayResponse' => isset($d['gateway_response']) ? (string) $d['gateway_response'] : null,
    ];
}

function paystack_signature_valid(string $rawBody, ?string $signature): bool
{
    $key = Env::paystackSecretKey();
    if ($key === null || $signature === null || $signature === '') return false;
    return hash_equals(hash_hmac('sha512', $rawBody, $key), strtolower(trim($signature)));
}

// --- Recording payments -----------------------------------------------------

const PAYMENT_COLUMNS = 'id, candidate_id, attempt_id, reference, amount_kobo, currency, status, authorization_url, created_at';

/**
 * Applies a transaction that the server itself fetched from Paystack:
 * checks amount, currency, eligibility and duplicates, and issues the
 * certificate in the same transaction.
 * @return array{outcome:string,certificateNumber:?string}
 */
function apply_verified_transaction(array $payment, ?array $tx, string $actor): array
{
    if ($tx === null) return ['outcome' => 'pending', 'certificateNumber' => null];
    if ($tx['reference'] !== $payment['reference']) return ['outcome' => 'reference_mismatch', 'certificateNumber' => null];

    if ($tx['status'] !== 'success') {
        if ($tx['status'] === 'failed' || $tx['status'] === 'reversed') {
            Db::run("UPDATE certificate_payments SET status = 'failed', gateway_response = ? WHERE id = ? AND status = 'initialized'", [mb_substr($tx['gatewayResponse'] ?? $tx['status'], 0, 200), $payment['id']]);
            return ['outcome' => 'failed', 'certificateNumber' => null];
        }
        // 'abandoned', 'ongoing', 'pending', 'processing', 'queued': not final yet.
        return ['outcome' => 'pending', 'certificateNumber' => null];
    }

    for ($tries = 0; $tries < 3; $tries++) {
        try {
            return record_payment_and_issue($payment['id'], $tx, new_certificate_number(), $actor);
        } catch (\PDOException $e) {
            // Certificate-number collision (vanishingly rare): try a new number.
            if (is_duplicate($e, 'issued_certificates_number_uq')) continue;
            throw $e;
        }
    }
    throw new \RuntimeException('Could not allocate a certificate number');
}

/**
 * Records an independently verified payment and issues the certificate
 * atomically and idempotently. All payments for an attempt are serialised by
 * locking the attempt row.
 */
function record_payment_and_issue(string $paymentId, array $tx, string $certificateNumber, string $actor): array
{
    return Db::transaction(function () use ($paymentId, $tx, $certificateNumber, $actor) {
        $payment = Db::one('SELECT attempt_id FROM certificate_payments WHERE id = ?', [$paymentId]);
        if (!$payment) throw new \RuntimeException('payment not found');
        $attempt = Db::one('SELECT id, candidate_id, status, score_percentage FROM assessment_attempts WHERE id = ? FOR UPDATE', [$payment['attempt_id']]);
        $payment = Db::one('SELECT id, candidate_id, attempt_id, amount_kobo, currency, status FROM certificate_payments WHERE id = ? FOR UPDATE', [$paymentId]);
        $paidAt = db_time_from_iso($tx['paidAt']);
        $gateway = $tx['gatewayResponse'] === null ? null : mb_substr($tx['gatewayResponse'], 0, 200);
        $channel = $tx['channel'] === null ? null : mb_substr($tx['channel'], 0, 40);
        $now = db_time(now_ms());

        if ($tx['amount'] !== (int) $payment['amount_kobo'] || $tx['currency'] !== $payment['currency']) {
            audit('payment.mismatch', [
                'actor' => $actor, 'candidateId' => $payment['candidate_id'], 'attemptId' => $payment['attempt_id'], 'paymentId' => $paymentId,
                'details' => ['expected_amount' => (int) $payment['amount_kobo'], 'amount' => $tx['amount'], 'expected_currency' => $payment['currency'], 'currency' => $tx['currency']],
            ]);
            return ['outcome' => 'amount_mismatch', 'certificateNumber' => null];
        }

        if (!$attempt || $attempt['status'] !== 'passed' || $attempt['candidate_id'] !== $payment['candidate_id']) {
            return ['outcome' => 'not_eligible', 'certificateNumber' => null];
        }

        // Already processed (duplicate callback/webhook): return the certificate.
        if ($payment['status'] === 'success' || $payment['status'] === 'duplicate_success') {
            $cert = Db::one('SELECT certificate_number FROM issued_certificates WHERE attempt_id = ?', [$attempt['id']]);
            return ['outcome' => 'already_recorded', 'certificateNumber' => $cert['certificate_number'] ?? null];
        }

        // A different payment for this attempt already succeeded: keep this one
        // on record for refund follow-up, do not issue a second certificate.
        if (Db::one("SELECT 1 AS x FROM certificate_payments WHERE attempt_id = ? AND status = 'success'", [$attempt['id']])) {
            Db::run(
                "UPDATE certificate_payments SET status = 'duplicate_success', paystack_transaction_id = ?, paid_at = ?, verified_at = ?, channel = ?, gateway_response = ? WHERE id = ?",
                [$tx['id'], $paidAt, $now, $channel, $gateway, $paymentId],
            );
            audit('payment.duplicate_success', ['actor' => $actor, 'candidateId' => $payment['candidate_id'], 'attemptId' => $attempt['id'], 'paymentId' => $paymentId, 'details' => ['action' => 'review_for_refund']]);
            $cert = Db::one('SELECT certificate_number FROM issued_certificates WHERE attempt_id = ?', [$attempt['id']]);
            return ['outcome' => 'duplicate_payment', 'certificateNumber' => $cert['certificate_number'] ?? null];
        }

        Db::run(
            "UPDATE certificate_payments SET status = 'success', paystack_transaction_id = ?, paid_at = ?, verified_at = ?, channel = ?, gateway_response = ? WHERE id = ?",
            [$tx['id'], $paidAt, $now, $channel, $gateway, $paymentId],
        );
        $candidate = Db::one('SELECT full_name FROM assessment_candidates WHERE id = ?', [$attempt['candidate_id']]);
        $certId = uuid4();
        Db::run(
            'INSERT INTO issued_certificates (id, certificate_number, candidate_id, attempt_id, payment_id, certificate_title, recipient_name, score_percentage, issued_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$certId, $certificateNumber, $attempt['candidate_id'], $attempt['id'], $paymentId, CERTIFICATE_TITLE, $candidate['full_name'], $attempt['score_percentage'], $now],
        );
        audit('payment.verified', ['actor' => $actor, 'candidateId' => $attempt['candidate_id'], 'attemptId' => $attempt['id'], 'paymentId' => $paymentId, 'details' => ['amount_kobo' => $tx['amount'], 'channel' => $channel]]);
        audit('certificate.issued', ['actor' => $actor, 'candidateId' => $attempt['candidate_id'], 'attemptId' => $attempt['id'], 'paymentId' => $paymentId, 'certificateId' => $certId, 'details' => ['certificate_number' => $certificateNumber]]);
        return ['outcome' => 'issued', 'certificateNumber' => $certificateNumber];
    });
}
