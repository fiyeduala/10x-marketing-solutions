import { useState } from 'react';
import { api, ApiError, session, type ExamAttempt } from '../api';
import { dateTime, percent } from '../format';
import { Link, navigate, paths } from '../router';
import { ConfirmDialog, ErrorNotice, Loading, useConfig, useMe } from '../ui';

export function Dashboard() {
  const me = useMe();
  const config = useConfig();
  const [confirm, setConfirm] = useState<'start' | 'signout' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (me.loading || config.loading) return <Loading />;
  if (me.error) return <div className="p-wrap p-narrow"><ErrorNotice error={me.error} /></div>;
  if (!me.data) {
    return (
      <div className="p-wrap p-narrow p-stack">
        <h1 className="p-h1">My assessment</h1>
        <p className="p-lead">This browser is not signed in.</p>
        <div className="p-row">
          <Link className="p-btn p-btn--accent" href={paths.register}>
            Register
          </Link>
          <Link className="p-btn p-btn--ghost" href={paths.recover}>
            Restore access with a recovery code
          </Link>
        </div>
      </div>
    );
  }

  const m = me.data;
  const c = config.data;

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ attempt: ExamAttempt }>('attempts', { method: 'POST' });
      navigate(paths.exam(res.attempt.id));
    } catch (err) {
      setBusy(false);
      setConfirm(null);
      if (err instanceof ApiError && err.code === 'already_passed' && typeof err.extra.attemptId === 'string') {
        navigate(paths.result(err.extra.attemptId));
        return;
      }
      setError(err);
      me.reload();
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await api('session', { method: 'DELETE' });
    } catch {
      /* the local session is cleared either way */
    }
    session.clear();
    navigate(paths.home, { replace: true });
  }

  const passed = m.attempts.find((a) => a.status === 'passed');
  const blocked: Record<string, string> = {
    already_passed: 'You have passed the assessment.',
    daily_limit: `You have used the ${c?.maxAttemptsPerDay ?? ''} attempts allowed in 24 hours.`,
    cooldown: 'You can retake the assessment soon.',
  };

  return (
    <div className="p-wrap p-stack" style={{ ['--gap' as string]: '28px' }}>
      <div>
        <p className="p-eyebrow">My assessment</p>
        <h1 className="p-h1">Hello, {m.candidate.fullName}</h1>
        <p className="p-muted" style={{ marginTop: 8 }}>
          {m.candidate.email}
        </p>
      </div>

      <ErrorNotice error={error} />

      <section className="p-card p-stack" aria-labelledby="next">
        <h2 id="next" className="p-h2">
          {m.activeAttemptId ? 'Your attempt is in progress' : passed ? 'You passed' : m.attempts.length ? 'Try again' : 'Ready when you are'}
        </h2>
        {m.activeAttemptId ? (
          <>
            <p>The timer is still running. Return to your attempt to finish it.</p>
            <div>
              <Link className="p-btn p-btn--accent" href={paths.exam(m.activeAttemptId)}>
                Return to the assessment
              </Link>
            </div>
          </>
        ) : passed ? (
          <>
            <p>
              You scored {percent(passed.scorePercentage)}.{' '}
              {passed.certificateNumber ? 'Your certificate is ready.' : 'Your certificate will be issued after the certificate fee is paid.'}
            </p>
            <div>
              <Link className="p-btn p-btn--accent" href={paths.result(passed.id)}>
                {passed.certificateNumber ? 'View certificate' : 'Get my certificate'}
              </Link>
            </div>
          </>
        ) : m.canStart ? (
          <>
            <p>
              {c?.questionsPerAttempt} questions · {c?.durationMinutes} minutes · pass mark {c?.passMarkPercent}% ({c?.requiredCorrect}{' '}
              correct)
            </p>
            <div className="p-row">
              <button type="button" className="p-btn p-btn--accent" onClick={() => setConfirm('start')}>
                {m.attempts.length ? 'Start a new attempt' : 'Start the assessment'}
              </button>
              <Link className="p-link" href={paths.handbook}>
                Review the handbook first
              </Link>
            </div>
          </>
        ) : (
          <p>
            {blocked[m.blockedReason ?? ''] ?? 'You cannot start a new attempt right now.'}
            {m.nextAttemptAt && ` You can start again after ${dateTime(m.nextAttemptAt)}.`}
          </p>
        )}
      </section>

      {m.attempts.length > 0 && (
        <section aria-labelledby="history" className="p-stack">
          <h2 id="history" className="p-h2">
            Attempt history
          </h2>
          <div className="p-table-wrap">
            <table className="p-table">
              <thead>
                <tr>
                  <th scope="col">Started</th>
                  <th scope="col">Result</th>
                  <th scope="col">Score</th>
                  <th scope="col">
                    <span className="p-sr">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {m.attempts.map((a) => (
                  <tr key={a.id}>
                    <td>{dateTime(a.startedAt)}</td>
                    <td>
                      {a.status === 'in_progress' ? (
                        <span className="p-badge p-badge--warn">In progress</span>
                      ) : a.status === 'passed' ? (
                        <span className="p-badge p-badge--ok">Passed</span>
                      ) : (
                        <span className="p-badge p-badge--bad">Not passed</span>
                      )}
                    </td>
                    <td>
                      {a.correctAnswers === null ? '—' : `${a.correctAnswers}/${a.totalQuestions} (${percent(a.scorePercentage)})`}
                    </td>
                    <td>
                      <Link className="p-link" href={a.status === 'in_progress' ? paths.exam(a.id) : paths.result(a.id)}>
                        {a.status === 'in_progress' ? 'Continue' : 'View'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="p-small p-muted">
        Using a shared computer?{' '}
        <button type="button" className="p-link" style={{ background: 'none', border: 0, padding: 0 }} onClick={() => setConfirm('signout')}>
          Sign out of this browser
        </button>
      </p>

      <ConfirmDialog
        open={confirm === 'start'}
        title="Start the assessment?"
        confirmLabel="Start now"
        busy={busy}
        onConfirm={start}
        onCancel={() => setConfirm(null)}
      >
        <ul className="p-list">
          <li>
            You will have <strong>{c?.durationMinutes} minutes</strong> for {c?.questionsPerAttempt} questions. The timer starts now and
            does not pause.
          </li>
          <li>Your answers save automatically. If you close the page, return before time runs out to continue.</li>
          <li>When time runs out, the answers saved so far are marked.</li>
          <li>Work on your own and do not copy or share the questions.</li>
        </ul>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === 'signout'}
        title="Sign out of this browser?"
        confirmLabel="Sign out"
        busy={busy}
        onConfirm={signOut}
        onCancel={() => setConfirm(null)}
      >
        <p>To come back later you will need your email address and recovery code.</p>
      </ConfirmDialog>
    </div>
  );
}
