<?php
declare(strict_types=1);

namespace Csp;

const ATTEMPT_COLUMNS = 'id, candidate_id, status, started_at, expires_at, submitted_at, timed_out, total_questions, correct_answers, score_percentage, pass_mark, passed, question_bank_version, questions, draft_answers, category_breakdown';

/** Decodes the JSON columns of an attempt row. */
function attempt_row(array $row): array
{
    $row['questions'] = json_col($row['questions']);
    $row['draft_answers'] = json_col($row['draft_answers']);
    $row['category_breakdown'] = $row['category_breakdown'] === null ? null : json_col($row['category_breakdown']);
    $row['timed_out'] = (bool) $row['timed_out'];
    $row['passed'] = $row['passed'] === null ? null : (bool) $row['passed'];
    return $row;
}

function load_attempt(string $id, string $candidateId): array
{
    $row = Db::one('SELECT ' . ATTEMPT_COLUMNS . ' FROM assessment_attempts WHERE id = ? AND candidate_id = ?', [$id, $candidateId]);
    // Someone else's attempt looks exactly like a missing one.
    if (!$row) throw new HttpError(404, 'not_found', 'That attempt was not found.');
    return attempt_row($row);
}

/** Last moment (ms) a submission is accepted with the answers it carries. */
function submission_deadline(array $attempt, array $cfg): int
{
    return ms($attempt['expires_at']) + $cfg['submissionGraceSeconds'] * 1000;
}

/**
 * Marks an attempt exactly once. Responses and marks are written in one
 * transaction under a row lock, so a second (concurrent or repeated) call
 * changes nothing. Returns the stored row.
 */
function finalise(array $attempt, array $answers, bool $timedOut, string $actor): array
{
    $mark = mark_attempt($attempt['questions'], $answers);
    Db::transaction(function () use ($attempt, $mark, $timedOut, $actor) {
        $locked = Db::one('SELECT status, total_questions, pass_mark, candidate_id FROM assessment_attempts WHERE id = ? FOR UPDATE', [$attempt['id']]);
        if (!$locked) throw new \RuntimeException('attempt not found');
        if ($locked['status'] !== 'in_progress') return;

        $total = (int) $locked['total_questions'];
        $correct = $mark['correct'];
        if ($correct < 0 || $correct > $total) throw new \RuntimeException('invalid score');
        $passed = $correct * 100 >= (float) $locked['pass_mark'] * $total;
        $now = db_time(now_ms());

        if ($mark['responses']) {
            $placeholders = implode(', ', array_fill(0, count($mark['responses']), '(?, ?, ?, ?, ?)'));
            $params = [];
            foreach ($mark['responses'] as $r) array_push($params, $attempt['id'], $r['question_id'], $r['selected_option'], $r['is_correct'] ? 1 : 0, $now);
            Db::run("INSERT INTO assessment_responses (attempt_id, question_id, selected_option, is_correct, submitted_at) VALUES {$placeholders}", $params);
        }
        Db::run(
            "UPDATE assessment_attempts SET status = ?, submitted_at = ?, timed_out = ?, correct_answers = ?, score_percentage = ?, passed = ?, category_breakdown = ?
              WHERE id = ? AND status = 'in_progress'",
            [$passed ? 'passed' : 'failed', $now, $timedOut ? 1 : 0, $correct, round($correct * 100 / $total, 2), $passed ? 1 : 0, json_map($mark['breakdown']), $attempt['id']],
        );
        Db::run(
            'INSERT INTO security_audit_events (event_type, actor, candidate_id, attempt_id, details) VALUES (?, ?, ?, ?, ?)',
            ['attempt.marked', $actor, $locked['candidate_id'], $attempt['id'], json_map(['correct' => $correct, 'total' => $total, 'passed' => $passed, 'timed_out' => $timedOut])],
        );
    });
    return load_attempt($attempt['id'], $attempt['candidate_id']);
}

/** If time (plus grace) has run out, marks the saved answers. */
function finalise_if_expired(array $attempt, array $cfg): array
{
    if ($attempt['status'] !== 'in_progress' || now_ms() <= submission_deadline($attempt, $cfg)) return $attempt;
    return finalise($attempt, $attempt['draft_answers'], true, 'timeout');
}

function exam_payload(array $attempt): array
{
    $started = ms($attempt['started_at']);
    $expires = ms($attempt['expires_at']);
    return [
        'id' => $attempt['id'],
        'status' => $attempt['status'],
        'startedAt' => iso_ms($started),
        'expiresAt' => iso_ms($expires),
        'serverNow' => iso_ms(now_ms()),
        'durationSeconds' => (int) round(($expires - $started) / 1000),
        'totalQuestions' => (int) $attempt['total_questions'],
        'questions' => public_questions($attempt['questions']),
        'answers' => (object) $attempt['draft_answers'],
    ];
}

/** @return array{payment:?array{status:string,reference:string},certificate:?array{number:string,issuedAt:string,revoked:bool}} */
function payment_and_certificate(string $attemptId): array
{
    $rows = Db::all('SELECT status, reference FROM certificate_payments WHERE attempt_id = ? ORDER BY created_at DESC LIMIT 5', [$attemptId]);
    $best = null;
    foreach ($rows as $p) if ($p['status'] === 'success') { $best = $p; break; }
    $best ??= $rows[0] ?? null;
    $c = Db::one('SELECT certificate_number, issued_at, revoked_at FROM issued_certificates WHERE attempt_id = ?', [$attemptId]);
    return [
        'payment' => $best ? ['status' => $best['status'], 'reference' => $best['reference']] : null,
        'certificate' => $c ? ['number' => $c['certificate_number'], 'issuedAt' => iso($c['issued_at']), 'revoked' => $c['revoked_at'] !== null] : null,
    ];
}

/** Marked-attempt view. Shows the score and per-area results, never the answer key. */
function result_payload(array $attempt): array
{
    $cfg = Config::get();
    $pc = payment_and_certificate($attempt['id']);
    $passMark = num($attempt['pass_mark']);
    $cats = Bank::data()['categories'];
    $breakdown = [];
    foreach ($attempt['category_breakdown'] ?? [] as $key => $b) {
        $breakdown[] = ['key' => $key, 'label' => $b['label'], 'correct' => $b['correct'], 'total' => $b['total'], 'chapters' => $cats[$key]['chapters'] ?? []];
    }
    return [
        'id' => $attempt['id'],
        'status' => $attempt['status'],
        'startedAt' => iso($attempt['started_at']),
        'submittedAt' => iso($attempt['submitted_at']),
        'timedOut' => $attempt['timed_out'],
        'totalQuestions' => (int) $attempt['total_questions'],
        'correctAnswers' => $attempt['correct_answers'] === null ? null : (int) $attempt['correct_answers'],
        'scorePercentage' => num($attempt['score_percentage'] ?? 0),
        'passMark' => $passMark,
        'requiredCorrect' => required_correct((int) $attempt['total_questions'], $passMark),
        'passed' => $attempt['passed'] === true,
        'breakdown' => $breakdown,
        'fee' => ['amountKobo' => $cfg['certificateFeeKobo'], 'currency' => $cfg['currency']],
        'payment' => $pc['payment'],
        'certificate' => $pc['certificate'],
    ];
}

/**
 * Whether this candidate may start a new attempt now, and if not, why.
 * @return array{allowed:bool,reason:?string,attemptId:?string,nextAt:?string}
 */
function start_eligibility(string $candidateId, array $cfg): array
{
    $since = now_ms() - 86_400_000;
    $rows = Db::all('SELECT id, status, started_at, submitted_at FROM assessment_attempts WHERE candidate_id = ? ORDER BY started_at DESC LIMIT 50', [$candidateId]);
    foreach ($rows as $r) {
        if ($r['status'] === 'passed') return ['allowed' => false, 'reason' => 'already_passed', 'attemptId' => $r['id'], 'nextAt' => null];
    }
    $recent = array_values(array_filter($rows, fn ($r) => ms($r['started_at']) >= $since));
    if (count($recent) >= $cfg['maxAttemptsPerDay']) {
        $oldest = $recent[count($recent) - 1];
        return ['allowed' => false, 'reason' => 'daily_limit', 'attemptId' => null, 'nextAt' => iso_ms(ms($oldest['started_at']) + 86_400_000)];
    }
    $lastFail = null;
    foreach ($rows as $r) if ($r['status'] === 'failed') { $lastFail = $r; break; }
    if ($lastFail && $cfg['retakeCooldownMinutes'] > 0) {
        $nextAt = ms($lastFail['submitted_at']) + $cfg['retakeCooldownMinutes'] * 60_000;
        if ($nextAt > now_ms()) return ['allowed' => false, 'reason' => 'cooldown', 'attemptId' => null, 'nextAt' => iso_ms($nextAt)];
    }
    return ['allowed' => true, 'reason' => null, 'attemptId' => null, 'nextAt' => null];
}
