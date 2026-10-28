import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type AttemptView, type ExamAttempt, type OptionKey } from '../api';
import { areaLabel } from '../content';
import { clock } from '../format';
import { Link, navigate, paths } from '../router';
import { ConfirmDialog, ErrorNotice, Loading } from '../ui';
import styles from './Exam.module.css';

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';
const SAVE_DELAY_MS = 1200;

export function Exam({ id }: { id: string }) {
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    api<AttemptView>(`attempts/${id}`, { signal: ctrl.signal }).then(
      (view) => {
        if (view.result) navigate(paths.result(id), { replace: true });
        else setAttempt(view.attempt);
      },
      (err) => (err as Error).name !== 'AbortError' && setLoadError(err),
    );
    return () => ctrl.abort();
  }, [id]);

  if (loadError) {
    return (
      <div className="p-wrap p-narrow p-stack" style={{ paddingTop: 48 }}>
        <h1 className="p-h1">We could not open this attempt</h1>
        <ErrorNotice error={loadError} />
        <p>
          <Link className="p-btn" href={paths.dashboard}>
            Go to my assessment
          </Link>
        </p>
      </div>
    );
  }
  if (!attempt) return <Loading label="Opening your assessment" />;
  return <ExamRunner attempt={attempt} />;
}

function ExamRunner({ attempt }: { attempt: ExamAttempt }) {
  const { id, questions } = attempt;
  const total = questions.length;
  // Server clock offset, so the countdown is right even if the device clock is wrong.
  const offset = useRef(Date.parse(attempt.serverNow) - Date.now());
  const deadline = Date.parse(attempt.expiresAt);
  const remainingNow = () => Math.max(0, (deadline - (Date.now() + offset.current)) / 1000);

  const [answers, setAnswers] = useState<Record<string, OptionKey>>(attempt.answers ?? {});
  const [index, setIndex] = useState(() => {
    const first = questions.findIndex((q) => !attempt.answers?.[q.id]);
    return first === -1 ? 0 : first;
  });
  const [flags, setFlags] = useState<Set<string>>(() => loadFlags(id));
  const [remaining, setRemaining] = useState(remainingNow);
  const [save, setSave] = useState<SaveState>('idle');
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [announcement, setAnnouncement] = useState('');

  const answersRef = useRef(answers);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finished = useRef(false);
  const warned = useRef({ five: remainingNow() <= 300, one: remainingNow() <= 60 });
  const headingRef = useRef<HTMLHeadingElement>(null);

  const closed = useCallback(() => {
    finished.current = true;
    navigate(paths.result(id), { replace: true });
  }, [id]);

  const flush = useCallback(
    async (opts: { keepalive?: boolean } = {}) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (!dirty.current || finished.current) return;
      dirty.current = false;
      setSave('saving');
      try {
        await api(`attempts/${id}/answers`, { method: 'PUT', body: { answers: answersRef.current }, keepalive: opts.keepalive });
        setSave(dirty.current ? 'pending' : 'saved');
      } catch (err) {
        if (err instanceof ApiError && err.code === 'attempt_closed') return closed();
        dirty.current = true;
        setSave('error');
      }
    },
    [id, closed],
  );

  const submit = useCallback(
    async (reason: 'candidate' | 'timeout') => {
      if (finished.current) return;
      setSubmitting(true);
      setSubmitError(null);
      if (timer.current) clearTimeout(timer.current);
      try {
        await api(`attempts/${id}/submit`, { method: 'POST', body: { answers: answersRef.current } });
        finished.current = true;
        clearFlags(id);
        navigate(paths.result(id), { replace: true });
      } catch (err) {
        if (err instanceof ApiError && err.code === 'attempt_closed') return closed();
        setSubmitting(false);
        setSubmitError(err);
        if (reason === 'timeout') setConfirmSubmit(false);
      }
    },
    [id, closed],
  );

  // Countdown and time warnings.
  useEffect(() => {
    const tick = () => {
      const left = remainingNow();
      setRemaining(left);
      if (left <= 300 && !warned.current.five) {
        warned.current.five = true;
        setAnnouncement('Five minutes remaining.');
      }
      if (left <= 60 && !warned.current.one) {
        warned.current.one = true;
        setAnnouncement('One minute remaining. Your saved answers will be marked when time runs out.');
      }
      if (left <= 0) void submit('timeout');
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submit]);

  // Warn before leaving with unsaved answers; save what we can on hide.
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (finished.current) return;
      if (dirty.current) void flush({ keepalive: true });
      e.preventDefault();
      e.returnValue = '';
    };
    const hidden = () => document.visibilityState === 'hidden' && void flush({ keepalive: true });
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [flush]);

  // Retry failed saves when the connection returns.
  useEffect(() => {
    const online = () => void flush();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [flush]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const choose = (questionId: string, key: OptionKey) => {
    const next = { ...answersRef.current, [questionId]: key };
    answersRef.current = next;
    setAnswers(next);
    dirty.current = true;
    setSave('pending');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  };

  const toggleFlag = (questionId: string) =>
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      storeFlags(id, next);
      return next;
    });

  const go = (i: number) => {
    setIndex(Math.min(total - 1, Math.max(0, i)));
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const q = questions[index];
  const answered = questions.filter((x) => answers[x.id]).length;
  const unanswered = total - answered;
  const flagged = questions.filter((x) => flags.has(x.id)).length;
  const low = remaining <= 300;

  return (
    <div className={styles.exam}>
      <header className={styles.bar}>
        <div className={`p-wrap ${styles.barInner}`}>
          <div className={styles.progress}>
            <span className={styles.barLabel}>Answered</span>
            <span className={styles.barValue}>
              {answered}/{total}
            </span>
          </div>
          <SaveStatus state={save} onRetry={() => void flush()} />
          <div className={`${styles.timer} ${low ? styles.timerLow : ''}`} role="timer" aria-label={`Time remaining ${clock(remaining)}`}>
            <span className={styles.barLabel}>Time left</span>
            <span className={styles.barValue} aria-hidden="true">
              {clock(remaining)}
            </span>
          </div>
        </div>
        <div className={styles.track} aria-hidden="true">
          <span style={{ width: `${(answered / total) * 100}%` }} />
        </div>
      </header>
      <p className="p-sr" aria-live="assertive">
        {announcement}
      </p>

      <div className={`p-wrap ${styles.layout}`}>
        <div className={styles.main}>
          <h1 className="p-sr">Customer Support Professional Assessment</h1>
          <form
            className={styles.question}
            onSubmit={(e) => {
              e.preventDefault();
              if (index < total - 1) go(index + 1);
              else setConfirmSubmit(true);
            }}
          >
            <fieldset>
              <legend className={styles.legend}>
                <span className={styles.qMeta}>
                  Question {index + 1} of {total} · {areaLabel(q.category)}
                </span>
                <span ref={headingRef} tabIndex={-1} className={styles.prompt}>
                  {q.prompt}
                </span>
              </legend>
              <div className={styles.options}>
                {q.options.map((o) => (
                  <label key={o.key} className={`${styles.option} ${answers[q.id] === o.key ? styles.optionOn : ''}`}>
                    <input type="radio" name={`q-${q.id}`} value={o.key} checked={answers[q.id] === o.key} onChange={() => choose(q.id, o.key)} />
                    <span>{o.text}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className={`p-check ${styles.flag}`}>
              <input type="checkbox" checked={flags.has(q.id)} onChange={() => toggleFlag(q.id)} />
              <span>Flag this question to review later</span>
            </label>

            <div className={styles.nav}>
              <button type="button" className="p-btn p-btn--ghost" onClick={() => go(index - 1)} disabled={index === 0}>
                Previous
              </button>
              {index < total - 1 ? (
                <button type="submit" className="p-btn">
                  Next question
                </button>
              ) : (
                <button type="submit" className="p-btn p-btn--accent">
                  Review and submit
                </button>
              )}
            </div>
          </form>

          {submitError ? (
            <ErrorNotice error={submitError}>
              <p className="p-small">Your answers are still on this page. Check your connection, then submit again.</p>
            </ErrorNotice>
          ) : null}
        </div>

        <aside className={styles.side} aria-label="Question navigator">
          <h2 className="p-h3">Questions</h2>
          <ol className={styles.grid}>
            {questions.map((x, i) => {
              const state = [answers[x.id] ? 'answered' : 'not answered', flags.has(x.id) ? 'flagged' : ''].filter(Boolean).join(', ');
              return (
                <li key={x.id}>
                  <button
                    type="button"
                    className={`${styles.cell} ${answers[x.id] ? styles.cellDone : ''} ${flags.has(x.id) ? styles.cellFlag : ''}`}
                    aria-current={i === index ? 'step' : undefined}
                    aria-label={`Question ${i + 1}, ${state}`}
                    onClick={() => go(i)}
                  >
                    {i + 1}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="p-small p-muted">
            {unanswered} unanswered{flagged ? ` · ${flagged} flagged` : ''}
          </p>
          <button type="button" className="p-btn p-btn--accent" style={{ width: '100%' }} onClick={() => setConfirmSubmit(true)}>
            Submit assessment
          </button>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        title="Submit your assessment?"
        confirmLabel="Submit for marking"
        cancelLabel="Keep working"
        busy={submitting}
        onConfirm={() => void submit('candidate')}
        onCancel={() => setConfirmSubmit(false)}
      >
        <p>
          You have answered <strong>{answered}</strong> of {total} questions.
          {unanswered > 0 && (
            <>
              {' '}
              <strong>{unanswered} unanswered</strong> {unanswered === 1 ? 'question counts' : 'questions count'} as incorrect.
            </>
          )}
        </p>
        {flagged > 0 && <p>You flagged {flagged} for review.</p>}
        <p>You cannot change your answers after you submit.</p>
      </ConfirmDialog>
    </div>
  );
}

function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const text: Record<SaveState, string> = {
    idle: 'Answers save automatically',
    pending: 'Saving…',
    saving: 'Saving…',
    saved: 'All answers saved',
    error: 'Not saved',
  };
  return (
    <div className={styles.save} role="status" aria-live="polite">
      <span className={`${styles.dot} ${state === 'error' ? styles.dotBad : state === 'saved' ? styles.dotOk : ''}`} aria-hidden="true" />
      <span>{text[state]}</span>
      {state === 'error' && (
        <button type="button" className="p-btn p-btn--small p-btn--ghost" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

const flagKey = (id: string) => `csp.flags.${id}`;
function loadFlags(id: string): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(flagKey(id)) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
function storeFlags(id: string, flags: Set<string>) {
  try {
    sessionStorage.setItem(flagKey(id), JSON.stringify([...flags]));
  } catch {
    /* flags are a convenience only */
  }
}
function clearFlags(id: string) {
  try {
    sessionStorage.removeItem(flagKey(id));
  } catch {
    /* ignore */
  }
}
