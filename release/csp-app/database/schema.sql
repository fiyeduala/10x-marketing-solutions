-- 10X Customer Support Professional Assessment: MySQL / MariaDB schema for
-- cPanel hosting. Import once into an empty database with phpMyAdmin
-- (Import tab) or `mysql dbname < schema.sql`.
--
-- Requires MySQL 5.7.8+ or MariaDB 10.3+, InnoDB and utf8mb4.
--
-- Shared hosting usually forbids triggers and stored procedures, so this file
-- creates neither. The rules the Supabase version enforced with triggers
-- (a marked attempt is frozen, responses are immutable, a certificate can only
-- be revoked once) are enforced by the PHP API with transactions, row locks
-- and guarded UPDATEs. "One open attempt per candidate" and "one successful /
-- one open payment per attempt" are enforced here by unique indexes on
-- the open_key / success_key columns. The API sets them while a row is open
-- (or paid) and clears them to NULL otherwise; NULLs never collide. They are
-- plain columns, not generated ones, because some MariaDB versions reject
-- generated columns that compare text (error 1901).
--
-- All times are UTC. The API sets the session time zone to +00:00.
--
-- The question bank and answer key are NOT stored here; they live in a
-- server-only PHP file outside public_html (csp-app/data/questionBank.php).

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---------------------------------------------------------------------------
-- Configuration (single row, administrator-controlled)
-- ---------------------------------------------------------------------------
CREATE TABLE assessment_config (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  questions_per_attempt INT NOT NULL DEFAULT 30,
  duration_minutes INT NOT NULL DEFAULT 35,
  pass_mark_percent DECIMAL(5, 2) NOT NULL DEFAULT 70.00,
  certificate_fee_kobo INT NOT NULL DEFAULT 100000,
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  submission_grace_seconds INT NOT NULL DEFAULT 30,
  retake_cooldown_minutes INT NOT NULL DEFAULT 0,
  max_attempts_per_day INT NOT NULL DEFAULT 3,
  access_token_ttl_days INT NOT NULL DEFAULT 30,
  privacy_notice_version VARCHAR(32) NOT NULL DEFAULT '2026-10-28',
  payments_enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT assessment_config_single_chk CHECK (id = 1),
  CONSTRAINT assessment_config_questions_chk CHECK (questions_per_attempt BETWEEN 5 AND 40),
  CONSTRAINT assessment_config_duration_chk CHECK (duration_minutes BETWEEN 5 AND 240),
  CONSTRAINT assessment_config_pass_chk CHECK (pass_mark_percent > 0 AND pass_mark_percent <= 100),
  CONSTRAINT assessment_config_fee_chk CHECK (certificate_fee_kobo >= 5000),
  CONSTRAINT assessment_config_currency_chk CHECK (currency = 'NGN'),
  CONSTRAINT assessment_config_grace_chk CHECK (submission_grace_seconds BETWEEN 0 AND 300),
  CONSTRAINT assessment_config_cooldown_chk CHECK (retake_cooldown_minutes BETWEEN 0 AND 10080),
  CONSTRAINT assessment_config_daily_chk CHECK (max_attempts_per_day BETWEEN 1 AND 50),
  CONSTRAINT assessment_config_ttl_chk CHECK (access_token_ttl_days BETWEEN 1 AND 365)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT INTO assessment_config (id) VALUES (1);

-- ---------------------------------------------------------------------------
-- Candidates and capability tokens (no accounts)
-- ---------------------------------------------------------------------------
CREATE TABLE assessment_candidates (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  normalised_email VARCHAR(254) NOT NULL,
  phone VARCHAR(20) NULL,
  consent_at DATETIME(3) NOT NULL,
  privacy_notice_version VARCHAR(32) NOT NULL,
  -- Keyed hash of the one-time recovery code shown to the candidate.
  recovery_code_hash VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY assessment_candidates_recovery_uq (recovery_code_hash),
  KEY assessment_candidates_email_idx (normalised_email),
  KEY assessment_candidates_created_idx (created_at),
  CONSTRAINT assessment_candidates_name_chk CHECK (CHAR_LENGTH(full_name) BETWEEN 2 AND 100),
  CONSTRAINT assessment_candidates_email_chk CHECK (CHAR_LENGTH(normalised_email) BETWEEN 3 AND 254 AND LOCATE('@', normalised_email) > 1),
  CONSTRAINT assessment_candidates_phone_chk CHECK (phone IS NULL OR CHAR_LENGTH(phone) BETWEEN 7 AND 20)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE assessment_access_tokens (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  candidate_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  -- Only the keyed hash of the bearer token is stored.
  token_hash VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  last_used_at DATETIME(3) NULL,
  revoked_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY assessment_access_tokens_hash_uq (token_hash),
  KEY assessment_access_tokens_candidate_idx (candidate_id),
  CONSTRAINT assessment_access_tokens_candidate_fk FOREIGN KEY (candidate_id) REFERENCES assessment_candidates (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Attempts and responses
-- ---------------------------------------------------------------------------
CREATE TABLE assessment_attempts (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  candidate_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'in_progress',
  started_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  submitted_at DATETIME(3) NULL,
  timed_out TINYINT(1) NOT NULL DEFAULT 0,
  total_questions INT NOT NULL,
  correct_answers INT NULL,
  score_percentage DECIMAL(5, 2) NULL,
  pass_mark DECIMAL(5, 2) NOT NULL,
  passed TINYINT(1) NULL,
  question_bank_version VARCHAR(32) NOT NULL,
  -- [{ "id": "Q07", "options": ["c","a","d","b"] }, ...] in the served order.
  questions JSON NOT NULL,
  -- { "Q07": "a", ... } saved during the exam; used if time runs out.
  draft_answers JSON NOT NULL,
  -- { "<category>": { "label": "...", "correct": n, "total": n }, ... }
  category_breakdown JSON NULL,
  ip_hash VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  -- candidate_id while the attempt is open, NULL once marked (set by the API):
  -- at most one open attempt per candidate.
  open_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (id),
  UNIQUE KEY assessment_attempts_one_open_uq (open_key),
  KEY assessment_attempts_candidate_idx (candidate_id, started_at),
  KEY assessment_attempts_started_idx (started_at),
  KEY assessment_attempts_status_idx (status),
  CONSTRAINT assessment_attempts_candidate_fk FOREIGN KEY (candidate_id) REFERENCES assessment_candidates (id) ON DELETE CASCADE,
  CONSTRAINT assessment_attempts_total_chk CHECK (total_questions > 0),
  CONSTRAINT assessment_attempts_correct_chk CHECK (correct_answers IS NULL OR correct_answers BETWEEN 0 AND total_questions),
  CONSTRAINT assessment_attempts_score_chk CHECK (score_percentage IS NULL OR score_percentage BETWEEN 0 AND 100),
  CONSTRAINT assessment_attempts_state_chk CHECK (
    (status = 'in_progress' AND submitted_at IS NULL AND passed IS NULL AND correct_answers IS NULL)
    OR (status IN ('passed', 'failed') AND submitted_at IS NOT NULL AND passed = (status = 'passed')
        AND correct_answers IS NOT NULL AND score_percentage IS NOT NULL)
  )
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE assessment_responses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  attempt_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  question_id VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  selected_option CHAR(1) CHARACTER SET ascii COLLATE ascii_bin NULL,
  is_correct TINYINT(1) NOT NULL,
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY assessment_responses_attempt_question_uq (attempt_id, question_id),
  CONSTRAINT assessment_responses_attempt_fk FOREIGN KEY (attempt_id) REFERENCES assessment_attempts (id) ON DELETE CASCADE,
  CONSTRAINT assessment_responses_option_chk CHECK (selected_option IS NULL OR selected_option IN ('a', 'b', 'c', 'd'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Payments and certificates
-- ---------------------------------------------------------------------------
CREATE TABLE certificate_payments (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  candidate_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  attempt_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  reference VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  amount_kobo INT NOT NULL,
  currency CHAR(3) NOT NULL,
  status VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'initialized',
  authorization_url VARCHAR(500) NULL,
  paystack_transaction_id BIGINT NULL,
  channel VARCHAR(40) NULL,
  gateway_response VARCHAR(200) NULL,
  paid_at DATETIME(3) NULL,
  verified_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  -- One successful payment and one open checkout per attempt (set by the API):
  -- success_key = attempt_id once paid, open_key = attempt_id while
  -- initialized; NULL otherwise.
  success_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  open_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (id),
  UNIQUE KEY certificate_payments_reference_uq (reference),
  UNIQUE KEY certificate_payments_transaction_uq (paystack_transaction_id),
  UNIQUE KEY certificate_payments_one_success_uq (success_key),
  UNIQUE KEY certificate_payments_one_open_uq (open_key),
  KEY certificate_payments_attempt_idx (attempt_id, created_at),
  KEY certificate_payments_candidate_idx (candidate_id),
  KEY certificate_payments_created_idx (created_at),
  CONSTRAINT certificate_payments_candidate_fk FOREIGN KEY (candidate_id) REFERENCES assessment_candidates (id) ON DELETE RESTRICT,
  CONSTRAINT certificate_payments_attempt_fk FOREIGN KEY (attempt_id) REFERENCES assessment_attempts (id) ON DELETE RESTRICT,
  CONSTRAINT certificate_payments_amount_chk CHECK (amount_kobo > 0),
  CONSTRAINT certificate_payments_currency_chk CHECK (currency = 'NGN'),
  CONSTRAINT certificate_payments_status_chk CHECK (status IN ('initialized', 'success', 'failed', 'abandoned', 'duplicate_success'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE issued_certificates (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  certificate_number VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  candidate_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  -- One certificate per passing attempt, ever (revoked ones stay on record).
  attempt_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  payment_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  certificate_title VARCHAR(200) NOT NULL,
  recipient_name VARCHAR(100) NOT NULL,
  score_percentage DECIMAL(5, 2) NOT NULL,
  issued_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at DATETIME(3) NULL,
  revocation_reason VARCHAR(500) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY issued_certificates_number_uq (certificate_number),
  UNIQUE KEY issued_certificates_attempt_uq (attempt_id),
  UNIQUE KEY issued_certificates_payment_uq (payment_id),
  KEY issued_certificates_candidate_idx (candidate_id),
  KEY issued_certificates_issued_idx (issued_at),
  CONSTRAINT issued_certificates_candidate_fk FOREIGN KEY (candidate_id) REFERENCES assessment_candidates (id) ON DELETE RESTRICT,
  CONSTRAINT issued_certificates_attempt_fk FOREIGN KEY (attempt_id) REFERENCES assessment_attempts (id) ON DELETE RESTRICT,
  CONSTRAINT issued_certificates_payment_fk FOREIGN KEY (payment_id) REFERENCES certificate_payments (id) ON DELETE RESTRICT,
  CONSTRAINT issued_certificates_number_chk CHECK (certificate_number REGEXP '^10X-CSP-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$'),
  CONSTRAINT issued_certificates_revocation_chk CHECK ((revoked_at IS NULL) = (revocation_reason IS NULL))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Audit, webhooks, rate limits
-- ---------------------------------------------------------------------------
CREATE TABLE security_audit_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type VARCHAR(80) NOT NULL,
  actor VARCHAR(320) NOT NULL DEFAULT 'system',
  candidate_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  attempt_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  payment_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  certificate_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  details JSON NOT NULL,
  ip_hash VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY security_audit_events_created_idx (created_at),
  KEY security_audit_events_type_idx (event_type, created_at),
  CONSTRAINT security_audit_events_candidate_fk FOREIGN KEY (candidate_id) REFERENCES assessment_candidates (id) ON DELETE SET NULL,
  CONSTRAINT security_audit_events_attempt_fk FOREIGN KEY (attempt_id) REFERENCES assessment_attempts (id) ON DELETE SET NULL,
  CONSTRAINT security_audit_events_payment_fk FOREIGN KEY (payment_id) REFERENCES certificate_payments (id) ON DELETE SET NULL,
  CONSTRAINT security_audit_events_certificate_fk FOREIGN KEY (certificate_id) REFERENCES issued_certificates (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE paystack_webhook_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  body_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  reference VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL,
  outcome VARCHAR(40) NULL,
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  processed_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY paystack_webhook_events_body_uq (body_hash)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE rate_limit_buckets (
  bucket_key VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  window_start DATETIME NOT NULL,
  hits INT NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start),
  KEY rate_limit_buckets_window_idx (window_start)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Administrators
-- ---------------------------------------------------------------------------
-- An admin can sign in only once a password hash has been set with
-- csp-app/tools/admin-password.php. A NULL hash means "listed, cannot sign in".
CREATE TABLE admin_users (
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  password_changed_at DATETIME(3) NULL,
  PRIMARY KEY (email)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT INTO admin_users (email) VALUES ('10xpromotionscompany@gmail.com');

CREATE TABLE admin_sessions (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  email VARCHAR(254) NOT NULL,
  -- Only the keyed hash of the session token is stored.
  token_hash VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  ip_hash VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (id),
  UNIQUE KEY admin_sessions_hash_uq (token_hash),
  KEY admin_sessions_email_idx (email),
  CONSTRAINT admin_sessions_email_fk FOREIGN KEY (email) REFERENCES admin_users (email) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
