import { useEffect, useState } from 'react';
import { api, ApiError, download, type AttemptResult, type AttemptView } from '../api';
import { CERTIFICATE_NOTE } from '../content';
import { CONTACT_EMAIL, dateOnly, dateTime, naira, percent } from '../format';
import { Link, navigate, paths } from '../router';
import { ErrorNotice, Loading, useConfig, useMe, useResource } from '../ui';
import styles from './Result.module.css';

export function Result({ id }: { id: string }) {
  const view = useResource((signal) => api<AttemptView>(`attempts/${id}`, { signal }), [id]);

  useEffect(() => {
    if (view.data?.attempt) navigate(paths.exam(id), { replace: true });
  }, [view.data, id]);

  if (view.loading && !view.data) return <Loading label="Loading your result" />;
  if (view.error) {
    return (
      <div className="p-wrap p-narrow p-stack">
        <h1 className="p-h1">We could not load this result</h1>
        <ErrorNotice error={view.error} />
        <p>
          <Link className="p-btn" href={paths.dashboard}>
            Go to my assessment
          </Link>
        </p>
      </div>
    );
  }
  const r = view.data?.result;
  if (!r) return <Loading />;
  return <ResultView r={r} reload={view.reload} />;
}

function ResultView({ r, reload }: { r: AttemptResult; reload: () => void }) {
  return (
    <div className="p-wrap p-stack" style={{ ['--gap' as string]: '28px' }}>
      <section className={`${styles.hero} ${r.passed ? styles.pass : styles.fail}`}>
        <p className="p-eyebrow">Your result · {dateTime(r.submittedAt)}</p>
        <h1 className="p-h1">{r.passed ? 'You passed' : 'You did not pass this time'}</h1>
        <p className={styles.score}>
          <span className={styles.big}>{percent(r.scorePercentage)}</span>
          <span>
            {r.correctAnswers} of {r.totalQuestions} correct. The pass mark is {percent(r.passMark)} ({r.requiredCorrect} correct).
          </span>
        </p>
        {r.timedOut && (
          <p className="p-small">Time ran out before you submitted, so the answers saved up to that point were marked.</p>
        )}
      </section>

      {r.passed ? <Certificate r={r} reload={reload} /> : <Retake />}

      <section className="p-stack" aria-labelledby="breakdown">
        <h2 id="breakdown" className="p-h2">
          How you did in each area
        </h2>
        <p className="p-muted p-small">
          To protect the assessment, we do not show which questions you got wrong or the correct answers.
        </p>
        <ul className={styles.breakdown}>
          {r.breakdown.map((b) => {
            const pct = b.total ? Math.round((b.correct / b.total) * 100) : 0;
            return (
              <li key={b.key}>
                <div className={styles.bRow}>
                  <span className={styles.bLabel}>{b.label}</span>
                  <span className={styles.bScore}>
                    {b.correct}/{b.total}
                  </span>
                </div>
                <div className={styles.meter} aria-hidden="true">
                  <span style={{ width: `${pct}%` }} />
                </div>
                {b.correct < b.total && b.chapters.length > 0 && (
                  <p className="p-small p-muted">
                    Revise:{' '}
                    {b.chapters.map((c, i) => (
                      <span key={c}>
                        {i > 0 && ', '}
                        <Link className="p-link" href={`${paths.handbook}#chapter-${c}`}>
                          chapter {c}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Certificate({ r, reload }: { r: AttemptResult; reload: () => void }) {
  const config = useConfig();
  const [busy, setBusy] = useState<'pay' | 'check' | 'pdf' | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [note, setNote] = useState('');

  const cert = r.certificate;
  const pending = r.payment?.status === 'initialized';

  async function pay() {
    setBusy('pay');
    setError(null);
    try {
      const res = await api<{ authorizationUrl?: string; alreadyIssued?: boolean }>('payments/initialize', {
        method: 'POST',
        body: { attemptId: r.id },
      });
      if (res.authorizationUrl) {
        window.location.assign(res.authorizationUrl);
        return;
      }
      reload();
    } catch (err) {
      setError(err);
    }
    setBusy(null);
  }

  async function check() {
    if (!r.payment) return;
    setBusy('check');
    setError(null);
    setNote('');
    try {
      const res = await api<{ status: string }>('payments/verify', { method: 'POST', body: { reference: r.payment.reference } });
      if (res.status === 'success') reload();
      else if (res.status === 'pending') setNote('Paystack has not confirmed this payment yet. If you completed it, check again in a minute.');
      else setNote('That payment was not completed. You can try again below.');
      if (res.status === 'failed') reload();
    } catch (err) {
      setError(err);
    }
    setBusy(null);
  }

  async function pdf() {
    if (!cert) return;
    setBusy('pdf');
    setError(null);
    try {
      await download(`certificates/${encodeURIComponent(cert.number)}/pdf`, `${cert.number}.pdf`);
    } catch (err) {
      setError(err);
    }
    setBusy(null);
  }

  if (cert?.revoked) {
    return (
      <section className="p-notice p-notice--error" aria-labelledby="cert">
        <h2 id="cert" className="p-h3">
          Certificate {cert.number} has been revoked
        </h2>
        <p>
          It can no longer be downloaded and shows as revoked on the verification page. If you think this is a mistake, email{' '}
          <a className="p-link" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    );
  }

  if (cert) {
    return (
      <section className="p-card p-stack" aria-labelledby="cert">
        <h2 id="cert" className="p-h2">
          Your certificate
        </h2>
        <dl className="p-dl">
          <dt>Certificate number</dt>
          <dd>
            <strong>{cert.number}</strong>
          </dd>
          <dt>Issued</dt>
          <dd>{dateOnly(cert.issuedAt)}</dd>
        </dl>
        <div className="p-row">
          <button type="button" className="p-btn p-btn--accent" onClick={pdf} disabled={busy === 'pdf'}>
            {busy === 'pdf' ? 'Preparing PDF…' : 'Download certificate (PDF)'}
          </button>
          <Link className="p-link" href={paths.verify(cert.number)}>
            View the public verification record
          </Link>
        </div>
        <ErrorNotice error={error} />
        <p className="p-small p-muted">
          Share the certificate number or the verification link with employers so they can check it. {CERTIFICATE_NOTE}
        </p>
      </section>
    );
  }

  const fee = naira(r.fee.amountKobo);
  const available = config.data?.paymentsAvailable;
  return (
    <section className="p-card p-stack" aria-labelledby="cert">
      <h2 id="cert" className="p-h2">
        Get your certificate
      </h2>
      <p>
        Pay the {fee} certificate fee through Paystack. When Paystack confirms the payment to us, your certificate is issued in your name
        and you can download it here.
      </p>
      {pending && (
        <div className="p-notice p-notice--warn">
          <p>
            You started a payment that has not been confirmed. If you completed it, check its status before paying again. If you did not
            finish it, you can continue to Paystack.
          </p>
          <div className="p-row" style={{ marginTop: 12 }}>
            <button type="button" className="p-btn p-btn--small" onClick={check} disabled={!!busy}>
              {busy === 'check' ? 'Checking…' : 'Check payment status'}
            </button>
          </div>
        </div>
      )}
      {note && (
        <p className="p-notice" role="status">
          {note}
        </p>
      )}
      {config.loading ? null : available ? (
        <div>
          <button type="button" className="p-btn p-btn--accent" onClick={pay} disabled={!!busy}>
            {busy === 'pay' ? 'Opening Paystack…' : pending ? `Continue to Paystack (${fee})` : `Pay ${fee} with Paystack`}
          </button>
        </div>
      ) : (
        <div className="p-notice p-notice--warn">
          <p>
            Card payment is not available at the moment. Your passing result is saved, so you can come back to pay later from{' '}
            <Link className="p-link" href={paths.dashboard}>
              My assessment
            </Link>
            .
          </p>
        </div>
      )}
      <ErrorNotice error={error instanceof ApiError && error.code === 'payments_unavailable' ? null : error} />
      <p className="p-small p-muted">
        Payments are processed by Paystack. We never see or store your card details. The fee is for issuing the certificate; it is not
        charged unless you choose to pay.
      </p>
    </section>
  );
}

function Retake() {
  const me = useMe();
  const m = me.data;
  return (
    <section className="p-card p-stack" aria-labelledby="next">
      <h2 id="next" className="p-h2">
        What next
      </h2>
      <p>Look at the areas below where you lost marks, revise those chapters of the handbook, then try again. Your attempts are kept.</p>
      {m && !m.canStart && m.nextAttemptAt && <p>You can start your next attempt after {dateTime(m.nextAttemptAt)}.</p>}
      <div className="p-row">
        <Link className="p-btn" href={paths.handbook}>
          Open the handbook
        </Link>
        <Link className="p-btn p-btn--ghost" href={paths.dashboard}>
          {m?.canStart ? 'Retake the assessment' : 'My assessment'}
        </Link>
      </div>
    </section>
  );
}
