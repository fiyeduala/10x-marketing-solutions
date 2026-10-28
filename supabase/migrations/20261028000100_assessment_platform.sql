-- 10X Customer Support Professional Assessment: schema, integrity rules and
-- server-only functions.
--
-- Access model: every table has Row Level Security enabled with NO policies,
-- and all privileges are revoked from the `anon` and `authenticated` roles.
-- Only the server (Vercel functions using the service-role/secret key) can
-- read or write. Browsers never talk to these tables directly.
--
-- The question bank and answer key are NOT stored here; they live in a
-- server-only, versioned module (server/questionBank.ts). Attempts record the
-- bank version and the exact questions/option order served.

-- ---------------------------------------------------------------------------
-- Configuration (single row, administrator-controlled)
-- ---------------------------------------------------------------------------
create table public.assessment_config (
  id smallint primary key default 1 check (id = 1),
  questions_per_attempt integer not null default 30 check (questions_per_attempt between 5 and 40),
  duration_minutes integer not null default 35 check (duration_minutes between 5 and 240),
  pass_mark_percent numeric(5, 2) not null default 70 check (pass_mark_percent > 0 and pass_mark_percent <= 100),
  certificate_fee_kobo integer not null default 100000 check (certificate_fee_kobo >= 5000),
  currency text not null default 'NGN' check (currency = 'NGN'),
  submission_grace_seconds integer not null default 30 check (submission_grace_seconds between 0 and 300),
  retake_cooldown_minutes integer not null default 0 check (retake_cooldown_minutes between 0 and 10080),
  max_attempts_per_day integer not null default 3 check (max_attempts_per_day between 1 and 50),
  access_token_ttl_days integer not null default 30 check (access_token_ttl_days between 1 and 365),
  privacy_notice_version text not null default '2026-10-28',
  payments_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.assessment_config default values;

-- ---------------------------------------------------------------------------
-- Candidates and capability tokens (no accounts)
-- ---------------------------------------------------------------------------
create table public.assessment_candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 100),
  normalised_email text not null check (char_length(normalised_email) between 3 and 254 and normalised_email = lower(normalised_email) and position('@' in normalised_email) > 1),
  phone text check (phone is null or char_length(phone) between 7 and 20),
  consent_at timestamptz not null,
  privacy_notice_version text not null,
  -- Hash of the one-time recovery code shown to the candidate.
  recovery_code_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assessment_candidates_email_idx on public.assessment_candidates (normalised_email);
create index assessment_candidates_created_idx on public.assessment_candidates (created_at desc);

create table public.assessment_access_tokens (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.assessment_candidates (id) on delete cascade,
  -- Only the hash of the bearer token is stored.
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index assessment_access_tokens_candidate_idx on public.assessment_access_tokens (candidate_id);

-- ---------------------------------------------------------------------------
-- Attempts and responses
-- ---------------------------------------------------------------------------
create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.assessment_candidates (id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'passed', 'failed')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  timed_out boolean not null default false,
  total_questions integer not null check (total_questions > 0),
  correct_answers integer check (correct_answers is null or correct_answers between 0 and total_questions),
  score_percentage numeric(5, 2) check (score_percentage is null or score_percentage between 0 and 100),
  pass_mark numeric(5, 2) not null,
  passed boolean,
  question_bank_version text not null,
  -- [{ "id": "Q07", "options": ["c","a","d","b"] }, ...] in the served order.
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  -- { "Q07": "a", ... } saved during the exam; used if time runs out.
  draft_answers jsonb not null default '{}'::jsonb check (jsonb_typeof(draft_answers) = 'object'),
  -- { "<category>": { "correct": n, "total": n }, ... }
  category_breakdown jsonb,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_attempts_state_chk check (
    (status = 'in_progress' and submitted_at is null and passed is null and correct_answers is null)
    or (status in ('passed', 'failed') and submitted_at is not null and passed = (status = 'passed') and correct_answers is not null and score_percentage is not null)
  )
);

-- At most one open attempt per candidate; also serialises concurrent starts.
create unique index assessment_attempts_one_open_idx on public.assessment_attempts (candidate_id) where status = 'in_progress';
create index assessment_attempts_candidate_idx on public.assessment_attempts (candidate_id, started_at desc);
create index assessment_attempts_started_idx on public.assessment_attempts (started_at desc);
create index assessment_attempts_status_idx on public.assessment_attempts (status);

create table public.assessment_responses (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  question_id text not null check (char_length(question_id) between 1 and 16),
  selected_option text check (selected_option is null or selected_option in ('a', 'b', 'c', 'd')),
  is_correct boolean not null,
  submitted_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- ---------------------------------------------------------------------------
-- Payments and certificates
-- ---------------------------------------------------------------------------
create table public.certificate_payments (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.assessment_candidates (id) on delete restrict,
  attempt_id uuid not null references public.assessment_attempts (id) on delete restrict,
  reference text not null unique check (reference ~ '^[A-Za-z0-9.=-]{8,100}$'),
  amount_kobo integer not null check (amount_kobo > 0),
  currency text not null check (currency = 'NGN'),
  status text not null default 'initialized' check (status in ('initialized', 'success', 'failed', 'abandoned', 'duplicate_success')),
  authorization_url text,
  paystack_transaction_id bigint unique,
  channel text,
  gateway_response text,
  paid_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One successful payment and one open checkout per attempt.
create unique index certificate_payments_one_success_idx on public.certificate_payments (attempt_id) where status = 'success';
create unique index certificate_payments_one_open_idx on public.certificate_payments (attempt_id) where status = 'initialized';
create index certificate_payments_candidate_idx on public.certificate_payments (candidate_id);
create index certificate_payments_created_idx on public.certificate_payments (created_at desc);

create table public.issued_certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text not null unique check (certificate_number ~ '^10X-CSP-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$'),
  candidate_id uuid not null references public.assessment_candidates (id) on delete restrict,
  -- One certificate per passing attempt, ever (revoked ones stay on record).
  attempt_id uuid not null unique references public.assessment_attempts (id) on delete restrict,
  payment_id uuid not null unique references public.certificate_payments (id) on delete restrict,
  certificate_title text not null,
  recipient_name text not null,
  score_percentage numeric(5, 2) not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revocation_reason text check (revocation_reason is null or char_length(revocation_reason) <= 500),
  constraint issued_certificates_revocation_chk check ((revoked_at is null) = (revocation_reason is null))
);

create index issued_certificates_issued_idx on public.issued_certificates (issued_at desc);

-- ---------------------------------------------------------------------------
-- Audit, webhooks, rate limits, admins
-- ---------------------------------------------------------------------------
create table public.security_audit_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  actor text not null default 'system',
  candidate_id uuid references public.assessment_candidates (id) on delete set null,
  attempt_id uuid references public.assessment_attempts (id) on delete set null,
  payment_id uuid references public.certificate_payments (id) on delete set null,
  certificate_id uuid references public.issued_certificates (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index security_audit_events_created_idx on public.security_audit_events (created_at desc);
create index security_audit_events_type_idx on public.security_audit_events (event_type, created_at desc);

create table public.paystack_webhook_events (
  id bigint generated always as identity primary key,
  body_hash text not null unique,
  event_type text not null,
  reference text,
  outcome text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.rate_limit_buckets (
  bucket_key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket_key, window_start)
);

create table public.admin_users (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

insert into public.admin_users (email) values ('10xpromotionscompany@gmail.com');

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------
create or replace function public.csp_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger assessment_candidates_touch before update on public.assessment_candidates
  for each row execute function public.csp_touch_updated_at();
create trigger assessment_attempts_touch before update on public.assessment_attempts
  for each row execute function public.csp_touch_updated_at();
create trigger certificate_payments_touch before update on public.certificate_payments
  for each row execute function public.csp_touch_updated_at();
create trigger assessment_config_touch before update on public.assessment_config
  for each row execute function public.csp_touch_updated_at();

-- A marked attempt can never be re-marked or reopened.
create or replace function public.csp_lock_marked_attempt() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'in_progress' then
    raise exception 'attempt % is already marked and cannot be changed', old.id using errcode = 'P0001';
  end if;
  if new.questions is distinct from old.questions or new.expires_at is distinct from old.expires_at
     or new.started_at is distinct from old.started_at or new.candidate_id is distinct from old.candidate_id then
    raise exception 'attempt % questions and timing are frozen', old.id using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger assessment_attempts_lock before update on public.assessment_attempts
  for each row execute function public.csp_lock_marked_attempt();

create or replace function public.csp_immutable_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% rows are immutable', tg_table_name using errcode = 'P0001';
end $$;

create trigger assessment_responses_immutable before update on public.assessment_responses
  for each row execute function public.csp_immutable_row();

-- Certificates: only revocation fields may change, and only once.
create or replace function public.csp_guard_certificate() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.certificate_number is distinct from old.certificate_number or new.candidate_id is distinct from old.candidate_id
     or new.attempt_id is distinct from old.attempt_id or new.payment_id is distinct from old.payment_id
     or new.recipient_name is distinct from old.recipient_name or new.certificate_title is distinct from old.certificate_title
     or new.score_percentage is distinct from old.score_percentage or new.issued_at is distinct from old.issued_at then
    raise exception 'issued certificates are immutable except for revocation' using errcode = 'P0001';
  end if;
  if old.revoked_at is not null then
    raise exception 'certificate already revoked' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger issued_certificates_guard before update on public.issued_certificates
  for each row execute function public.csp_guard_certificate();

-- ---------------------------------------------------------------------------
-- Server-only functions
-- ---------------------------------------------------------------------------

-- Fixed-window rate limiter. Returns true when the hit is allowed.
create or replace function public.csp_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql set search_path = '' as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limit_buckets as b (bucket_key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (bucket_key, window_start) do update set hits = b.hits + 1
  returning hits into v_hits;

  -- Occasional cleanup of stale windows.
  if random() < 0.01 then
    delete from public.rate_limit_buckets where window_start < now() - interval '2 days';
  end if;

  return v_hits <= p_limit;
end $$;

-- Marks an attempt exactly once. Responses and marks are written in the same
-- transaction; a second (concurrent or repeated) call changes nothing.
create or replace function public.csp_finalize_attempt(
  p_attempt_id uuid,
  p_responses jsonb,
  p_correct integer,
  p_timed_out boolean,
  p_breakdown jsonb,
  p_actor text
) returns table (attempt_status text, finalized boolean)
language plpgsql set search_path = '' as $$
declare
  v_attempt public.assessment_attempts;
  v_passed boolean;
begin
  select * into v_attempt from public.assessment_attempts where id = p_attempt_id for update;
  if not found then
    raise exception 'attempt not found' using errcode = 'P0002';
  end if;

  if v_attempt.status <> 'in_progress' then
    return query select v_attempt.status, false;
    return;
  end if;

  if p_correct < 0 or p_correct > v_attempt.total_questions then
    raise exception 'invalid score' using errcode = 'P0001';
  end if;

  v_passed := p_correct * 100 >= v_attempt.pass_mark * v_attempt.total_questions;

  insert into public.assessment_responses (attempt_id, question_id, selected_option, is_correct)
  select p_attempt_id, r ->> 'question_id', nullif(r ->> 'selected_option', ''), (r ->> 'is_correct')::boolean
  from jsonb_array_elements(p_responses) as r;

  update public.assessment_attempts set
    status = case when v_passed then 'passed' else 'failed' end,
    submitted_at = now(),
    timed_out = p_timed_out,
    correct_answers = p_correct,
    score_percentage = round(p_correct * 100.0 / v_attempt.total_questions, 2),
    passed = v_passed,
    category_breakdown = p_breakdown
  where id = p_attempt_id;

  insert into public.security_audit_events (event_type, actor, candidate_id, attempt_id, details)
  values ('attempt.marked', p_actor, v_attempt.candidate_id, p_attempt_id,
          jsonb_build_object('correct', p_correct, 'total', v_attempt.total_questions, 'passed', v_passed, 'timed_out', p_timed_out));

  return query select case when v_passed then 'passed' else 'failed' end, true;
end $$;

-- Records an independently verified Paystack payment and issues the
-- certificate atomically and idempotently. All payments for an attempt are
-- serialised by locking the attempt row.
create or replace function public.csp_record_payment_and_issue(
  p_payment_id uuid,
  p_transaction_id bigint,
  p_amount_kobo integer,
  p_currency text,
  p_paid_at timestamptz,
  p_channel text,
  p_gateway_response text,
  p_certificate_number text,
  p_certificate_title text,
  p_actor text
) returns table (outcome text, certificate_id uuid, certificate_number text)
language plpgsql set search_path = '' as $$
declare
  v_payment public.certificate_payments;
  v_attempt public.assessment_attempts;
  v_candidate public.assessment_candidates;
  v_cert public.issued_certificates;
begin
  select * into v_payment from public.certificate_payments where id = p_payment_id;
  if not found then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;

  select * into v_attempt from public.assessment_attempts where id = v_payment.attempt_id for update;
  select * into v_payment from public.certificate_payments where id = p_payment_id for update;

  if p_amount_kobo <> v_payment.amount_kobo or p_currency <> v_payment.currency then
    insert into public.security_audit_events (event_type, actor, candidate_id, attempt_id, payment_id, details)
    values ('payment.mismatch', p_actor, v_payment.candidate_id, v_payment.attempt_id, p_payment_id,
            jsonb_build_object('expected_amount', v_payment.amount_kobo, 'amount', p_amount_kobo, 'expected_currency', v_payment.currency, 'currency', p_currency));
    return query select 'amount_mismatch'::text, null::uuid, null::text;
    return;
  end if;

  if v_attempt.status <> 'passed' or v_attempt.candidate_id <> v_payment.candidate_id then
    return query select 'not_eligible'::text, null::uuid, null::text;
    return;
  end if;

  -- Already processed (duplicate callback/webhook): return the certificate.
  if v_payment.status in ('success', 'duplicate_success') then
    select * into v_cert from public.issued_certificates where attempt_id = v_attempt.id;
    return query select 'already_recorded'::text, v_cert.id, v_cert.certificate_number;
    return;
  end if;

  -- A different payment for this attempt already succeeded: keep this one on
  -- record for refund follow-up, do not issue a second certificate.
  if exists (select 1 from public.certificate_payments where attempt_id = v_attempt.id and status = 'success') then
    update public.certificate_payments set status = 'duplicate_success', paystack_transaction_id = p_transaction_id,
      paid_at = p_paid_at, verified_at = now(), channel = p_channel, gateway_response = p_gateway_response
    where id = p_payment_id;
    insert into public.security_audit_events (event_type, actor, candidate_id, attempt_id, payment_id, details)
    values ('payment.duplicate_success', p_actor, v_payment.candidate_id, v_attempt.id, p_payment_id, '{"action":"review_for_refund"}'::jsonb);
    select * into v_cert from public.issued_certificates where attempt_id = v_attempt.id;
    return query select 'duplicate_payment'::text, v_cert.id, v_cert.certificate_number;
    return;
  end if;

  update public.certificate_payments set status = 'success', paystack_transaction_id = p_transaction_id,
    paid_at = p_paid_at, verified_at = now(), channel = p_channel, gateway_response = p_gateway_response
  where id = p_payment_id;

  select * into v_candidate from public.assessment_candidates where id = v_attempt.candidate_id;

  insert into public.issued_certificates (certificate_number, candidate_id, attempt_id, payment_id, certificate_title, recipient_name, score_percentage)
  values (p_certificate_number, v_attempt.candidate_id, v_attempt.id, p_payment_id, p_certificate_title, v_candidate.full_name, v_attempt.score_percentage)
  returning * into v_cert;

  insert into public.security_audit_events (event_type, actor, candidate_id, attempt_id, payment_id, certificate_id, details)
  values ('payment.verified', p_actor, v_attempt.candidate_id, v_attempt.id, p_payment_id, null, jsonb_build_object('amount_kobo', p_amount_kobo, 'channel', p_channel)),
         ('certificate.issued', p_actor, v_attempt.candidate_id, v_attempt.id, p_payment_id, v_cert.id, jsonb_build_object('certificate_number', v_cert.certificate_number));

  return query select 'issued'::text, v_cert.id, v_cert.certificate_number;
end $$;

-- Aggregate figures for the admin dashboard (gross amounts, not profit).
create or replace function public.csp_admin_summary()
returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'candidates', (select count(*) from public.assessment_candidates),
    'attempts', (select count(*) from public.assessment_attempts),
    'attempts_in_progress', (select count(*) from public.assessment_attempts where status = 'in_progress'),
    'attempts_passed', (select count(*) from public.assessment_attempts where status = 'passed'),
    'attempts_failed', (select count(*) from public.assessment_attempts where status = 'failed'),
    'payments_success', (select count(*) from public.certificate_payments where status = 'success'),
    'payments_duplicate', (select count(*) from public.certificate_payments where status = 'duplicate_success'),
    'payments_pending', (select count(*) from public.certificate_payments where status = 'initialized'),
    'payments_failed', (select count(*) from public.certificate_payments where status in ('failed', 'abandoned')),
    'gross_success_kobo', (select coalesce(sum(amount_kobo), 0) from public.certificate_payments where status = 'success'),
    'certificates_issued', (select count(*) from public.issued_certificates),
    'certificates_revoked', (select count(*) from public.issued_certificates where revoked_at is not null)
  );
$$;

-- ---------------------------------------------------------------------------
-- Lock everything down to the server role
-- ---------------------------------------------------------------------------
alter table public.assessment_config enable row level security;
alter table public.assessment_candidates enable row level security;
alter table public.assessment_access_tokens enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_responses enable row level security;
alter table public.certificate_payments enable row level security;
alter table public.issued_certificates enable row level security;
alter table public.security_audit_events enable row level security;
alter table public.paystack_webhook_events enable row level security;
alter table public.rate_limit_buckets enable row level security;
alter table public.admin_users enable row level security;

revoke all on table
  public.assessment_config, public.assessment_candidates, public.assessment_access_tokens,
  public.assessment_attempts, public.assessment_responses, public.certificate_payments,
  public.issued_certificates, public.security_audit_events, public.paystack_webhook_events,
  public.rate_limit_buckets, public.admin_users
from anon, authenticated;

revoke all on sequence
  public.assessment_responses_id_seq, public.security_audit_events_id_seq, public.paystack_webhook_events_id_seq
from anon, authenticated;

revoke execute on function
  public.csp_rate_limit(text, integer, integer),
  public.csp_finalize_attempt(uuid, jsonb, integer, boolean, jsonb, text),
  public.csp_record_payment_and_issue(uuid, bigint, integer, text, timestamptz, text, text, text, text, text),
  public.csp_admin_summary(),
  public.csp_touch_updated_at(), public.csp_lock_marked_attempt(), public.csp_immutable_row(), public.csp_guard_certificate()
from public, anon, authenticated;

grant execute on function
  public.csp_rate_limit(text, integer, integer),
  public.csp_finalize_attempt(uuid, jsonb, integer, boolean, jsonb, text),
  public.csp_record_payment_and_issue(uuid, bigint, integer, text, timestamptz, text, text, text, text, text),
  public.csp_admin_summary()
to service_role;
