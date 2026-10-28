import { useState, type FormEvent } from 'react';
import { api, ApiError, download } from '../api';
import { dateTime, naira, percent } from '../format';
import { ConfirmDialog, ErrorNotice, Loading, useResource } from '../ui';
import styles from './Admin.module.css';

/**
 * Administration. Sign-in is Supabase Auth (email + password); the server
 * then checks the token and the admin_users allow-list on every request.
 * The page itself holds nothing sensitive until the server says yes.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const ADMIN_KEY = 'csp.admin';

const adminSession = {
  get: () => {
    try {
      return sessionStorage.getItem(ADMIN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string) => {
    try {
      sessionStorage.setItem(ADMIN_KEY, t);
    } catch {
      /* tab-only session */
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(ADMIN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export default function Admin() {
  const [token, setToken] = useState<string | null>(adminSession.get);
  const signOut = async () => {
    const t = token;
    adminSession.clear();
    setToken(null);
    if (t && SUPABASE_URL && PUBLISHABLE_KEY) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${t}` },
      }).catch(() => undefined);
    }
  };
  if (!token) return <SignIn onSignedIn={(t) => (adminSession.set(t), setToken(t))} />;
  return <Console token={token} onSignOut={signOut} />;
}

function SignIn({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
      setError('Admin sign-in is not configured on this deployment.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('Email or password not recognised.');
      const body = (await res.json()) as { access_token?: string };
      if (!body.access_token) throw new Error('Sign-in failed.');
      // Confirm the server accepts this account before showing the console.
      await api('admin/me', { token: body.access_token });
      setPassword('');
      onSignedIn(body.access_token);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? 'This account is not authorised.' : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-wrap p-narrow">
      <h1 className="p-h1">Administration</h1>
      <form className="p-card p-stack" style={{ marginTop: 24, maxWidth: 420, ['--gap' as string]: '18px' }} onSubmit={submit}>
        <div className="p-field">
          <label className="p-label" htmlFor="a-email">
            Email
          </label>
          <input id="a-email" className="p-input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="p-field">
          <label className="p-label" htmlFor="a-pass">
            Password
          </label>
          <input
            id="a-pass"
            className="p-input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <ErrorNotice error={error} />
        <div>
          <button className="p-btn" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>
    </div>
  );
}

interface Summary {
  summary: Record<string, number | null>;
  config: {
    questionsPerAttempt: number;
    durationMinutes: number;
    passMarkPercent: number;
    certificateFeeKobo: number;
    submissionGraceSeconds: number;
    retakeCooldownMinutes: number;
    maxAttemptsPerDay: number;
    accessTokenTtlDays: number;
    paymentsEnabled: boolean;
    requiredCorrect: number;
  };
  questionBankVersion: string;
  paystackConfigured: boolean;
  paystackMode: 'live' | 'test' | 'not_configured';
}

interface Row {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  timedOut: boolean;
  correctAnswers: number | null;
  totalQuestions: number;
  scorePercentage: number | null;
  paymentStatus: string | null;
  paymentReference: string | null;
  amountKobo: number | null;
  paidAt: string | null;
  certificateNumber: string | null;
  certificateRevoked: boolean;
}

interface AuditEvent {
  id: number;
  event_type: string;
  actor: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

type Tab = 'overview' | 'attempts' | 'settings' | 'audit';

function Console({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const summary = useResource((signal) => api<Summary>('admin/summary', { token, signal }), [token]);
  const expired = [summary.error].some((e) => e instanceof ApiError && (e.status === 401 || e.status === 403));
  if (expired) {
    return (
      <div className="p-wrap p-narrow p-stack">
        <h1 className="p-h1">Administration</h1>
        <ErrorNotice error={summary.error} />
        <p>
          <button type="button" className="p-btn" onClick={onSignOut}>
            Sign in again
          </button>
        </p>
      </div>
    );
  }

  const tabs: [Tab, string][] = [
    ['overview', 'Overview'],
    ['attempts', 'Attempts'],
    ['settings', 'Settings'],
    ['audit', 'Audit log'],
  ];

  return (
    <div className="p-wrap p-stack" style={{ ['--gap' as string]: '24px' }}>
      <div className={styles.head}>
        <h1 className="p-h1">Administration</h1>
        <button type="button" className="p-btn p-btn--ghost p-btn--small" onClick={onSignOut}>
          Sign out
        </button>
      </div>
      <div role="tablist" aria-label="Sections" className={styles.tabs}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            className={styles.tab}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'overview' && <Overview data={summary.data} loading={summary.loading} error={summary.error} />}
        {tab === 'attempts' && <Attempts token={token} />}
        {tab === 'settings' && summary.data && <Settings token={token} data={summary.data} onSaved={summary.reload} />}
        {tab === 'audit' && <Audit token={token} />}
      </div>
    </div>
  );
}

function Overview({ data, loading, error }: { data?: Summary; loading: boolean; error?: unknown }) {
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNotice error={error} />;
  if (!data) return null;
  const s = data.summary;
  const n = (k: string) => Number(s[k] ?? 0);
  const stats: [string, string, string?][] = [
    ['Candidates', String(n('candidates'))],
    ['Attempts', String(n('attempts')), `${n('attempts_in_progress')} in progress`],
    ['Passed', String(n('attempts_passed')), `pass rate ${s.pass_rate_percent === null ? '—' : percent(s.pass_rate_percent)}`],
    ['Not passed', String(n('attempts_failed'))],
    ['Certificates issued', String(n('certificates_issued')), `${n('certificates_revoked')} revoked`],
    ['Successful payments', String(n('payments_success')), `${n('payments_pending')} open · ${n('payments_failed')} failed or abandoned`],
    ['Gross payments received (before fees)', naira(n('gross_success_kobo')), 'Not profit: Paystack fees, refunds and costs are not deducted'],
  ];
  return (
    <div className="p-stack" style={{ ['--gap' as string]: '20px' }}>
      {n('payments_duplicate') > 0 && (
        <div className="p-notice p-notice--warn">
          <p>
            {n('payments_duplicate')} duplicate payment{n('payments_duplicate') === 1 ? '' : 's'} recorded (a candidate paid again after
            their certificate was issued). Check these in the Paystack dashboard and refund if appropriate.
          </p>
        </div>
      )}
      <dl className={styles.stats}>
        {stats.map(([label, value, note]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
            {note && <dd className="p-small p-muted">{note}</dd>}
          </div>
        ))}
      </dl>
      <dl className="p-dl p-card">
        <dt>Paystack</dt>
        <dd>
          {data.paystackMode === 'live' ? (
            <span className="p-badge p-badge--ok">Live keys</span>
          ) : data.paystackMode === 'test' ? (
            <span className="p-badge p-badge--warn">Test keys</span>
          ) : (
            <span className="p-badge p-badge--bad">Not configured</span>
          )}{' '}
          {data.config.paymentsEnabled ? 'Payments enabled' : 'Payments switched off in settings'}
        </dd>
        <dt>Question bank</dt>
        <dd>Version {data.questionBankVersion}</dd>
        <dt>Assessment</dt>
        <dd>
          {data.config.questionsPerAttempt} questions · {data.config.durationMinutes} min · pass {percent(data.config.passMarkPercent)} (
          {data.config.requiredCorrect} correct) · fee {naira(data.config.certificateFeeKobo)}
        </dd>
      </dl>
    </div>
  );
}

function Attempts({ token }: { token: string }) {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState({ status: '', q: '', page: 1 });
  const [revoke, setRevoke] = useState<Row | null>(null);
  const [exportError, setExportError] = useState<unknown>(null);
  const list = useResource(
    (signal) => {
      const p = new URLSearchParams({ page: String(query.page) });
      if (query.status) p.set('status', query.status);
      if (query.q) p.set('q', query.q);
      return api<{ page: number; pageSize: number; total: number; rows: Row[] }>(`admin/attempts?${p}`, { token, signal });
    },
    [token, query.status, query.q, query.page],
  );
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  const exportCsv = async () => {
    setExportError(null);
    try {
      await download(`admin/export.csv${query.status ? `?status=${query.status}` : ''}`, `csp-attempts-${new Date().toISOString().slice(0, 10)}.csv`, token);
    } catch (err) {
      setExportError(err);
    }
  };

  return (
    <div className="p-stack" style={{ ['--gap' as string]: '16px' }}>
      <form
        className={styles.filters}
        onSubmit={(e) => {
          e.preventDefault();
          setQuery({ status, q: q.trim(), page: 1 });
        }}
      >
        <div className="p-field">
          <label className="p-label" htmlFor="f-status">
            Result
          </label>
          <select id="f-status" className="p-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="passed">Passed</option>
            <option value="failed">Not passed</option>
            <option value="in_progress">In progress</option>
          </select>
        </div>
        <div className="p-field" style={{ flex: '1 1 220px' }}>
          <label className="p-label" htmlFor="f-q">
            Email contains
          </label>
          <input id="f-q" className="p-input" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="p-btn" type="submit">
          Filter
        </button>
        <button className="p-btn p-btn--ghost" type="button" onClick={exportCsv}>
          Export CSV
        </button>
      </form>
      <ErrorNotice error={exportError} />
      {list.loading && !list.data ? (
        <Loading />
      ) : list.error ? (
        <ErrorNotice error={list.error} />
      ) : (
        list.data && (
          <>
            <p className="p-small p-muted" role="status">
              {list.data.total} attempt{list.data.total === 1 ? '' : 's'}
            </p>
            <div className="p-table-wrap">
              <table className="p-table">
                <thead>
                  <tr>
                    <th scope="col">Candidate</th>
                    <th scope="col">Started</th>
                    <th scope="col">Result</th>
                    <th scope="col">Payment</th>
                    <th scope="col">Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.name}</strong>
                        <br />
                        <span className="p-small p-muted">{r.email}</span>
                        {r.phone && <span className="p-small p-muted"> · {r.phone}</span>}
                      </td>
                      <td className="p-small">{dateTime(r.startedAt)}</td>
                      <td>
                        {r.status === 'in_progress' ? (
                          <span className="p-badge p-badge--warn">In progress</span>
                        ) : (
                          <>
                            <span className={`p-badge ${r.status === 'passed' ? 'p-badge--ok' : 'p-badge--bad'}`}>
                              {r.status === 'passed' ? 'Passed' : 'Not passed'}
                            </span>
                            <br />
                            <span className="p-small">
                              {r.correctAnswers}/{r.totalQuestions} · {percent(r.scorePercentage)}
                              {r.timedOut ? ' · timed out' : ''}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="p-small">
                        {r.paymentStatus ?? '—'}
                        {r.amountKobo !== null && (
                          <>
                            <br />
                            {naira(r.amountKobo)} · {dateTime(r.paidAt)}
                          </>
                        )}
                        {r.paymentReference && (
                          <>
                            <br />
                            <code>{r.paymentReference}</code>
                          </>
                        )}
                      </td>
                      <td className="p-small">
                        {r.certificateNumber ? (
                          <>
                            {r.certificateNumber}
                            <br />
                            {r.certificateRevoked ? (
                              <span className="p-badge p-badge--bad">Revoked</span>
                            ) : (
                              <button type="button" className="p-btn p-btn--ghost p-btn--small" onClick={() => setRevoke(r)}>
                                Revoke
                              </button>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-row">
              <button
                type="button"
                className="p-btn p-btn--ghost p-btn--small"
                disabled={query.page <= 1}
                onClick={() => setQuery((x) => ({ ...x, page: x.page - 1 }))}
              >
                Previous
              </button>
              <span className="p-small">
                Page {query.page} of {pages}
              </span>
              <button
                type="button"
                className="p-btn p-btn--ghost p-btn--small"
                disabled={query.page >= pages}
                onClick={() => setQuery((x) => ({ ...x, page: x.page + 1 }))}
              >
                Next
              </button>
            </div>
          </>
        )
      )}
      {revoke && <RevokeDialog token={token} row={revoke} onClose={(done) => (setRevoke(null), done && list.reload())} />}
    </div>
  );
}

function RevokeDialog({ token, row, onClose }: { token: string; row: Row; onClose: (done: boolean) => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const confirm = async () => {
    if (reason.trim().length < 5) {
      setError(new Error('Give a reason of at least a few words. It is kept in the audit log.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`admin/certificates/${encodeURIComponent(row.certificateNumber!)}/revoke`, {
        method: 'POST',
        token,
        body: { reason: reason.trim() },
      });
      onClose(true);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog open title={`Revoke ${row.certificateNumber}?`} confirmLabel="Revoke certificate" danger busy={busy} onConfirm={confirm} onCancel={() => onClose(false)}>
      <p>
        The certificate issued to <strong>{row.name}</strong> will show as revoked on the verification page and can no longer be
        downloaded. This cannot be undone from this page.
      </p>
      <div className="p-field">
        <label className="p-label" htmlFor="revoke-reason">
          Reason (recorded in the audit log)
        </label>
        <textarea id="revoke-reason" className="p-input" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <ErrorNotice error={error} />
    </ConfirmDialog>
  );
}

const SETTINGS: { key: keyof Summary['config']; label: string; hint?: string; step?: number }[] = [
  { key: 'questionsPerAttempt', label: 'Questions per attempt', hint: 'Drawn from the bank in proportion to each area (5–40).' },
  { key: 'durationMinutes', label: 'Time limit (minutes)' },
  { key: 'passMarkPercent', label: 'Pass mark (%)', step: 0.5 },
  { key: 'certificateFeeKobo', label: 'Certificate fee (kobo)', hint: '100000 kobo = ₦1,000.' },
  { key: 'submissionGraceSeconds', label: 'Submission grace (seconds)', hint: 'Allowance for network delay after the timer ends.' },
  { key: 'retakeCooldownMinutes', label: 'Wait before a retake (minutes)' },
  { key: 'maxAttemptsPerDay', label: 'Attempts allowed per 24 hours' },
  { key: 'accessTokenTtlDays', label: 'Candidate sign-in lasts (days)' },
];

function Settings({ token, data, onSaved }: { token: string; data: Summary; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries([...SETTINGS.map((s) => [s.key, String(data.config[s.key])]), ['paymentsEnabled', data.config.paymentsEnabled]]),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const body: Record<string, number | boolean> = {};
    for (const s of SETTINGS) if (String(data.config[s.key]) !== form[s.key]) body[s.key] = Number(form[s.key]);
    if (form.paymentsEnabled !== data.config.paymentsEnabled) body.paymentsEnabled = form.paymentsEnabled as boolean;
    try {
      if (Object.keys(body).length) {
        await api('admin/config', { method: 'PATCH', token, body });
        onSaved();
      }
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="p-card p-stack" onSubmit={submit} style={{ ['--gap' as string]: '18px' }}>
      <p className="p-small p-muted">Changes apply to attempts started afterwards. Attempts already in progress keep their settings.</p>
      <div className={styles.settings}>
        {SETTINGS.map((s) => (
          <div className="p-field" key={s.key}>
            <label className="p-label" htmlFor={`s-${s.key}`}>
              {s.label}
            </label>
            {s.hint && <p className="p-hint">{s.hint}</p>}
            <input
              id={`s-${s.key}`}
              className="p-input"
              type="number"
              inputMode="decimal"
              step={s.step ?? 1}
              value={form[s.key] as string}
              onChange={(e) => setForm((f) => ({ ...f, [s.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <label className="p-check">
        <input type="checkbox" checked={form.paymentsEnabled as boolean} onChange={(e) => setForm((f) => ({ ...f, paymentsEnabled: e.target.checked }))} />
        <span>Accept certificate payments</span>
      </label>
      <ErrorNotice error={error} />
      {saved && (
        <p className="p-notice p-notice--ok" role="status">
          Settings saved.
        </p>
      )}
      <div>
        <button className="p-btn" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}

function Audit({ token }: { token: string }) {
  const list = useResource((signal) => api<{ events: AuditEvent[] }>('admin/audit', { token, signal }), [token]);
  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorNotice error={list.error} />;
  return (
    <div className="p-stack">
      <p className="p-small p-muted">The latest 100 security and administration events.</p>
      <div className="p-table-wrap">
        <table className="p-table">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Event</th>
              <th scope="col">Actor</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.events.map((e) => (
              <tr key={e.id}>
                <td className="p-small">{dateTime(e.created_at)}</td>
                <td>
                  <code>{e.event_type}</code>
                </td>
                <td className="p-small">{e.actor ?? '—'}</td>
                <td className="p-small">
                  <code className={styles.details}>{e.details ? JSON.stringify(e.details) : ''}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
