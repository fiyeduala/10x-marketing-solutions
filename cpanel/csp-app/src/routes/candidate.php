<?php
declare(strict_types=1);

namespace Csp\Routes;

use Csp\Config;
use Csp\Db;
use Csp\Env;
use Csp\HttpError;
use Csp\Request;
use Csp\Response;
use function Csp\{audit, finalise_if_expired, attempt_row, issue_access_token, iso, json, keyed_hash, new_access_token, new_recovery_code, normalise_recovery_code, now_ms, db_time, num, rate_limit, require_candidate, required_correct, start_eligibility, unsupported_name_characters, uuid4, v_email, v_full_name, v_optional_phone};
use const Csp\ATTEMPT_COLUMNS;

function get_public_config(Request $req): Response
{
    $cfg = Config::get();
    return json([
        'questionsPerAttempt' => $cfg['questionsPerAttempt'],
        'durationMinutes' => $cfg['durationMinutes'],
        'passMarkPercent' => $cfg['passMarkPercent'],
        'requiredCorrect' => required_correct($cfg['questionsPerAttempt'], $cfg['passMarkPercent']),
        'certificateFeeKobo' => $cfg['certificateFeeKobo'],
        'currency' => $cfg['currency'],
        'maxAttemptsPerDay' => $cfg['maxAttemptsPerDay'],
        'retakeCooldownMinutes' => $cfg['retakeCooldownMinutes'],
        'privacyNoticeVersion' => $cfg['privacyNoticeVersion'],
        'paymentsAvailable' => $cfg['paymentsEnabled'] && Env::paystackSecretKey() !== null,
    ]);
}

/** Registration: no account, just a capability token and a one-time recovery code. */
function create_session(Request $req): Response
{
    rate_limit('register', $req->ip, 10, 3600);
    $body = $req->json();
    $cfg = Config::get();

    $fullName = v_full_name($body['fullName'] ?? null);
    $bad = unsupported_name_characters($fullName);
    if ($bad) {
        throw new HttpError(422, 'invalid_input', 'Your name contains characters the certificate cannot print: ' . implode(' ', $bad), ['field' => 'fullName']);
    }
    $email = v_email($body['email'] ?? null);
    $phone = v_optional_phone($body['phone'] ?? null);
    if (($body['acceptTerms'] ?? null) !== true) {
        throw new HttpError(422, 'invalid_input', 'Please confirm that you accept the terms and have read the privacy notice.', ['field' => 'acceptTerms']);
    }
    if (($body['privacyNoticeVersion'] ?? null) !== $cfg['privacyNoticeVersion']) {
        throw new HttpError(409, 'notice_changed', 'The privacy notice has been updated. Please reload the page and review it.');
    }

    $recoveryCode = new_recovery_code();
    $id = uuid4();
    Db::run(
        'INSERT INTO assessment_candidates (id, full_name, normalised_email, phone, consent_at, privacy_notice_version, recovery_code_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [$id, $fullName, $email, $phone, db_time(now_ms()), $cfg['privacyNoticeVersion'], keyed_hash('recovery', str_replace('-', '', $recoveryCode))],
    );
    $token = new_access_token();
    issue_access_token($id, $cfg['accessTokenTtlDays'], $token);
    audit('candidate.registered', ['candidateId' => $id, 'ipHash' => $req->ipHash(), 'details' => ['notice' => $cfg['privacyNoticeVersion']]]);

    return json(['token' => $token, 'recoveryCode' => $recoveryCode, 'candidate' => ['fullName' => $fullName, 'email' => $email, 'phone' => $phone]], 201);
}

function get_me(Request $req): Response
{
    $candidate = require_candidate($req)['candidate'];
    $cfg = Config::get();
    $rows = array_map('Csp\attempt_row', Db::all('SELECT ' . ATTEMPT_COLUMNS . ' FROM assessment_attempts WHERE candidate_id = ? ORDER BY started_at DESC LIMIT 20', [$candidate['id']]));

    // Lazily mark an attempt whose time ran out while the candidate was away.
    foreach ($rows as $i => $r) {
        if ($r['status'] === 'in_progress') {
            $rows[$i] = finalise_if_expired($r, $cfg);
            break;
        }
    }

    $certByAttempt = [];
    if ($rows) {
        $ids = array_column($rows, 'id');
        $marks = implode(', ', array_fill(0, count($ids), '?'));
        foreach (Db::all("SELECT attempt_id, certificate_number, revoked_at FROM issued_certificates WHERE attempt_id IN ({$marks})", $ids) as $c) {
            $certByAttempt[$c['attempt_id']] = $c;
        }
    }
    $eligibility = start_eligibility($candidate['id'], $cfg);
    $active = null;
    foreach ($rows as $r) if ($r['status'] === 'in_progress') { $active = $r; break; }

    return json([
        'candidate' => ['fullName' => $candidate['fullName'], 'email' => $candidate['email'], 'phone' => $candidate['phone']],
        'activeAttemptId' => $active['id'] ?? null,
        'canStart' => !$active && $eligibility['allowed'],
        'blockedReason' => $active ? 'in_progress' : $eligibility['reason'],
        'nextAttemptAt' => $eligibility['nextAt'],
        'attempts' => array_map(function ($r) use ($certByAttempt) {
            $cert = $certByAttempt[$r['id']] ?? null;
            return [
                'id' => $r['id'],
                'status' => $r['status'],
                'startedAt' => iso($r['started_at']),
                'submittedAt' => iso($r['submitted_at']),
                'scorePercentage' => num($r['score_percentage']),
                'correctAnswers' => $r['correct_answers'] === null ? null : (int) $r['correct_answers'],
                'totalQuestions' => (int) $r['total_questions'],
                'certificateNumber' => $cert && $cert['revoked_at'] === null ? $cert['certificate_number'] : null,
            ];
        }, $rows),
    ]);
}

/** Restores access on a new device or after clearing the browser. */
function recover(Request $req): Response
{
    rate_limit('recover', $req->ip, 5, 900);
    $body = $req->json();
    $email = v_email($body['email'] ?? null);
    rate_limit('recover-email', $email, 10, 86_400);
    $code = is_string($body['recoveryCode'] ?? null) ? normalise_recovery_code($body['recoveryCode']) : null;
    $generic = new HttpError(401, 'recovery_failed', 'That email address and recovery code do not match our records.');
    if ($code === null) throw $generic;

    $candidate = Db::one(
        'SELECT id, full_name, normalised_email, phone FROM assessment_candidates WHERE recovery_code_hash = ? AND normalised_email = ?',
        [keyed_hash('recovery', str_replace('-', '', $code)), $email],
    );
    if (!$candidate) {
        audit('candidate.recovery_failed', ['ipHash' => $req->ipHash()]);
        throw $generic;
    }
    $cfg = Config::get();
    $token = new_access_token();
    issue_access_token($candidate['id'], $cfg['accessTokenTtlDays'], $token);
    audit('candidate.recovered', ['candidateId' => $candidate['id'], 'ipHash' => $req->ipHash()]);
    return json(['token' => $token, 'candidate' => ['fullName' => $candidate['full_name'], 'email' => $candidate['normalised_email'], 'phone' => $candidate['phone']]]);
}

/** Ends this browser's session (other devices keep theirs). */
function sign_out(Request $req): Response
{
    $session = require_candidate($req);
    Db::run('UPDATE assessment_access_tokens SET revoked_at = ? WHERE id = ?', [db_time(now_ms()), $session['tokenId']]);
    return json(['ok' => true]);
}
