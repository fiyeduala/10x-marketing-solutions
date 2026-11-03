<?php
declare(strict_types=1);

namespace Csp\Routes;

use Csp\Bank;
use Csp\Config;
use Csp\Db;
use Csp\HttpError;
use Csp\Request;
use Csp\Response;
use function Csp\{attempt_row, audit, db_time, exam_payload, finalise, finalise_if_expired, is_duplicate, json, json_map, load_attempt, now_ms, rate_limit, require_candidate, result_payload, sanitise_answers, select_questions, start_eligibility, submission_deadline, uuid4, v_uuid};
use const Csp\ATTEMPT_COLUMNS;

function attempt_view(array $attempt): Response
{
    if ($attempt['status'] === 'in_progress') return json(['attempt' => exam_payload($attempt)]);
    return json(['result' => result_payload($attempt)]);
}

function open_attempt(string $candidateId): ?array
{
    $row = Db::one('SELECT ' . ATTEMPT_COLUMNS . " FROM assessment_attempts WHERE candidate_id = ? AND status = 'in_progress'", [$candidateId]);
    return $row ? attempt_row($row) : null;
}

/** Starts a fresh attempt, or resumes the one already open. */
function start_attempt(Request $req): Response
{
    $candidate = require_candidate($req)['candidate'];
    $cfg = Config::get();

    $open = open_attempt($candidate['id']);
    if ($open) {
        $current = finalise_if_expired($open, $cfg);
        if ($current['status'] === 'in_progress') return json(['attempt' => exam_payload($current), 'resumed' => true]);
    }

    $eligibility = start_eligibility($candidate['id'], $cfg);
    if (!$eligibility['allowed']) {
        $messages = [
            'already_passed' => 'You have already passed this assessment.',
            'daily_limit' => "You can start up to {$cfg['maxAttemptsPerDay']} attempts in 24 hours.",
            'cooldown' => 'Please wait before retaking the assessment.',
        ];
        throw new HttpError(409, $eligibility['reason'], $messages[$eligibility['reason']], [
            'attemptId' => $eligibility['attemptId'],
            'nextAttemptAt' => $eligibility['nextAt'],
        ]);
    }
    rate_limit('start', $req->ip, 20, 3600);

    $started = now_ms();
    $id = uuid4();
    try {
        Db::run(
            'INSERT INTO assessment_attempts (id, candidate_id, started_at, expires_at, total_questions, pass_mark, question_bank_version, questions, draft_answers, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$id, $candidate['id'], db_time($started), db_time($started + $cfg['durationMinutes'] * 60_000), $cfg['questionsPerAttempt'], (string) $cfg['passMarkPercent'], Bank::version(), json_encode(select_questions($cfg['questionsPerAttempt']), JSON_THROW_ON_ERROR), json_map([]), $req->ipHash()],
        );
    } catch (\PDOException $e) {
        if (!is_duplicate($e, 'assessment_attempts_one_open_uq')) throw $e;
        // A parallel request opened one first; resume it.
        $again = open_attempt($candidate['id']);
        if (!$again) throw $e;
        return json(['attempt' => exam_payload($again), 'resumed' => true]);
    }
    $attempt = load_attempt($id, $candidate['id']);
    audit('attempt.started', ['candidateId' => $candidate['id'], 'attemptId' => $id, 'ipHash' => $req->ipHash()]);
    return json(['attempt' => exam_payload($attempt), 'resumed' => false], 201);
}

function get_attempt(Request $req): Response
{
    $candidate = require_candidate($req)['candidate'];
    $attempt = load_attempt(v_uuid($req->params[0] ?? null, 'attempt'), $candidate['id']);
    return attempt_view(finalise_if_expired($attempt, Config::get()));
}

/** Autosave. Replaces the saved answers; only accepted until the deadline. */
function save_answers(Request $req): Response
{
    $candidate = require_candidate($req)['candidate'];
    rate_limit('save', $req->ip, 240, 600);
    $body = $req->json();
    $cfg = Config::get();
    $attempt = finalise_if_expired(load_attempt(v_uuid($req->params[0] ?? null, 'attempt'), $candidate['id']), $cfg);
    $closed = fn () => new HttpError(409, 'attempt_closed', 'This attempt has already been marked.', ['attemptId' => $attempt['id']]);
    if ($attempt['status'] !== 'in_progress') throw $closed();
    $answers = sanitise_answers($attempt['questions'], $body['answers'] ?? null);
    $changed = Db::exec("UPDATE assessment_attempts SET draft_answers = ? WHERE id = ? AND status = 'in_progress'", [json_map($answers), $attempt['id']]);
    // Zero rows can also mean "same answers as before"; only a status change is an error.
    if ($changed === 0 && Db::one("SELECT 1 AS x FROM assessment_attempts WHERE id = ? AND status = 'in_progress'", [$attempt['id']]) === null) throw $closed();
    return json(['saved' => count($answers), 'serverNow' => \Csp\iso_ms(now_ms())]);
}

function submit_attempt(Request $req): Response
{
    $candidate = require_candidate($req)['candidate'];
    $body = $req->json();
    $cfg = Config::get();
    $attempt = load_attempt(v_uuid($req->params[0] ?? null, 'attempt'), $candidate['id']);
    if ($attempt['status'] !== 'in_progress') return attempt_view($attempt);

    $onTime = now_ms() <= submission_deadline($attempt, $cfg);
    // On time: the submitted answers win over earlier autosaves. Late: only
    // what was saved before the deadline counts.
    $answers = $onTime
        ? array_merge(sanitise_answers($attempt['questions'], $attempt['draft_answers']), sanitise_answers($attempt['questions'], $body['answers'] ?? null))
        : sanitise_answers($attempt['questions'], $attempt['draft_answers']);
    return attempt_view(finalise($attempt, $answers, !$onTime, $onTime ? 'candidate' : 'timeout'));
}
