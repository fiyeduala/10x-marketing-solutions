import { db } from './db.js';

export interface AuditEvent {
  type: string;
  actor?: string;
  candidateId?: string | null;
  attemptId?: string | null;
  paymentId?: string | null;
  certificateId?: string | null;
  details?: Record<string, unknown>;
  ipHash?: string | null;
}

/** Best-effort audit write. Never include secrets, tokens or card data. */
export async function audit(event: AuditEvent): Promise<void> {
  const { error } = await db().from('security_audit_events').insert({
    event_type: event.type,
    actor: event.actor ?? 'system',
    candidate_id: event.candidateId ?? null,
    attempt_id: event.attemptId ?? null,
    payment_id: event.paymentId ?? null,
    certificate_id: event.certificateId ?? null,
    details: event.details ?? {},
    ip_hash: event.ipHash ?? null,
  });
  if (error) console.error(`[audit] ${event.type}: ${error.message}`);
}
