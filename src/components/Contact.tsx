import { ArrowRight, Mail, Phone } from 'lucide-react';
import { contact, site } from '../content/site';
import { useEnquiry } from '../context/EnquiryContext';
import { Reveal } from './Reveal';
import styles from './Contact.module.css';

export function Contact() {
  const { open } = useEnquiry();
  const { email, phone, emailPlaceholder, phonePlaceholder } = site.contact;

  return (
    <section id="contact" className={styles.contact} aria-labelledby="contact-title">
      <div className={styles.art} aria-hidden>
        <span className={styles.loop} />
        <span className={styles.arrow} />
      </div>
      <div className={`container ${styles.inner}`}>
        <Reveal>
          <p className={`index-label ${styles.index}`}>07 — Contact</p>
          <h2 id="contact-title" className={styles.title}>
            What are you building next<span className={styles.q}>?</span>
          </h2>
        </Reveal>
        <Reveal delay={0.1} className={styles.row}>
          <p className={styles.body}>{contact.body}</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => open()}>
            {contact.cta} <ArrowRight size={20} aria-hidden />
          </button>
        </Reveal>

        <Reveal delay={0.15}>
          <dl className={styles.details}>
            <div>
              <dt>
                <Mail size={16} aria-hidden /> Email
              </dt>
              <dd>{email ? <a href={`mailto:${email}`}>{email}</a> : <span className={styles.placeholder}>{emailPlaceholder}</span>}</dd>
            </div>
            <div>
              <dt>
                <Phone size={16} aria-hidden /> Phone
              </dt>
              <dd>
                {phone ? (
                  <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a>
                ) : (
                  <span className={styles.placeholder}>{phonePlaceholder}</span>
                )}
              </dd>
            </div>
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
