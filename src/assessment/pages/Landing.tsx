import { AREAS, CERTIFICATE_NOTE } from '../content';
import { naira } from '../format';
import { Link, paths } from '../router';
import { ErrorNotice, Loading, useConfig, useMe } from '../ui';
import styles from './Landing.module.css';

export function Landing() {
  const config = useConfig();
  const me = useMe();
  const c = config.data;

  return (
    <div className="p-wrap">
      <section className={styles.hero}>
        <p className="p-eyebrow">Professional assessment</p>
        <h1 className="p-h1">10X Customer Support Professional Assessment</h1>
        <p className="p-lead">
          A timed, multiple-choice assessment of practical customer support knowledge and judgment. Study the free handbook, take the
          assessment, and see your result straight away.
        </p>
        <div className="p-row" style={{ marginTop: 28 }}>
          {me.loading ? null : me.data ? (
            <Link className="p-btn p-btn--accent" href={paths.dashboard}>
              Continue as {me.data.candidate.fullName}
            </Link>
          ) : (
            <Link className="p-btn p-btn--accent" href={paths.register}>
              Register to begin
            </Link>
          )}
          <Link className="p-btn p-btn--ghost" href={paths.handbook}>
            Read the study handbook
          </Link>
        </div>
        {!me.loading && !me.data && (
          <p className="p-small p-muted" style={{ marginTop: 14 }}>
            Registered on another device or browser?{' '}
            <Link className="p-link" href={paths.recover}>
              Restore access with your recovery code
            </Link>
          </p>
        )}
      </section>

      {config.loading ? (
        <Loading />
      ) : config.error ? (
        <ErrorNotice error={config.error} />
      ) : (
        c && (
          <dl className={styles.facts} aria-label="Assessment at a glance">
            <div>
              <dt>Questions</dt>
              <dd>{c.questionsPerAttempt}</dd>
            </div>
            <div>
              <dt>Time limit</dt>
              <dd>{c.durationMinutes} minutes</dd>
            </div>
            <div>
              <dt>Pass mark</dt>
              <dd>
                {c.passMarkPercent}% <span className={styles.factNote}>({c.requiredCorrect} correct)</span>
              </dd>
            </div>
            <div>
              <dt>Certificate</dt>
              <dd>
                {naira(c.certificateFeeKobo)} <span className={styles.factNote}>only if you pass</span>
              </dd>
            </div>
          </dl>
        )
      )}

      <section className={styles.section} aria-labelledby="how">
        <h2 id="how" className="p-h2">
          How it works
        </h2>
        <ol className={styles.steps}>
          <li>
            <h3 className="p-h3">Study</h3>
            <p>Work through the handbook. It covers every area in the assessment and is free to read online or as a PDF.</p>
          </li>
          <li>
            <h3 className="p-h3">Register</h3>
            <p>Give your full name as it should appear on the certificate and an email address. No account or password is needed.</p>
          </li>
          <li>
            <h3 className="p-h3">Take the assessment</h3>
            <p>
              Answer {c?.questionsPerAttempt ?? 30} questions in {c?.durationMinutes ?? 35} minutes. Questions and answer options are
              drawn and ordered differently for each attempt, and your answers save as you go.
            </p>
          </li>
          <li>
            <h3 className="p-h3">Get your result</h3>
            <p>Your attempt is marked on our server as soon as you submit. You see your score and how you did in each area.</p>
          </li>
          <li>
            <h3 className="p-h3">Receive your certificate</h3>
            <p>
              If you pass, pay the {c ? naira(c.certificateFeeKobo) : '₦1,000'} certificate fee securely through Paystack. Your PDF
              certificate is issued once we have confirmed the payment with Paystack, and anyone can check it on our verification page.
            </p>
          </li>
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="covers">
        <h2 id="covers" className="p-h2">
          What the assessment covers
        </h2>
        <ul className={styles.areas}>
          {AREAS.map((a) => (
            <li key={a.label}>{a.label}</li>
          ))}
        </ul>
        <p className="p-muted p-small" style={{ marginTop: 16 }}>
          About half of the questions are short workplace scenarios that ask what you would do.
        </p>
      </section>

      <section className={`${styles.section} ${styles.split}`} aria-labelledby="before">
        <div className="p-stack">
          <h2 id="before" className="p-h2">
            Before you start
          </h2>
          <ul className="p-list">
            <li>Set aside {c?.durationMinutes ?? 35} uninterrupted minutes and use a stable internet connection.</li>
            <li>The timer starts when you begin and keeps running if you close the page. Saved answers are marked when time runs out.</li>
            <li>You may not see correct answers during or after the assessment. You will see your score for each area.</li>
            <li>
              If you do not pass, you can study and try again
              {c ? ` (up to ${c.maxAttemptsPerDay} attempts in 24 hours)` : ''}. Every attempt is kept on record.
            </li>
            <li>The assessment is your own work: no help from other people, and no sharing of questions.</li>
          </ul>
        </div>
        <aside className="p-card p-stack" aria-label="About the certificate">
          <h3 className="p-h3">About the certificate</h3>
          <p className="p-small">{CERTIFICATE_NOTE}</p>
          <p className="p-small">
            Each certificate has a unique number and a QR code linking to its record on our{' '}
            <Link className="p-link" href={paths.verify()}>
              verification page
            </Link>
            .
          </p>
        </aside>
      </section>
    </div>
  );
}
