import { useState, type FormEvent } from 'react';
import { api, session } from '../api';
import { Link, navigate, paths } from '../router';
import { ErrorNotice } from '../ui';
import { CONTACT_EMAIL } from '../format';

export function Recover() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ token: string }>('recover', { method: 'POST', token: null, body: { email, recoveryCode: code } });
      session.set(res.token);
      navigate(paths.dashboard, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-wrap p-narrow">
      <h1 className="p-h1">Restore access</h1>
      <p className="p-lead" style={{ marginTop: 12 }}>
        Enter the email address you registered with and the recovery code you were given.
      </p>
      <form className="p-card p-stack" style={{ marginTop: 28, ['--gap' as string]: '22px' }} onSubmit={submit}>
        <div className="p-field">
          <label className="p-label" htmlFor="r-email">
            Email address
          </label>
          <input id="r-email" className="p-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="p-field">
          <label className="p-label" htmlFor="r-code">
            Recovery code
          </label>
          <p className="p-hint" id="r-code-hint">
            16 letters and numbers, for example ABCD-EFGH-JKMN-PQRS. Dashes and capitals are optional.
          </p>
          <input
            id="r-code"
            className="p-input"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            maxLength={40}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-describedby="r-code-hint"
            style={{ fontFamily: 'ui-monospace, Consolas, monospace', letterSpacing: '0.06em' }}
          />
        </div>
        <ErrorNotice error={error} />
        <div className="p-row">
          <button className="p-btn p-btn--accent" type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Restore access'}
          </button>
          <Link className="p-link" href={paths.register}>
            Register instead
          </Link>
        </div>
      </form>
      <p className="p-small p-muted" style={{ marginTop: 20 }}>
        Lost your recovery code? Email{' '}
        <a className="p-link" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>{' '}
        from the address you registered with. For your security we may ask you to confirm details of your attempt.
      </p>
    </div>
  );
}
