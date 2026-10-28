import { getConfig, requiredCorrect, type AssessmentConfig } from './config.js';
import { db, must } from './db.js';
import { HttpError } from './http.js';
import { CATEGORIES, type Category, type OptionKey } from './questionBank.js';
import { markAttempt, type Breakdown } from './scoring.js';
import { toPublicQuestions, type ServedQuestion } from './selection.js';

export interface AttemptRow {
  id: string;
  candidate_id: string;
  status: 'in_progress' | 'passed' | 'failed';
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  timed_out: boolean;
  total_questions: number;
  correct_answers: number | null;
  score_percentage: number | string | null;
  pass_mark: number | string;
  passed: boolean | null;
  question_bank_version: string;
  questions: ServedQuestion[];
  draft_answers: Record<string, OptionKey>;
  category_breakdown: Breakdown | null;
}

export const ATTEMPT_COLUMNS =
  'id, candidate_id, status, started_at, expires_at, submitted_at, timed_out, total_questions, correct_answers, score_percentage, pass_mark, passed, question_bank_version, questions, draft_answers, category_breakdown';

export async function loadAttempt(id: string, candidateId: string): Promise<AttemptRow> {
  const row = must(
    await db().from('assessment_attempts').select(ATTEMPT_COLUMNS).eq('id', id).eq('candidate_id', candidateId).maybeSingle(),
    'load attempt',
  );
  // Someone else's attempt looks exactly like a missing one.
  if (!row) throw new HttpError(404, 'not_found', 'That attempt was not found.');
  return row as AttemptRow;
}

/** Last moment a submission is accepted with the answers it carries. */
export function submissionDeadline(attempt: AttemptRow, cfg: AssessmentConfig): number {
  return new Date(attempt.expires_at).getTime() + cfg.submissionGraceSeconds * 1000;
}

/** Marks an attempt once (the database ignores repeats) and returns the stored row. */
export async function finalise(
  attempt: AttemptRow,
  answers: Record<string, OptionKey>,
  timedOut: boolean,
  actor: string,
): Promise<AttemptRow> {
  const mark = markAttempt(attempt.questions, answers);
  must(
    await db().rpc('csp_finalize_attempt', {
      p_attempt_id: attempt.id,
      p_responses: mark.responses,
      p_correct: mark.correct,
      p_timed_out: timedOut,
      p_breakdown: mark.breakdown,
      p_actor: actor,
    }),
    'finalise attempt',
  );
  return loadAttempt(attempt.id, attempt.candidate_id);
}

/** If time (plus grace) has run out, marks the saved answers. */
export async function finaliseIfExpired(attempt: AttemptRow, cfg: AssessmentConfig): Promise<AttemptRow> {
  if (attempt.status !== 'in_progress' || Date.now() <= submissionDeadline(attempt, cfg)) return attempt;
  return finalise(attempt, attempt.draft_answers ?? {}, true, 'timeout');
}

export function examPayload(attempt: AttemptRow) {
  const started = new Date(attempt.started_at).getTime();
  const expires = new Date(attempt.expires_at).getTime();
  return {
    id: attempt.id,
    status: attempt.status,
    startedAt: attempt.started_at,
    expiresAt: attempt.expires_at,
    serverNow: new Date().toISOString(),
    durationSeconds: Math.round((expires - started) / 1000),
    totalQuestions: attempt.total_questions,
    questions: toPublicQuestions(attempt.questions),
    answers: attempt.draft_answers ?? {},
  };
}

export interface PaymentSummary {
  status: string;
  reference: string;
}

export interface CertificateSummary {
  number: string;
  issuedAt: string;
  revoked: boolean;
}

export async function paymentAndCertificate(attemptId: string): Promise<{
  payment: PaymentSummary | null;
  certificate: CertificateSummary | null;
}> {
  const [payments, cert] = await Promise.all([
    db()
      .from('certificate_payments')
      .select('status, reference, created_at')
      .eq('attempt_id', attemptId)
      .order('created_at', { ascending: false })
      .limit(5),
    db().from('issued_certificates').select('certificate_number, issued_at, revoked_at').eq('attempt_id', attemptId).maybeSingle(),
  ]);
  const rows = must(payments, 'payments for attempt') ?? [];
  const best = rows.find((p) => p.status === 'success') ?? rows[0] ?? null;
  const c = must(cert, 'certificate for attempt');
  return {
    payment: best ? { status: best.status, reference: best.reference } : null,
    certificate: c ? { number: c.certificate_number, issuedAt: c.issued_at, revoked: !!c.revoked_at } : null,
  };
}

/** Marked-attempt view. Shows the score and per-area results, never the answer key. */
export async function resultPayload(attempt: AttemptRow) {
  const cfg = await getConfig();
  const { payment, certificate } = await paymentAndCertificate(attempt.id);
  const passMark = Number(attempt.pass_mark);
  return {
    id: attempt.id,
    status: attempt.status,
    startedAt: attempt.started_at,
    submittedAt: attempt.submitted_at,
    timedOut: attempt.timed_out,
    totalQuestions: attempt.total_questions,
    correctAnswers: attempt.correct_answers,
    scorePercentage: Number(attempt.score_percentage),
    passMark,
    requiredCorrect: requiredCorrect(attempt.total_questions, passMark),
    passed: attempt.passed === true,
    breakdown: Object.entries(attempt.category_breakdown ?? {}).map(([key, b]) => ({
      key,
      ...b,
      chapters: CATEGORIES[key as Category]?.chapters ?? [],
    })),
    fee: { amountKobo: cfg.certificateFeeKobo, currency: cfg.currency },
    payment,
    certificate,
  };
}

/** Whether this candidate may start a new attempt now, and if not, why. */
export async function startEligibility(candidateId: string, cfg: AssessmentConfig) {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const rows = must(
    await db()
      .from('assessment_attempts')
      .select('id, status, started_at, submitted_at')
      .eq('candidate_id', candidateId)
      .order('started_at', { ascending: false })
      .limit(50),
    'attempt history',
  ) ?? [];
  const passed = rows.find((r) => r.status === 'passed');
  if (passed) return { allowed: false as const, reason: 'already_passed' as const, attemptId: passed.id as string, nextAt: null };

  const recent = rows.filter((r) => r.started_at >= since);
  if (recent.length >= cfg.maxAttemptsPerDay) {
    const oldest = recent[recent.length - 1];
    const nextAt = new Date(new Date(oldest.started_at).getTime() + 86_400_000).toISOString();
    return { allowed: false as const, reason: 'daily_limit' as const, attemptId: null, nextAt };
  }
  const lastFail = rows.find((r) => r.status === 'failed');
  if (lastFail && cfg.retakeCooldownMinutes > 0) {
    const nextAt = new Date(new Date(lastFail.submitted_at).getTime() + cfg.retakeCooldownMinutes * 60_000);
    if (nextAt.getTime() > Date.now()) {
      return { allowed: false as const, reason: 'cooldown' as const, attemptId: null, nextAt: nextAt.toISOString() };
    }
  }
  return { allowed: true as const, reason: null, attemptId: null, nextAt: null };
}
