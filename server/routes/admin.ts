import { audit } from '../audit.js';
import { requireAdmin } from '../auth.js';
import { clearConfigCache, getConfig, requiredCorrect } from '../config.js';
import type { Ctx } from '../context.js';
import { normaliseCertificateNumber } from '../crypto.js';
import { db, must } from '../db.js';
import { env } from '../env.js';
import { HttpError, json, readJson } from '../http.js';
import { QUESTION_BANK_VERSION } from '../questionBank.js';
import { rateLimit } from '../ratelimit.js';
import * as v from '../validate.js';

async function admin(ctx: Ctx) {
  await rateLimit('admin', ctx.ip, 300, 600);
  return requireAdmin(ctx.request);
}

export async function adminMe(ctx: Ctx): Promise<Response> {
  const a = await admin(ctx);
  return json({ email: a.email });
}

export async function adminSummary(ctx: Ctx): Promise<Response> {
  await admin(ctx);
  const [summary, cfg] = await Promise.all([db().rpc('csp_admin_summary'), getConfig()]);
  const s = must(summary, 'admin summary') as Record<string, number>;
  const marked = s.attempts_passed + s.attempts_failed;
  return json({
    summary: {
      ...s,
      pass_rate_percent: marked ? Math.round((s.attempts_passed / marked) * 1000) / 10 : null,
    },
    config: { ...cfg, requiredCorrect: requiredCorrect(cfg.questionsPerAttempt, cfg.passMarkPercent) },
    questionBankVersion: QUESTION_BANK_VERSION,
    paystackConfigured: !!env.paystackSecretKey(),
    paystackMode: env.paystackSecretKey()?.startsWith('sk_live_') ? 'live' : env.paystackSecretKey() ? 'test' : 'not_configured',
  });
}

const PAGE_SIZE = 25;

function attemptQuery(status: string | null, emailFilter: string | null) {
  let q = db()
    .from('assessment_attempts')
    .select(
      'id, status, started_at, submitted_at, timed_out, correct_answers, total_questions, score_percentage, ' +
        'assessment_candidates!inner (full_name, normalised_email, phone), ' +
        'certificate_payments (status, reference, amount_kobo, paid_at), ' +
        'issued_certificates (certificate_number, issued_at, revoked_at)',
      { count: 'exact' },
    )
    .order('started_at', { ascending: false });
  if (status && ['in_progress', 'passed', 'failed'].includes(status)) q = q.eq('status', status);
  if (emailFilter) {
    const escaped = emailFilter.replace(/[\\%_,()]/g, (c) => `\\${c}`);
    q = q.ilike('assessment_candidates.normalised_email', `%${escaped}%`);
  }
  return q;
}

interface AttemptListRow {
  id: string;
  status: string;
  started_at: string;
  submitted_at: string | null;
  timed_out: boolean;
  correct_answers: number | null;
  total_questions: number;
  score_percentage: number | string | null;
  assessment_candidates: { full_name: string; normalised_email: string; phone: string | null };
  certificate_payments: { status: string; reference: string; amount_kobo: number; paid_at: string | null }[];
  issued_certificates: { certificate_number: string; issued_at: string; revoked_at: string | null } | null;
}

function shape(r: AttemptListRow) {
  const pays = r.certificate_payments ?? [];
  const paid = pays.find((p) => p.status === 'success');
  const cert = Array.isArray(r.issued_certificates) ? r.issued_certificates[0] : r.issued_certificates;
  return {
    id: r.id,
    name: r.assessment_candidates.full_name,
    email: r.assessment_candidates.normalised_email,
    phone: r.assessment_candidates.phone,
    status: r.status,
    startedAt: r.started_at,
    submittedAt: r.submitted_at,
    timedOut: r.timed_out,
    correctAnswers: r.correct_answers,
    totalQuestions: r.total_questions,
    scorePercentage: r.score_percentage === null ? null : Number(r.score_percentage),
    paymentStatus: paid ? 'success' : pays.some((p) => p.status === 'duplicate_success') ? 'duplicate_success' : (pays[0]?.status ?? null),
    paymentReference: paid?.reference ?? null,
    amountKobo: paid?.amount_kobo ?? null,
    paidAt: paid?.paid_at ?? null,
    certificateNumber: cert?.certificate_number ?? null,
    certificateRevoked: !!cert?.revoked_at,
  };
}

export async function adminAttempts(ctx: Ctx): Promise<Response> {
  await admin(ctx);
  const page = Math.max(1, Math.min(10_000, Number(ctx.url.searchParams.get('page')) || 1));
  const status = ctx.url.searchParams.get('status');
  const emailFilter = ctx.url.searchParams.get('q')?.trim().toLowerCase().slice(0, 120) || null;
  const { data, error, count } = await attemptQuery(status, emailFilter).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = must({ data, error }, 'admin attempts') as unknown as AttemptListRow[];
  return json({ page, pageSize: PAGE_SIZE, total: count ?? 0, rows: rows.map(shape) });
}

function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  // Stop spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function adminExport(ctx: Ctx): Promise<Response> {
  const a = await admin(ctx);
  const status = ctx.url.searchParams.get('status');
  const { data, error } = await attemptQuery(status, null).range(0, 4999);
  const rows = (must({ data, error }, 'admin export') as unknown as AttemptListRow[]).map(shape);
  const header = [
    'attempt_id', 'name', 'email', 'phone', 'status', 'started_at', 'submitted_at', 'timed_out', 'correct', 'total',
    'score_percent', 'payment_status', 'payment_reference', 'amount_naira', 'paid_at', 'certificate_number', 'certificate_revoked',
  ];
  const lines = [header.join(',')].concat(
    rows.map((r) =>
      [
        r.id, r.name, r.email, r.phone, r.status, r.startedAt, r.submittedAt, r.timedOut, r.correctAnswers, r.totalQuestions,
        r.scorePercentage, r.paymentStatus, r.paymentReference, r.amountKobo === null ? '' : (r.amountKobo / 100).toFixed(2),
        r.paidAt, r.certificateNumber, r.certificateRevoked,
      ]
        .map(csvCell)
        .join(','),
    ),
  );
  await audit({ type: 'admin.export', actor: `admin:${a.email}`, ipHash: ctx.ipHash(), details: { rows: rows.length } });
  return new Response(`﻿${lines.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="csp-attempts-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export async function adminRevoke(ctx: Ctx): Promise<Response> {
  const a = await admin(ctx);
  const number = normaliseCertificateNumber(ctx.params[0] ?? '');
  if (!number) throw new HttpError(404, 'not_found', 'That certificate was not found.');
  const body = await readJson(ctx.request);
  const reason = v.text(body.reason, 'reason', 500);
  const { data, error } = await db()
    .from('issued_certificates')
    .update({ revoked_at: new Date().toISOString(), revocation_reason: reason })
    .eq('certificate_number', number)
    .is('revoked_at', null)
    .select('id, candidate_id, attempt_id');
  if (error?.code === 'P0001') throw new HttpError(409, 'already_revoked', 'This certificate is already revoked.');
  const rows = must({ data, error }, 'revoke');
  if (!rows?.length) throw new HttpError(404, 'not_found', 'No active certificate with that number.');
  await audit({
    type: 'certificate.revoked',
    actor: `admin:${a.email}`,
    candidateId: rows[0].candidate_id,
    attemptId: rows[0].attempt_id,
    certificateId: rows[0].id,
    ipHash: ctx.ipHash(),
    details: { reason },
  });
  return json({ revoked: true, number });
}

const CONFIG_FIELDS: Record<string, { column: string; min: number; max: number }> = {
  questionsPerAttempt: { column: 'questions_per_attempt', min: 5, max: 40 },
  durationMinutes: { column: 'duration_minutes', min: 5, max: 240 },
  passMarkPercent: { column: 'pass_mark_percent', min: 1, max: 100 },
  certificateFeeKobo: { column: 'certificate_fee_kobo', min: 5000, max: 10_000_000 },
  submissionGraceSeconds: { column: 'submission_grace_seconds', min: 0, max: 300 },
  retakeCooldownMinutes: { column: 'retake_cooldown_minutes', min: 0, max: 10_080 },
  maxAttemptsPerDay: { column: 'max_attempts_per_day', min: 1, max: 50 },
  accessTokenTtlDays: { column: 'access_token_ttl_days', min: 1, max: 365 },
};

/** Changes apply to attempts started afterwards; open attempts keep their settings. */
export async function adminUpdateConfig(ctx: Ctx): Promise<Response> {
  const a = await admin(ctx);
  const body = await readJson(ctx.request);
  const update: Record<string, number | boolean> = {};
  for (const [key, spec] of Object.entries(CONFIG_FIELDS)) {
    if (body[key] === undefined) continue;
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n < spec.min || n > spec.max || (key !== 'passMarkPercent' && !Number.isInteger(n))) {
      throw new HttpError(422, 'invalid_input', `${key} must be between ${spec.min} and ${spec.max}.`, { field: key });
    }
    update[spec.column] = n;
  }
  if (body.paymentsEnabled !== undefined) {
    if (typeof body.paymentsEnabled !== 'boolean') throw new HttpError(422, 'invalid_input', 'paymentsEnabled must be true or false.');
    update.payments_enabled = body.paymentsEnabled;
  }
  if (!Object.keys(update).length) throw new HttpError(422, 'invalid_input', 'Nothing to change.');
  must(await db().from('assessment_config').update(update).eq('id', 1), 'update config');
  clearConfigCache();
  await audit({ type: 'admin.config_changed', actor: `admin:${a.email}`, ipHash: ctx.ipHash(), details: update });
  return json({ updated: Object.keys(update) });
}

export async function adminAudit(ctx: Ctx): Promise<Response> {
  await admin(ctx);
  const rows = must(
    await db()
      .from('security_audit_events')
      .select('id, event_type, actor, attempt_id, payment_id, certificate_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    'audit list',
  );
  return json({ events: rows });
}
