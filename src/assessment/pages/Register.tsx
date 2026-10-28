import { useState, type FormEvent } from 'react';
import { api, ApiError, session, type Candidate } from '../api';
import { Link, navigate, paths } from '../router';
import { ErrorNotice, Loading, useConfig, useMe } from '../ui';

interface Created {
  token: string;
  recoveryCode: string;
  candidate: Candidate;
}

export function Register() {
  const config = useConfig();
  const me = useMe();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', acceptTerms: false });
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  if (created) return <RecoveryCode created={created} />;
  if (config.loading || me.loading) return <Loading />;
  if (config.error) return <div className="p-wrap p-narrow"><ErrorNotice error={config.error} /></div>;

  if (me.data) {
    return (
      <div className="p-wrap p-narrow p-stack">
        <h1 className="p-h1">You are already registered</h1>
        <p className="p-lead">
          This browser is signed in as {me.data.candidate.fullName} ({me.data.candidate.email}).
        </p>
        <p>
          <Link className="p-btn" href={paths.dashboard}>
            Go to my assessment
          </Link>
        </p>
      </div>
    );
  }

  const set = (k: keyof typeof form) => (e: { target: HTMLInputElement }) =>
    setForm((f) => ({ ...f, [k]: k === 'acceptTerms' ? e.target.checked : e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setError(null);
    if (!form.acceptTerms) {
      setFieldError({ field: 'acceptTerms', message: 'Please confirm that you accept the terms and have read the privacy notice.' });
      return;
    }
    setBusy(true);
    try {
      const res = await api<Created>('session', {
        method: 'POST',
        token: null,
        body: { ...form, privacyNoticeVersion: config.data!.privacyNoticeVersion },
      });
      session.set(res.token);
      setCreated(res);
    } catch (err) {
      if (err instanceof ApiError && typeof err.extra.field === 'string') setFieldError({ field: err.extra.field, message: err.message });
      else setError(err);
    } finally {
      setBusy(false);
    }
  }

  const err = (field: string) =>
    fieldError?.field === field ? (
      <p className="p-error-text" id={`${field}-error`}>
        {fieldError.message}
      </p>
    ) : null;
  const invalid = (field: string) => (fieldError?.field === field ? { 'aria-invalid': true, 'aria-describedby': `${field}-error` } : {});

  return (
    <div className="p-wrap p-narrow">
      <p className="p-eyebrow">Step 1 of 2</p>
      <h1 className="p-h1">Register for the assessment</h1>
      <p className="p-lead" style={{ marginTop: 12 }}>
        No password needed. We will give you a recovery code so you can come back from another device.
      </p>

      <form className="p-card p-stack" style={{ marginTop: 28, ['--gap' as string]: '22px' }} onSubmit={submit} noValidate>
        <div className="p-field">
          <label className="p-label" htmlFor="fullName">
            Full name
          </label>
          <p className="p-hint" id="fullName-hint">
            Exactly as it should appear on your certificate. You cannot change it after you register.
          </p>
          <input
            id="fullName"
            className="p-input"
            autoComplete="name"
            required
            maxLength={100}
            value={form.fullName}
            onChange={set('fullName')}
            aria-describedby="fullName-hint"
            {...invalid('fullName')}
          />
          {err('fullName')}
        </div>

        <div className="p-field">
          <label className="p-label" htmlFor="email">
            Email address
          </label>
          <p className="p-hint" id="email-hint">You will need this, with your recovery code, to restore access.</p>
          <input
            id="email"
            className="p-input"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            maxLength={254}
            value={form.email}
            onChange={set('email')}
            aria-describedby="email-hint"
            {...invalid('email')}
          />
          {err('email')}
        </div>

        <div className="p-field">
          <label className="p-label" htmlFor="phone">
            Phone number <span className="p-muted">(optional)</span>
          </label>
          <input
            id="phone"
            className="p-input"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            maxLength={20}
            value={form.phone}
            onChange={set('phone')}
            {...invalid('phone')}
          />
          {err('phone')}
        </div>

        <div className="p-field">
          <label className="p-check">
            <input type="checkbox" checked={form.acceptTerms} onChange={set('acceptTerms')} {...invalid('acceptTerms')} />
            <span>
              I accept the{' '}
              <a className="p-link" href={paths.terms} target="_blank" rel="noopener">
                assessment terms
              </a>{' '}
              and have read the{' '}
              <a className="p-link" href={paths.privacy} target="_blank" rel="noopener">
                privacy notice
              </a>
              . I will complete the assessment myself without help from others.
            </span>
          </label>
          {err('acceptTerms')}
        </div>

        <ErrorNotice error={error} />

        <div className="p-row">
          <button className="p-btn p-btn--accent" type="submit" disabled={busy}>
            {busy ? 'Registering…' : 'Register'}
          </button>
          <Link className="p-link" href={paths.recover}>
            I have a recovery code
          </Link>
        </div>
      </form>
    </div>
  );
}

function RecoveryCode({ created }: { created: Created }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.recoveryCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="p-wrap p-narrow">
      <p className="p-eyebrow">Step 2 of 2</p>
      <h1 className="p-h1">Save your recovery code</h1>
      <div className="p-card p-stack" style={{ marginTop: 28 }}>
        <p>
          You are registered as <strong>{created.candidate.fullName}</strong> ({created.candidate.email}).
        </p>
        <p>
          This code, with your email address, is the only way to return to your assessment and certificate from another device or after
          clearing your browser. <strong>We show it only once and cannot resend it.</strong>
        </p>
        <p className="p-code" aria-label={`Recovery code ${created.recoveryCode.split('').join(' ')}`}>
          {created.recoveryCode}
        </p>
        <div className="p-row">
          <button type="button" className="p-btn p-btn--ghost p-btn--small" onClick={copy}>
            {copied ? 'Copied' : 'Copy code'}
          </button>
          <span role="status" className="p-sr">
            {copied ? 'Recovery code copied to clipboard' : ''}
          </span>
        </div>
        <p className="p-small p-muted">Write it down or keep it in a password manager. Do not share it.</p>
        <label className="p-check">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          <span>I have saved my recovery code somewhere safe.</span>
        </label>
        <div>
          <button type="button" className="p-btn" disabled={!saved} onClick={() => navigate(paths.dashboard, { replace: true })}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
