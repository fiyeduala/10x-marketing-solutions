import { audit } from '../audit.js';
import { finaliseIfExpired, startEligibility, ATTEMPT_COLUMNS, type AttemptRow } from '../attempts.js';
import { issueAccessToken, requireCandidate } from '../auth.js';
import { unsupportedNameCharacters } from '../certificatePdf.js';
import { getConfig, requiredCorrect } from '../config.js';
import type { Ctx } from '../context.js';
import { keyedHash, newAccessToken, newRecoveryCode, normaliseRecoveryCode } from '../crypto.js';
import { db, must } from '../db.js';
import { env } from '../env.js';
import { HttpError, json, readJson } from '../http.js';
import { rateLimit } from '../ratelimit.js';
import * as v from '../validate.js';

export async function getPublicConfig(): Promise<Response> {
  const cfg = await getConfig();
  return json({
    questionsPerAttempt: cfg.questionsPerAttempt,
    durationMinutes: cfg.durationMinutes,
    passMarkPercent: cfg.passMarkPercent,
    requiredCorrect: requiredCorrect(cfg.questionsPerAttempt, cfg.passMarkPercent),
    certificateFeeKobo: cfg.certificateFeeKobo,
    currency: cfg.currency,
    maxAttemptsPerDay: cfg.maxAttemptsPerDay,
    retakeCooldownMinutes: cfg.retakeCooldownMinutes,
    privacyNoticeVersion: cfg.privacyNoticeVersion,
    paymentsAvailable: cfg.paymentsEnabled && !!env.paystackSecretKey(),
  });
}

/** Registration: no account, just a capability token and a one-time recovery code. */
export async function createSession(ctx: Ctx): Promise<Response> {
  await rateLimit('register', ctx.ip, 10, 3600);
  const body = await readJson(ctx.request);
  const cfg = await getConfig();

  const fullName = v.fullName(body.fullName);
  const bad = unsupportedNameCharacters(fullName);
  if (bad.length) {
    throw new HttpError(422, 'invalid_input', `Your name contains characters the certificate cannot print: ${bad.join(' ')}`, {
      field: 'fullName',
    });
  }
  const email = v.email(body.email);
  const phone = v.optionalPhone(body.phone);
  if (body.acceptTerms !== true) {
    throw new HttpError(422, 'invalid_input', 'Please confirm that you accept the terms and have read the privacy notice.', {
      field: 'acceptTerms',
    });
  }
  if (body.privacyNoticeVersion !== cfg.privacyNoticeVersion) {
    throw new HttpError(409, 'notice_changed', 'The privacy notice has been updated. Please reload the page and review it.');
  }

  const recoveryCode = newRecoveryCode();
  const candidate = must(
    await db()
      .from('assessment_candidates')
      .insert({
        full_name: fullName,
        normalised_email: email,
        phone,
        consent_at: new Date().toISOString(),
        privacy_notice_version: cfg.privacyNoticeVersion,
        recovery_code_hash: keyedHash('recovery', recoveryCode.replace(/-/g, '')),
      })
      .select('id, full_name, normalised_email, phone')
      .single(),
    'create candidate',
  )!;
  const token = newAccessToken();
  await issueAccessToken(candidate.id, cfg.accessTokenTtlDays, token);
  await audit({ type: 'candidate.registered', candidateId: candidate.id, ipHash: ctx.ipHash(), details: { notice: cfg.privacyNoticeVersion } });

  return json(
    {
      token,
      recoveryCode,
      candidate: { fullName: candidate.full_name, email: candidate.normalised_email, phone: candidate.phone },
    },
    201,
  );
}

export async function getMe(ctx: Ctx): Promise<Response> {
  const { candidate } = await requireCandidate(ctx.request);
  const cfg = await getConfig();
  let rows = must(
    await db()
      .from('assessment_attempts')
      .select(ATTEMPT_COLUMNS)
      .eq('candidate_id', candidate.id)
      .order('started_at', { ascending: false })
      .limit(20),
    'attempts for me',
  ) as AttemptRow[];

  // Lazily mark an attempt whose time ran out while the candidate was away.
  const open = rows.find((r) => r.status === 'in_progress');
  if (open) {
    const updated = await finaliseIfExpired(open, cfg);
    rows = rows.map((r) => (r.id === updated.id ? updated : r));
  }

  const ids = rows.map((r) => r.id);
  const certs = ids.length
    ? must(await db().from('issued_certificates').select('attempt_id, certificate_number, revoked_at').in('attempt_id', ids), 'certs for me') ?? []
    : [];
  const certByAttempt = new Map(certs.map((c) => [c.attempt_id, c]));
  const eligibility = await startEligibility(candidate.id, cfg);
  const active = rows.find((r) => r.status === 'in_progress');

  return json({
    candidate: { fullName: candidate.fullName, email: candidate.email, phone: candidate.phone },
    activeAttemptId: active?.id ?? null,
    canStart: !active && eligibility.allowed,
    blockedReason: active ? 'in_progress' : eligibility.reason,
    nextAttemptAt: eligibility.nextAt,
    attempts: rows.map((r) => {
      const cert = certByAttempt.get(r.id);
      return {
        id: r.id,
        status: r.status,
        startedAt: r.started_at,
        submittedAt: r.submitted_at,
        scorePercentage: r.score_percentage === null ? null : Number(r.score_percentage),
        correctAnswers: r.correct_answers,
        totalQuestions: r.total_questions,
        certificateNumber: cert && !cert.revoked_at ? cert.certificate_number : null,
      };
    }),
  });
}

/** Restores access on a new device or after clearing the browser. */
export async function recover(ctx: Ctx): Promise<Response> {
  await rateLimit('recover', ctx.ip, 5, 900);
  const body = await readJson(ctx.request);
  const email = v.email(body.email);
  await rateLimit('recover-email', email, 10, 86_400);
  const code = typeof body.recoveryCode === 'string' ? normaliseRecoveryCode(body.recoveryCode) : null;
  const generic = new HttpError(401, 'recovery_failed', 'That email address and recovery code do not match our records.');
  if (!code) throw generic;

  const candidate = must(
    await db()
      .from('assessment_candidates')
      .select('id, full_name, normalised_email, phone')
      .eq('recovery_code_hash', keyedHash('recovery', code.replace(/-/g, '')))
      .eq('normalised_email', email)
      .maybeSingle(),
    'recover',
  );
  if (!candidate) {
    await audit({ type: 'candidate.recovery_failed', ipHash: ctx.ipHash() });
    throw generic;
  }
  const cfg = await getConfig();
  const token = newAccessToken();
  await issueAccessToken(candidate.id, cfg.accessTokenTtlDays, token);
  await audit({ type: 'candidate.recovered', candidateId: candidate.id, ipHash: ctx.ipHash() });
  return json({ token, candidate: { fullName: candidate.full_name, email: candidate.normalised_email, phone: candidate.phone } });
}

/** Ends this browser's session (other devices keep theirs). */
export async function signOut(ctx: Ctx): Promise<Response> {
  const session = await requireCandidate(ctx.request);
  await db().from('assessment_access_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', session.tokenId);
  return json({ ok: true });
}
