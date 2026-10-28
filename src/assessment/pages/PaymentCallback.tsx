import { useEffect, useState } from 'react';
import { api, ApiError, session } from '../api';
import { Link, paths } from '../router';
import { ErrorNotice } from '../ui';

type State =
  | { kind: 'checking' }
  | { kind: 'success'; attemptId: string; certificateNumber: string | null }
  | { kind: 'pending'; attemptId: string }
  | { kind: 'failed'; attemptId: string }
  | { kind: 'error'; error: unknown }
  | { kind: 'no-session' }
  | { kind: 'no-reference' };

const POLLS = 6;
const POLL_MS = 4000;

export function PaymentCallback() {
  const [state, setState] = useState<State>({ kind: 'checking' });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') ?? params.get('trxref');
    if (!reference) return setState({ kind: 'no-reference' });
    if (!session.get()) return setState({ kind: 'no-session' });

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = async (n: number) => {
      try {
        const res = await api<{ status: string; attemptId: string; certificateNumber: string | null }>('payments/verify', {
          method: 'POST',
          body: { reference },
        });
        if (cancelled) return;
        if (res.status === 'success') setState({ kind: 'success', attemptId: res.attemptId, certificateNumber: res.certificateNumber });
        else if (res.status === 'pending' && n < POLLS) {
          setState({ kind: 'checking' });
          timer = setTimeout(() => void run(n + 1), POLL_MS);
        } else if (res.status === 'pending') setState({ kind: 'pending', attemptId: res.attemptId });
        else setState({ kind: 'failed', attemptId: res.attemptId });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) setState({ kind: 'no-session' });
        else setState({ kind: 'error', error: err });
      }
    };
    void run(1);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="p-wrap p-narrow p-stack" aria-live="polite">
      {state.kind === 'checking' && (
        <>
          <h1 className="p-h1">Confirming your payment</h1>
          <p className="p-row">
            <span className="p-spinner" aria-hidden="true" />
            <span>We are checking the payment with Paystack. Please keep this page open.</span>
          </p>
        </>
      )}
      {state.kind === 'success' && (
        <>
          <h1 className="p-h1">Payment confirmed</h1>
          <p className="p-lead">
            {state.certificateNumber
              ? `Your certificate ${state.certificateNumber} has been issued.`
              : 'Paystack confirmed your payment. Your certificate is being prepared.'}
          </p>
          <p>
            <Link className="p-btn p-btn--accent" href={paths.result(state.attemptId)}>
              Go to my certificate
            </Link>
          </p>
        </>
      )}
      {state.kind === 'pending' && (
        <>
          <h1 className="p-h1">Payment not confirmed yet</h1>
          <p className="p-lead">
            Paystack has not confirmed this payment yet. This can take a few minutes. You have not been charged twice; you can check again
            from your result page.
          </p>
          <p>
            <Link className="p-btn" href={paths.result(state.attemptId)}>
              Go to my result
            </Link>
          </p>
        </>
      )}
      {state.kind === 'failed' && (
        <>
          <h1 className="p-h1">The payment was not completed</h1>
          <p className="p-lead">No certificate has been issued. Your passing result is saved, so you can try the payment again.</p>
          <p>
            <Link className="p-btn" href={paths.result(state.attemptId)}>
              Back to my result
            </Link>
          </p>
        </>
      )}
      {state.kind === 'no-session' && (
        <>
          <h1 className="p-h1">Sign in to see your payment</h1>
          <p className="p-lead">
            This browser is not signed in to the assessment. Restore access with your email and recovery code, then open your result to
            check the payment.
          </p>
          <p>
            <Link className="p-btn" href={paths.recover}>
              Restore access
            </Link>
          </p>
        </>
      )}
      {state.kind === 'no-reference' && (
        <>
          <h1 className="p-h1">No payment to confirm</h1>
          <p className="p-lead">This page is opened by Paystack after a payment. Go to your assessment to see your result.</p>
          <p>
            <Link className="p-btn" href={paths.dashboard}>
              My assessment
            </Link>
          </p>
        </>
      )}
      {state.kind === 'error' && (
        <>
          <h1 className="p-h1">We could not confirm the payment</h1>
          <ErrorNotice error={state.error} />
          <p>
            <Link className="p-btn" href={paths.dashboard}>
              My assessment
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
