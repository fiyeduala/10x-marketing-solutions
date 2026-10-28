import { CERTIFICATE_TITLE } from './config.js';
import { newCertificateNumber } from './crypto.js';
import { db, must } from './db.js';
import type { VerifiedTransaction } from './paystack.js';

export interface PaymentRow {
  id: string;
  candidate_id: string;
  attempt_id: string;
  reference: string;
  amount_kobo: number;
  currency: string;
  status: 'initialized' | 'success' | 'failed' | 'abandoned' | 'duplicate_success';
  authorization_url: string | null;
  created_at: string;
}

export const PAYMENT_COLUMNS = 'id, candidate_id, attempt_id, reference, amount_kobo, currency, status, authorization_url, created_at';

export type RecordOutcome =
  | { outcome: 'issued' | 'already_recorded' | 'duplicate_payment'; certificateNumber: string | null }
  | { outcome: 'pending' | 'failed' | 'amount_mismatch' | 'not_eligible' | 'reference_mismatch'; certificateNumber: null };

/**
 * Applies a transaction that the server itself fetched from Paystack. The
 * database function checks amount, currency, eligibility and duplicates, and
 * issues the certificate in the same transaction.
 */
export async function applyVerifiedTransaction(payment: PaymentRow, tx: VerifiedTransaction | null, actor: string): Promise<RecordOutcome> {
  if (!tx) return { outcome: 'pending', certificateNumber: null };
  if (tx.reference !== payment.reference) return { outcome: 'reference_mismatch', certificateNumber: null };

  if (tx.status !== 'success') {
    if (tx.status === 'failed' || tx.status === 'reversed') {
      await db()
        .from('certificate_payments')
        .update({ status: 'failed', gateway_response: tx.gatewayResponse?.slice(0, 200) ?? tx.status })
        .eq('id', payment.id)
        .eq('status', 'initialized');
      return { outcome: 'failed', certificateNumber: null };
    }
    // 'abandoned', 'ongoing', 'pending', 'processing', 'queued': not final yet.
    return { outcome: 'pending', certificateNumber: null };
  }

  for (let tries = 0; tries < 3; tries++) {
    const { data, error } = await db().rpc('csp_record_payment_and_issue', {
      p_payment_id: payment.id,
      p_transaction_id: tx.id,
      p_amount_kobo: tx.amount,
      p_currency: tx.currency,
      p_paid_at: tx.paidAt,
      p_channel: tx.channel,
      p_gateway_response: tx.gatewayResponse?.slice(0, 200) ?? null,
      p_certificate_number: newCertificateNumber(),
      p_certificate_title: CERTIFICATE_TITLE,
      p_actor: actor,
    });
    // Certificate-number collision (vanishingly rare): try a new number.
    if (error?.code === '23505' && error.message.includes('certificate_number')) continue;
    const row = must({ data, error }, 'record payment')?.[0];
    return { outcome: row.outcome, certificateNumber: row.certificate_number ?? null } as RecordOutcome;
  }
  throw new Error('Could not allocate a certificate number');
}
