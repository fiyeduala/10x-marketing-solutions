import { audit } from '../audit.js';
import { requireCandidate } from '../auth.js';
import { renderCertificatePdf } from '../certificatePdf.js';
import type { Ctx } from '../context.js';
import { normaliseCertificateNumber } from '../crypto.js';
import { db, must } from '../db.js';
import { env } from '../env.js';
import { HttpError, json } from '../http.js';
import { rateLimit } from '../ratelimit.js';

const CERT_COLUMNS = 'id, certificate_number, candidate_id, certificate_title, recipient_name, score_percentage, issued_at, revoked_at';

export function verifyUrl(certificateNumber: string): string {
  return `${env.appBaseUrl()}/verify-certificate/${certificateNumber}`;
}

/** The owner's certificate details (JSON). */
export async function getCertificate(ctx: Ctx): Promise<Response> {
  const { candidate } = await requireCandidate(ctx.request);
  const number = normaliseCertificateNumber(ctx.params[0] ?? '');
  if (!number) throw new HttpError(404, 'not_found', 'That certificate was not found.');
  const cert = must(
    await db().from('issued_certificates').select(CERT_COLUMNS).eq('certificate_number', number).eq('candidate_id', candidate.id).maybeSingle(),
    'own certificate',
  );
  if (!cert) throw new HttpError(404, 'not_found', 'That certificate was not found.');
  return json({
    certificate: {
      number: cert.certificate_number,
      title: cert.certificate_title,
      recipientName: cert.recipient_name,
      scorePercentage: Number(cert.score_percentage),
      issuedAt: cert.issued_at,
      revoked: !!cert.revoked_at,
      verifyUrl: verifyUrl(cert.certificate_number),
    },
  });
}

/** The owner's PDF. Revoked certificates cannot be downloaded. */
export async function getCertificatePdf(ctx: Ctx): Promise<Response> {
  const { candidate } = await requireCandidate(ctx.request);
  await rateLimit('pdf', ctx.ip, 30, 600);
  const number = normaliseCertificateNumber(ctx.params[0] ?? '');
  if (!number) throw new HttpError(404, 'not_found', 'That certificate was not found.');
  const cert = must(
    await db().from('issued_certificates').select(CERT_COLUMNS).eq('certificate_number', number).eq('candidate_id', candidate.id).maybeSingle(),
    'own certificate pdf',
  );
  if (!cert) throw new HttpError(404, 'not_found', 'That certificate was not found.');
  if (cert.revoked_at) throw new HttpError(410, 'revoked', 'This certificate has been revoked.');

  const bytes = await renderCertificatePdf({
    certificateNumber: cert.certificate_number,
    recipientName: cert.recipient_name,
    certificateTitle: cert.certificate_title,
    scorePercentage: Number(cert.score_percentage),
    issuedAt: cert.issued_at,
    verifyUrl: verifyUrl(cert.certificate_number),
  });
  await audit({ type: 'certificate.downloaded', candidateId: candidate.id, certificateId: cert.id, ipHash: ctx.ipHash() });
  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${cert.certificate_number}.pdf"`,
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

/** Public check used by employers. Shows only what the certificate itself shows. */
export async function verifyCertificate(ctx: Ctx): Promise<Response> {
  await rateLimit('verify', ctx.ip, 60, 600);
  const number = normaliseCertificateNumber(decodeURIComponent(ctx.params[0] ?? ''));
  if (!number) return json({ status: 'not_found' });
  const cert = must(
    await db()
      .from('issued_certificates')
      .select('certificate_number, certificate_title, recipient_name, issued_at, revoked_at')
      .eq('certificate_number', number)
      .maybeSingle(),
    'verify certificate',
  );
  if (!cert) return json({ status: 'not_found', number });
  return json({
    status: cert.revoked_at ? 'revoked' : 'valid',
    certificate: {
      number: cert.certificate_number,
      title: cert.certificate_title,
      recipientName: cert.recipient_name,
      issuedAt: cert.issued_at,
      issuer: '10X Marketing Solutions',
      revokedAt: cert.revoked_at,
    },
  });
}
