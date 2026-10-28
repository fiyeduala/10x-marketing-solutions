import { db, must } from './db.js';

export interface AssessmentConfig {
  questionsPerAttempt: number;
  durationMinutes: number;
  passMarkPercent: number;
  certificateFeeKobo: number;
  currency: 'NGN';
  submissionGraceSeconds: number;
  retakeCooldownMinutes: number;
  maxAttemptsPerDay: number;
  accessTokenTtlDays: number;
  privacyNoticeVersion: string;
  paymentsEnabled: boolean;
}

export const CERTIFICATE_TITLE = 'Certificate of Competency in Customer Support';
export const ASSESSMENT_NAME = '10X Customer Support Professional Assessment';

let cached: { value: AssessmentConfig; at: number } | null = null;
const TTL_MS = 30_000;

export async function getConfig(): Promise<AssessmentConfig> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const row = must(await db().from('assessment_config').select('*').eq('id', 1).single(), 'config');
  const value: AssessmentConfig = {
    questionsPerAttempt: row.questions_per_attempt,
    durationMinutes: row.duration_minutes,
    passMarkPercent: Number(row.pass_mark_percent),
    certificateFeeKobo: row.certificate_fee_kobo,
    currency: row.currency,
    submissionGraceSeconds: row.submission_grace_seconds,
    retakeCooldownMinutes: row.retake_cooldown_minutes,
    maxAttemptsPerDay: row.max_attempts_per_day,
    accessTokenTtlDays: row.access_token_ttl_days,
    privacyNoticeVersion: row.privacy_notice_version,
    paymentsEnabled: row.payments_enabled,
  };
  cached = { value, at: Date.now() };
  return value;
}

export function clearConfigCache(): void {
  cached = null;
}

/** Questions needed to pass, e.g. 21 of 30 at 70%. Mirrors csp_finalize_attempt. */
export function requiredCorrect(total: number, passMarkPercent: number): number {
  return Math.ceil((passMarkPercent * total) / 100 - 1e-9);
}
