import type { ReactNode } from 'react';
import { CERTIFICATE_NOTE } from '../content';
import { CONTACT_EMAIL, dateOnly } from '../format';
import { Link, paths } from '../router';
import { useConfig } from '../ui';

const Mail = () => (
  <a className="p-link" href={`mailto:${CONTACT_EMAIL}`}>
    {CONTACT_EMAIL}
  </a>
);

function Doc({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  const config = useConfig();
  const version = config.data?.privacyNoticeVersion;
  return (
    <article className="p-wrap p-narrow p-stack p-legal" style={{ ['--gap' as string]: '18px' }}>
      <p className="p-eyebrow">{eyebrow}</p>
      <h1 className="p-h1">{title}</h1>
      {version && <p className="p-small p-muted">Version {dateOnly(version)}</p>}
      {children}
    </article>
  );
}

export function Privacy() {
  return (
    <Doc eyebrow="Customer Support Professional Assessment" title="Privacy notice">
      <p>
        This notice explains how 10X Marketing Solutions (“we”) uses personal data when you take the 10X Customer Support Professional
        Assessment and when someone checks a certificate. For any privacy question or request, email <Mail />.
      </p>

      <h2 className="p-h2">What we collect</h2>
      <ul className="p-list">
        <li>
          <strong>Registration details:</strong> your full name, email address and, if you choose to give it, your phone number, plus the
          date and version of this notice and the terms you accepted.
        </li>
        <li>
          <strong>Assessment records:</strong> the questions you were given, your answers, start and submission times, your score and
          whether you passed.
        </li>
        <li>
          <strong>Payment records:</strong> the payment reference, amount, status and the payment channel Paystack reports. Card details
          are entered on Paystack’s page; we never see or store them.
        </li>
        <li>
          <strong>Certificate records:</strong> the certificate number, the name printed on it, the score and the issue date.
        </li>
        <li>
          <strong>Security records:</strong> a one-way, keyed hash of your IP address (not the address itself) and a log of important
          events such as registration, submission, payment confirmation and certificate download. These help us prevent abuse and
          investigate problems.
        </li>
      </ul>
      <p>
        We do not ask for your date of birth, home address or identity documents. Your recovery code and access token are stored only as
        one-way hashes.
      </p>

      <h2 className="p-h2">Why we use it</h2>
      <ul className="p-list">
        <li>To run the assessment, mark it and show you your result (to perform our agreement with you).</li>
        <li>To take the certificate fee and issue your certificate (to perform our agreement with you).</li>
        <li>
          To let employers and others confirm that a certificate is genuine (our legitimate interest, and yours, in certificates being
          trustworthy).
        </li>
        <li>To keep the service secure and prevent cheating and fraud (our legitimate interest).</li>
        <li>To keep payment records we are required to keep by law.</li>
      </ul>
      <p>We do not sell your data or use it for advertising.</p>

      <h2 className="p-h2">What the public verification page shows</h2>
      <p>
        Anyone with a certificate number can see the name on the certificate, the certificate title, the issue date, the issuer and
        whether it has been revoked. It does not show your email, phone number, score breakdown or answers. Certificate numbers are random
        and cannot be guessed in sequence.
      </p>

      <h2 className="p-h2">Who processes your data for us</h2>
      <ul className="p-list">
        <li>
          <strong>Supabase</strong> stores the assessment database. Our project is hosted in Supabase’s London (United Kingdom) region.
        </li>
        <li>
          <strong>Vercel</strong> hosts the website and runs the server code.
        </li>
        <li>
          <strong>Paystack</strong> processes certificate payments under its own privacy policy.
        </li>
      </ul>
      <p>
        Some of these providers process data outside Nigeria. We rely on their contractual safeguards for those transfers.
      </p>

      <h2 className="p-h2">How long we keep it</h2>
      <ul className="p-list">
        <li>Certificate records are kept for as long as the certificate can be verified, so that checks remain possible.</li>
        <li>Payment records are kept for as long as financial record-keeping rules require.</li>
        <li>
          Registrations and attempts that did not lead to a certificate are deleted on request, and otherwise reviewed and deleted when no
          longer needed.
        </li>
        <li>Security logs are kept only as long as needed to protect the service.</li>
      </ul>

      <h2 className="p-h2">Your rights</h2>
      <p>
        Under the Nigeria Data Protection Act 2023 you can ask for a copy of your data, ask us to correct or delete it, object to how we
        use it, and ask us to restrict its use. Email <Mail /> from the address you registered with. If we cannot delete something (for
        example a payment record we must keep), we will tell you why. You can also complain to the Nigeria Data Protection Commission.
      </p>

      <h2 className="p-h2">Cookies and storage</h2>
      <p>
        We do not use advertising or analytics cookies in the assessment portal. Your browser stores a random access token so you stay
        signed in, and may store which questions you flagged during an attempt. Signing out removes the token.
      </p>
    </Doc>
  );
}

export function Terms() {
  const config = useConfig();
  const c = config.data;
  return (
    <Doc eyebrow="Customer Support Professional Assessment" title="Assessment terms">
      <h2 className="p-h2">The assessment</h2>
      <ul className="p-list">
        <li>
          Each attempt has {c?.questionsPerAttempt ?? 30} multiple-choice questions and a {c?.durationMinutes ?? 35}-minute time limit. The
          pass mark is {c?.passMarkPercent ?? 70}%.
        </li>
        <li>The timer starts when you begin an attempt and does not pause. When time runs out, the answers saved up to then are marked.</li>
        <li>Marking is automatic and done on our server. Unanswered questions count as incorrect.</li>
        <li>
          If you do not pass, you may try again, up to {c?.maxAttemptsPerDay ?? 3} attempts in any 24 hours. All attempts are kept on
          record.
        </li>
        <li>We do not reveal the correct answers, so that the assessment stays fair for everyone.</li>
      </ul>

      <h2 className="p-h2">Your conduct</h2>
      <ul className="p-list">
        <li>Register in your own name, exactly as it should appear on the certificate. One registration per person.</li>
        <li>Complete the assessment yourself, without help from anyone else.</li>
        <li>Do not copy, record, share or publish the questions.</li>
        <li>
          An online assessment cannot fully prevent cheating. If we find clear evidence that an attempt was not your own work, or that a
          certificate was obtained dishonestly, we may cancel the result and revoke the certificate.
        </li>
      </ul>

      <h2 className="p-h2">Fee and certificate</h2>
      <ul className="p-list">
        <li>
          Taking the assessment is free. A certificate fee is payable only after you pass, and only if you want the certificate. It is
          paid through Paystack.
        </li>
        <li>The certificate is issued only after Paystack has confirmed the payment to us.</li>
        <li>
          Because the certificate is issued as soon as payment is confirmed, the fee is not normally refundable. If you were charged twice
          or charged in error, email <Mail /> with the payment reference and we will put it right.
        </li>
        <li>Each certificate has a unique number and can be checked on our verification page.</li>
        <li>We may revoke a certificate issued in error or obtained in breach of these terms. Revoked certificates show as revoked.</li>
      </ul>

      <h2 className="p-h2">What the certificate means</h2>
      <p>
        The certificate shows that you passed this assessment of customer support knowledge and judgment on the date shown. {CERTIFICATE_NOTE} It is a professional
        certificate from 10X Marketing Solutions, not a government or regulatory licence, and it does not guarantee employment.
      </p>

      <h2 className="p-h2">Your data</h2>
      <p>
        How we use your data is explained in the{' '}
        <Link className="p-link" href={paths.privacy}>
          privacy notice
        </Link>
        . Questions about these terms: <Mail />.
      </p>
    </Doc>
  );
}
