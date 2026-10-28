import {
  ATTEMPT_COLUMNS,
  examPayload,
  finalise,
  finaliseIfExpired,
  loadAttempt,
  resultPayload,
  startEligibility,
  submissionDeadline,
  type AttemptRow,
} from '../attempts.js';
import { audit } from '../audit.js';
import { requireCandidate } from '../auth.js';
import { getConfig } from '../config.js';
import type { Ctx } from '../context.js';
import { db, must } from '../db.js';
import { HttpError, json, readJson } from '../http.js';
import { QUESTION_BANK_VERSION } from '../questionBank.js';
import { rateLimit } from '../ratelimit.js';
import { sanitiseAnswers } from '../scoring.js';
import { selectQuestions } from '../selection.js';
import { uuid } from '../validate.js';

async function view(attempt: AttemptRow): Promise<Response> {
  if (attempt.status === 'in_progress') return json({ attempt: examPayload(attempt) });
  return json({ result: await resultPayload(attempt) });
}

/** Starts a fresh attempt, or resumes the one already open. */
export async function startAttempt(ctx: Ctx): Promise<Response> {
  const { candidate } = await requireCandidate(ctx.request);
  const cfg = await getConfig();

  const open = must(
    await db().from('assessment_attempts').select(ATTEMPT_COLUMNS).eq('candidate_id', candidate.id).eq('status', 'in_progress').maybeSingle(),
    'open attempt',
  ) as AttemptRow | null;
  if (open) {
    const current = await finaliseIfExpired(open, cfg);
    if (current.status === 'in_progress') return json({ attempt: examPayload(current), resumed: true });
  }

  const eligibility = await startEligibility(candidate.id, cfg);
  if (!eligibility.allowed) {
    const messages = {
      already_passed: 'You have already passed this assessment.',
      daily_limit: `You can start up to ${cfg.maxAttemptsPerDay} attempts in 24 hours.`,
      cooldown: 'Please wait before retaking the assessment.',
    } as const;
    throw new HttpError(409, eligibility.reason, messages[eligibility.reason], {
      attemptId: eligibility.attemptId,
      nextAttemptAt: eligibility.nextAt,
    });
  }
  await rateLimit('start', ctx.ip, 20, 3600);

  const started = new Date();
  const expires = new Date(started.getTime() + cfg.durationMinutes * 60_000);
  const { data, error } = await db()
    .from('assessment_attempts')
    .insert({
      candidate_id: candidate.id,
      started_at: started.toISOString(),
      expires_at: expires.toISOString(),
      total_questions: cfg.questionsPerAttempt,
      pass_mark: cfg.passMarkPercent,
      question_bank_version: QUESTION_BANK_VERSION,
      questions: selectQuestions(cfg.questionsPerAttempt),
      ip_hash: ctx.ipHash(),
    })
    .select(ATTEMPT_COLUMNS)
    .single();
  if (error?.code === '23505') {
    // A parallel request opened one first; resume it.
    const again = must(
      await db().from('assessment_attempts').select(ATTEMPT_COLUMNS).eq('candidate_id', candidate.id).eq('status', 'in_progress').single(),
      'open attempt after race',
    ) as AttemptRow;
    return json({ attempt: examPayload(again), resumed: true });
  }
  const attempt = must({ data, error }, 'start attempt') as AttemptRow;
  await audit({ type: 'attempt.started', candidateId: candidate.id, attemptId: attempt.id, ipHash: ctx.ipHash() });
  return json({ attempt: examPayload(attempt), resumed: false }, 201);
}

export async function getAttempt(ctx: Ctx): Promise<Response> {
  const { candidate } = await requireCandidate(ctx.request);
  const attempt = await loadAttempt(uuid(ctx.params[0], 'attempt'), candidate.id);
  return view(await finaliseIfExpired(attempt, await getConfig()));
}

/** Autosave. Replaces the saved answers; only accepted until the deadline. */
export async function saveAnswers(ctx: Ctx): Promise<Response> {
  const { candidate } = await requireCandidate(ctx.request);
  await rateLimit('save', ctx.ip, 240, 600);
  const body = await readJson(ctx.request);
  const cfg = await getConfig();
  const attempt = await finaliseIfExpired(await loadAttempt(uuid(ctx.params[0], 'attempt'), candidate.id), cfg);
  if (attempt.status !== 'in_progress') {
    throw new HttpError(409, 'attempt_closed', 'This attempt has already been marked.', { attemptId: attempt.id });
  }
  const answers = sanitiseAnswers(attempt.questions, body.answers);
  const { data, error } = await db()
    .from('assessment_attempts')
    .update({ draft_answers: answers })
    .eq('id', attempt.id)
    .eq('status', 'in_progress')
    .select('id');
  if (error?.code === 'P0001' || (!error && !data?.length)) {
    throw new HttpError(409, 'attempt_closed', 'This attempt has already been marked.', { attemptId: attempt.id });
  }
  must({ data, error }, 'save answers');
  return json({ saved: Object.keys(answers).length, serverNow: new Date().toISOString() });
}

export async function submitAttempt(ctx: Ctx): Promise<Response> {
  const { candidate } = await requireCandidate(ctx.request);
  const body = await readJson(ctx.request);
  const cfg = await getConfig();
  const attempt = await loadAttempt(uuid(ctx.params[0], 'attempt'), candidate.id);
  if (attempt.status !== 'in_progress') return view(attempt);

  const onTime = Date.now() <= submissionDeadline(attempt, cfg);
  // On time: the submitted answers win over earlier autosaves. Late: only
  // what was saved before the deadline counts.
  const answers = onTime
    ? { ...sanitiseAnswers(attempt.questions, attempt.draft_answers), ...sanitiseAnswers(attempt.questions, body.answers) }
    : sanitiseAnswers(attempt.questions, attempt.draft_answers);
  const marked = await finalise(attempt, answers, !onTime, onTime ? 'candidate' : 'timeout');
  return view(marked);
}
