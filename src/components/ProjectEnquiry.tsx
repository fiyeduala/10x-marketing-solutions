import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Copy, Info, RotateCcw, X } from 'lucide-react';
import { services, timelines, type Need } from '../content/site';
import { useEnquiry } from '../context/EnquiryContext';
import { Dialog } from './Dialog';
import styles from './ProjectEnquiry.module.css';

interface FormState {
  need: Need | '';
  serviceId: string;
  description: string;
  timeline: string;
  name: string;
  email: string;
  phone: string;
}

const EMPTY: FormState = { need: '', serviceId: '', description: '', timeline: '', name: '', email: '', phone: '' };

type Step = 1 | 2 | 3 | 'review' | 'preview';
type Errors = Partial<Record<keyof FormState, string>>;

const NEED_OPTIONS: { id: Need; label: string; hint: string }[] = [
  { id: 'marketing', label: 'Marketing', hint: 'Strategy, campaigns, content and conversion' },
  { id: 'software', label: 'Software', hint: 'Websites, applications and business systems' },
  { id: 'both', label: 'Both', hint: 'A connected marketing and software project' },
];

const STEP_TITLES: Record<Exclude<Step, 'preview'>, string> = {
  1: 'What do you need?',
  2: 'Your project',
  3: 'Your details',
  review: 'Review your enquiry',
};

const needLabel = (n: FormState['need']) => NEED_OPTIONS.find((o) => o.id === n)?.label ?? '—';
const serviceName = (id: string) => services.find((s) => s.id === id)?.name;

function validate(step: Step, f: FormState): Errors {
  const e: Errors = {};
  if (step === 1 && !f.need) e.need = 'Choose Marketing, Software or Both.';
  if (step === 2) {
    if (!f.description.trim()) e.description = 'Tell us a little about the project.';
    else if (f.description.trim().length < 20) e.description = 'Please add a bit more detail (at least 20 characters).';
  }
  if (step === 3) {
    if (!f.name.trim()) e.name = 'Enter your name.';
    if (!f.email.trim()) e.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = 'Enter a valid email address, like name@company.com.';
    if (f.phone.trim() && !/^[+()\d\s.-]{6,}$/.test(f.phone.trim()))
      e.phone = 'Use digits, spaces and + ( ) - only, or leave this blank.';
  }
  return e;
}

function summaryText(f: FormState) {
  const lines = [
    'Project enquiry — 10X Marketing Solutions',
    '',
    `Need: ${needLabel(f.need)}`,
    `Service: ${serviceName(f.serviceId) ?? 'Not specified'}`,
    `Timeline: ${f.timeline || 'Not specified'}`,
    '',
    'Project description:',
    f.description.trim(),
    '',
    `Name: ${f.name.trim()}`,
    `Email: ${f.email.trim()}`,
    `Phone: ${f.phone.trim() || 'Not provided'}`,
  ];
  return lines.join('\n');
}

export function ProjectEnquiry() {
  const { isOpen, close, preset, presetKey } = useEnquiry();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [step, setStep] = useState<Step>(1);
  const [errors, setErrors] = useState<Errors>({});
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const firstFocus = useRef<HTMLButtonElement>(null);
  const stepChanged = useRef(false);
  const reduce = useReducedMotion();
  const uid = useId();

  // Apply a preset (e.g. from "Discuss this service") each time the panel is opened with one.
  useEffect(() => {
    if (!presetKey || !preset) return;
    setForm((f) => ({
      ...f,
      need: preset.need ?? f.need,
      serviceId: preset.serviceId ?? (preset.need && preset.need !== f.need ? '' : f.serviceId),
    }));
    setErrors({});
    setStep(1);
  }, [presetKey, preset]);

  // Move focus to the step heading after navigation for screen reader and keyboard users.
  useEffect(() => {
    if (!stepChanged.current) return;
    stepChanged.current = false;
    headingRef.current?.focus();
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const go = (s: Step) => {
    stepChanged.current = true;
    setStep(s);
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const next = () => {
    const e = validate(step, form);
    setErrors(e);
    const firstKey = Object.keys(e)[0];
    if (firstKey) {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-field="${firstKey}"]`)?.focus();
      });
      return;
    }
    if (step === 1) go(2);
    else if (step === 2) go(3);
    else if (step === 3) go('review');
    else if (step === 'review') {
      setCopyState('idle');
      go('preview');
    }
  };

  const back = () => {
    setErrors({});
    if (step === 2) go(1);
    else if (step === 3) go(2);
    else if (step === 'review') go(3);
    else if (step === 'preview') go('review');
  };

  const reset = () => {
    setForm(EMPTY);
    setErrors({});
    setCopyState('idle');
    go(1);
  };

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(summaryText(form));
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const stepNumber = typeof step === 'number' ? step : 4;
  const title = step === 'preview' ? 'Your enquiry preview' : STEP_TITLES[step];
  const availableServices = services.filter((s) => !form.need || form.need === 'both' || s.discipline === form.need);
  const err = (k: keyof FormState) => (errors[k] ? `${uid}-${k}-error` : undefined);

  return (
    <Dialog
      open={isOpen}
      onClose={close}
      labelledBy={`${uid}-title`}
      variant="sheet"
      initialFocusRef={firstFocus}
    >
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker} id={`${uid}-title`}>
              Start a project
            </p>
            <p className={styles.stepCount} aria-live="polite">
              {step === 'preview' ? 'Preview' : step === 'review' ? 'Review' : `Step ${step} of 3`}
            </p>
          </div>
          <button ref={firstFocus} type="button" className={styles.close} onClick={close}>
            <X size={20} aria-hidden />
            <span className="visually-hidden">Close enquiry panel</span>
          </button>
        </header>

        <div className={styles.progress} aria-hidden>
          {[1, 2, 3, 4].map((n) => (
            <span key={n} data-done={n <= stepNumber || undefined} />
          ))}
        </div>

        <form
          className={styles.form}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (step !== 'preview') next();
          }}
        >
          <div ref={bodyRef} className={styles.body}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={String(step)}
                initial={reduce ? false : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: -12 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <h2 ref={headingRef} tabIndex={-1} className={styles.title}>
                  {title}
                </h2>

                {step === 1 && (
                  <>
                    <p className={styles.lead}>
                      Share a few details and we’ll prepare an enquiry summary for you to review.
                    </p>
                    <fieldset
                      className={styles.fieldset}
                      aria-describedby={err('need')}
                      data-invalid={!!errors.need || undefined}
                    >
                      <legend className={styles.label}>
                        Area of work <span className={styles.req}>(required)</span>
                      </legend>
                      <div className={styles.needs}>
                        {NEED_OPTIONS.map((o, i) => (
                          <label key={o.id} className={styles.needOption}>
                            <input
                              type="radio"
                              name="need"
                              value={o.id}
                              checked={form.need === o.id}
                              onChange={() => {
                                update('need', o.id);
                                const current = services.find((s) => s.id === form.serviceId);
                                if (current && o.id !== 'both' && current.discipline !== o.id) update('serviceId', '');
                              }}
                              data-field={i === 0 ? 'need' : undefined}
                            />
                            <span className={styles.needCard}>
                              <span className={styles.needCheck} aria-hidden>
                                <Check size={14} />
                              </span>
                              <span className={styles.needLabel}>{o.label}</span>
                              <span className={styles.needHint}>{o.hint}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                      {errors.need && (
                        <p id={err('need')} className={styles.error}>
                          {errors.need}
                        </p>
                      )}
                    </fieldset>

                    <div className={styles.field}>
                      <label htmlFor={`${uid}-service`} className={styles.label}>
                        Specific service <span className={styles.opt}>(optional)</span>
                      </label>
                      <select
                        id={`${uid}-service`}
                        className={styles.input}
                        value={form.serviceId}
                        onChange={(e) => update('serviceId', e.target.value)}
                      >
                        <option value="">Not sure yet</option>
                        {(['marketing', 'software'] as const)
                          .filter((d) => availableServices.some((s) => s.discipline === d))
                          .map((d) => (
                            <optgroup key={d} label={d === 'marketing' ? 'Marketing' : 'Software'}>
                              {availableServices
                                .filter((s) => s.discipline === d)
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                            </optgroup>
                          ))}
                      </select>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div className={styles.field}>
                      <label htmlFor={`${uid}-description`} className={styles.label}>
                        Describe your project <span className={styles.req}>(required)</span>
                      </label>
                      <p id={`${uid}-description-hint`} className={styles.hint}>
                        What are you trying to achieve, and what do you have in place today?
                      </p>
                      <textarea
                        id={`${uid}-description`}
                        data-field="description"
                        className={`${styles.input} ${styles.textarea}`}
                        rows={6}
                        value={form.description}
                        onChange={(e) => update('description', e.target.value)}
                        aria-invalid={!!errors.description || undefined}
                        aria-describedby={[`${uid}-description-hint`, err('description')].filter(Boolean).join(' ')}
                      />
                      {errors.description && (
                        <p id={err('description')} className={styles.error}>
                          {errors.description}
                        </p>
                      )}
                    </div>

                    <fieldset className={styles.fieldset}>
                      <legend className={styles.label}>
                        Timeline <span className={styles.opt}>(optional)</span>
                      </legend>
                      <div className={styles.chips}>
                        {timelines.map((t) => (
                          <label key={t} className={styles.chip}>
                            <input
                              type="radio"
                              name="timeline"
                              value={t}
                              checked={form.timeline === t}
                              onChange={() => update('timeline', t)}
                            />
                            <span>{t}</span>
                          </label>
                        ))}
                      </div>
                      {form.timeline && (
                        <button type="button" className={styles.clearChoice} onClick={() => update('timeline', '')}>
                          Clear timeline
                        </button>
                      )}
                    </fieldset>
                  </>
                )}

                {step === 3 && (
                  <>
                    <TextField
                      id={`${uid}-name`}
                      field="name"
                      label="Name"
                      required
                      autoComplete="name"
                      value={form.name}
                      onChange={(v) => update('name', v)}
                      error={errors.name}
                      errorId={err('name')}
                    />
                    <TextField
                      id={`${uid}-email`}
                      field="email"
                      label="Email"
                      type="email"
                      required
                      autoComplete="email"
                      value={form.email}
                      onChange={(v) => update('email', v)}
                      error={errors.email}
                      errorId={err('email')}
                    />
                    <TextField
                      id={`${uid}-phone`}
                      field="phone"
                      label="Phone"
                      type="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={(v) => update('phone', v)}
                      error={errors.phone}
                      errorId={err('phone')}
                    />
                  </>
                )}

                {step === 'review' && (
                  <>
                    <p className={styles.lead}>Check the details below. You can edit any section before previewing.</p>
                    <dl className={styles.review}>
                      <ReviewRow label="Area of work" onEdit={() => go(1)}>
                        {needLabel(form.need)}
                        {serviceName(form.serviceId) && ` · ${serviceName(form.serviceId)}`}
                      </ReviewRow>
                      <ReviewRow label="Project" onEdit={() => go(2)}>
                        <span className={styles.pre}>{form.description.trim()}</span>
                        <span className={styles.muted}>Timeline: {form.timeline || 'Not specified'}</span>
                      </ReviewRow>
                      <ReviewRow label="Your details" onEdit={() => go(3)}>
                        {form.name.trim()}
                        <span className={styles.muted}>
                          {form.email.trim()}
                          {form.phone.trim() && ` · ${form.phone.trim()}`}
                        </span>
                      </ReviewRow>
                    </dl>
                    <p className={styles.notice}>
                      <Info size={18} aria-hidden />
                      <span>
                        This is a preview. Enquiries aren’t sent from this website yet, so nothing will be submitted.
                      </span>
                    </p>
                  </>
                )}

                {step === 'preview' && (
                  <>
                    <p className={styles.notice}>
                      <Info size={18} aria-hidden />
                      <span>
                        Your enquiry has <strong>not been sent</strong>. Online submission isn’t connected yet — copy
                        the summary below to share it directly.
                      </span>
                    </p>
                    <pre className={styles.summary}>
                      {summaryText(form)}
                    </pre>
                    <div className={styles.copyRow}>
                      <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
                        {copyState === 'copied' ? <Check size={17} aria-hidden /> : <Copy size={17} aria-hidden />}
                        {copyState === 'copied' ? 'Copied' : 'Copy enquiry'}
                      </button>
                      <p className={styles.copyStatus} role="status">
                        {copyState === 'copied' && 'Enquiry summary copied to your clipboard.'}
                      </p>
                    </div>
                    {copyState === 'failed' && (
                      <div className={styles.fallback} role="alert">
                        <p>Copying isn’t available in this browser. Select the text below and copy it manually.</p>
                        <textarea
                          className={`${styles.input} ${styles.textarea}`}
                          readOnly
                          rows={10}
                          value={summaryText(form)}
                          aria-label="Enquiry summary text"
                          onFocus={(e) => e.currentTarget.select()}
                          ref={(el) => el?.select()}
                        />
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <footer className={styles.footer}>
            {step !== 1 ? (
              <button type="button" className={styles.back} onClick={back}>
                <ArrowLeft size={18} aria-hidden /> Back
              </button>
            ) : (
              <span />
            )}
            <div className={styles.footerRight}>
              {(step === 'review' || step === 'preview') && (
                <button type="button" className={styles.back} onClick={reset}>
                  <RotateCcw size={16} aria-hidden /> Start over
                </button>
              )}
              {step === 'preview' ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
                  Close
                </button>
              ) : (
                <button type="submit" className="btn btn-primary btn-sm">
                  {step === 'review' ? 'Preview enquiry' : 'Continue'}
                  <ArrowRight size={17} aria-hidden />
                </button>
              )}
            </div>
          </footer>
        </form>
      </div>
    </Dialog>
  );
}

function TextField({
  id,
  field,
  label,
  type = 'text',
  required,
  autoComplete,
  value,
  onChange,
  error,
  errorId,
}: {
  id: string;
  field: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  errorId?: string;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label} {required ? <span className={styles.req}>(required)</span> : <span className={styles.opt}>(optional)</span>}
      </label>
      <input
        id={id}
        data-field={field}
        className={styles.input}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error || undefined}
        aria-describedby={errorId}
        aria-required={required || undefined}
      />
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

function ReviewRow({ label, onEdit, children }: { label: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className={styles.reviewRow}>
      <dt>{label}</dt>
      <dd>{children}</dd>
      <button type="button" className={styles.edit} onClick={onEdit}>
        Edit<span className="visually-hidden"> {label.toLowerCase()}</span>
      </button>
    </div>
  );
}
