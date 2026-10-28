import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { CERTIFICATE_NOTE } from '../content';
import { dateOnly } from '../format';
import { navigate, paths } from '../router';
import { ErrorNotice, Loading, useResource } from '../ui';

interface VerifyResponse {
  status: 'valid' | 'revoked' | 'not_found';
  number?: string;
  certificate?: { number: string; title: string; recipientName: string; issuedAt: string; issuer: string; revokedAt: string | null };
}

export function Verify({ number }: { number: string }) {
  const [input, setInput] = useState(number);
  const lookup = useResource(
    (signal) => (number ? api<VerifyResponse>(`verify/${encodeURIComponent(number.trim())}`, { signal, token: null }) : Promise.resolve(null)),
    [number],
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = input.trim().toUpperCase();
    if (n) navigate(paths.verify(encodeURIComponent(n)));
  };

  const res = lookup.data;
  const c = res?.certificate;

  return (
    <div className="p-wrap p-narrow p-stack" style={{ ['--gap' as string]: '24px' }}>
      <div>
        <p className="p-eyebrow">Certificate verification</p>
        <h1 className="p-h1">Verify a certificate</h1>
        <p className="p-lead" style={{ marginTop: 12 }}>
          Check a 10X Customer Support Professional Assessment certificate by its number.
        </p>
      </div>

      <form className="p-card p-row" onSubmit={submit} role="search" style={{ alignItems: 'flex-end' }}>
        <div className="p-field" style={{ flex: '1 1 240px' }}>
          <label className="p-label" htmlFor="cert-no">
            Certificate number
          </label>
          <input
            id="cert-no"
            className="p-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={30}
            placeholder="10X-CSP-…"
          />
        </div>
        <button className="p-btn" type="submit">
          Check
        </button>
      </form>

      {number && lookup.loading && <Loading label="Checking" />}
      <ErrorNotice error={lookup.error} />

      {res && !lookup.loading && (
        <section aria-live="polite" aria-labelledby="verdict">
          {res.status === 'valid' && c && (
            <div className="p-notice p-notice--ok p-stack">
              <h2 id="verdict" className="p-h2">
                Valid certificate
              </h2>
              <Details c={c} />
            </div>
          )}
          {res.status === 'revoked' && c && (
            <div className="p-notice p-notice--error p-stack">
              <h2 id="verdict" className="p-h2">
                This certificate has been revoked
              </h2>
              <p>It was issued but is no longer valid. Do not rely on it.</p>
              <Details c={c} />
            </div>
          )}
          {res.status === 'not_found' && (
            <div className="p-notice p-notice--warn p-stack">
              <h2 id="verdict" className="p-h2">
                No certificate found
              </h2>
              <p>
                We have no certificate with the number <strong>{res.number ?? number}</strong>. Check that it was typed exactly as printed.
              </p>
            </div>
          )}
        </section>
      )}

      <p className="p-small p-muted">
        This page shows only what is printed on the certificate. {CERTIFICATE_NOTE}
      </p>
    </div>
  );
}

function Details({ c }: { c: NonNullable<VerifyResponse['certificate']> }) {
  return (
    <dl className="p-dl">
      <dt>Awarded to</dt>
      <dd>
        <strong>{c.recipientName}</strong>
      </dd>
      <dt>Certificate</dt>
      <dd>{c.title}</dd>
      <dt>Number</dt>
      <dd>{c.number}</dd>
      <dt>Issued</dt>
      <dd>{dateOnly(c.issuedAt)}</dd>
      {c.revokedAt && (
        <>
          <dt>Revoked</dt>
          <dd>{dateOnly(c.revokedAt)}</dd>
        </>
      )}
      <dt>Issued by</dt>
      <dd>{c.issuer}</dd>
    </dl>
  );
}
