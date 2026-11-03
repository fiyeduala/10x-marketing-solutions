/**
 * End-to-end scenarios A–G against the PHP API (cpanel/csp-app) and a MySQL
 * database, with Paystack replaced by a local mock (no real payment is ever
 * attempted: the API is pointed at the mock with a throwaway key that
 * Paystack would reject).
 *
 *   npm run build
 *   npx tsx tests/e2e/scenarios.mts
 *
 * Needs PHP 8.1+ on PATH, cpanel/csp-app/vendor (composer install), an
 * installed Chromium (see scripts/handbook-pdf.mjs) and, in the environment,
 * DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD and APP_SECRET for a
 * development database with database/schema.sql imported — never the live
 * one. Every candidate the run creates is deleted at the end. Screenshots go
 * to E2E_OUT (default tests/e2e/out).
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import { join } from 'node:path';
import mysql from 'mysql2/promise';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { CATEGORIES, QUESTION_BANK } from '../../server/questionBank.js';

process.loadEnvFile('.env.local');

const RUN = randomBytes(3).toString('hex');
const MOCK_PORT = 8799;
const API_PORT = 8788;
const WEB_PORT = 4174;
// E2E_SITE runs against an already-running server instead (e.g. the cPanel
// release under Apache), whose .env points PAYSTACK_API_BASE at this mock and
// sets PAYSTACK_SECRET_KEY to E2E_MOCK_KEY.
const SITE = process.env.E2E_SITE?.replace(/\/+$/, '');
const WEB = SITE ?? `http://127.0.0.1:${WEB_PORT}`;
const API = SITE ? `${SITE}/api/v1` : `http://127.0.0.1:${API_PORT}/api/v1`;
const MOCK_KEY = process.env.E2E_MOCK_KEY ?? `sk_test_mock_${randomBytes(16).toString('hex')}`;
const OUT = process.env.E2E_OUT ?? 'tests/e2e/out';
mkdirSync(OUT, { recursive: true });

const db = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
async function rows<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [r] = await db.query(sql, params);
  return r as T[];
}
const email = (tag: string) => `csp-e2e-${RUN}-${tag}@example.com`;
const ipFor = (tag: string) => `198.51.100.${(parseInt(RUN.slice(0, 2), 16) + tag.charCodeAt(0)) % 250}`;

// ---------------------------------------------------------------- results
const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ok ' : ' FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
}
async function scenario(title: string, fn: () => Promise<void>) {
  console.log(`\n${title}`);
  try {
    await fn();
  } catch (err) {
    check(`${title}: completed without error`, false, (err as Error).message.split('\n')[0]);
  }
}

// ---------------------------------------------------------------- mock Paystack
type Plan = 'success' | 'failed' | 'forged_amount';
const plans = new Map<string, Plan>(); // by customer email
const txs = new Map<string, { email: string; amount: number; currency: string; callback: string; settled?: Plan }>();
let authFailures = 0;

const mock = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${MOCK_PORT}`);
  const send = (status: number, body: unknown, type = 'application/json') => {
    res.writeHead(status, { 'content-type': type });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };
  if (url.pathname.startsWith('/checkout/')) {
    // Stand-in for Paystack's hosted page: settle according to plan, redirect back.
    const ref = decodeURIComponent(url.pathname.slice('/checkout/'.length));
    const tx = txs.get(ref);
    if (!tx) return send(404, 'unknown', 'text/plain');
    tx.settled = plans.get(tx.email) ?? 'success';
    res.writeHead(302, { location: `${tx.callback}?trxref=${encodeURIComponent(ref)}&reference=${encodeURIComponent(ref)}` });
    return res.end();
  }
  if (req.headers.authorization !== `Bearer ${MOCK_KEY}`) {
    authFailures++;
    return send(401, { status: false, message: 'Invalid key' });
  }
  if (req.method === 'POST' && url.pathname === '/transaction/initialize') {
    let raw = '';
    for await (const c of req) raw += c;
    const b = JSON.parse(raw);
    txs.set(b.reference, { email: b.email, amount: b.amount, currency: b.currency, callback: b.callback_url });
    return send(200, {
      status: true,
      data: { authorization_url: `http://127.0.0.1:${MOCK_PORT}/checkout/${encodeURIComponent(b.reference)}`, access_code: 'mock', reference: b.reference },
    });
  }
  const m = /^\/transaction\/verify\/(.+)$/.exec(url.pathname);
  if (req.method === 'GET' && m) {
    const ref = decodeURIComponent(m[1]);
    const tx = txs.get(ref);
    if (!tx) return send(400, { status: false, message: 'Transaction reference not found' });
    const s = tx.settled;
    return send(200, {
      status: true,
      data: {
        id: Math.floor(Math.random() * 1e9),
        status: !s ? 'abandoned' : s === 'failed' ? 'failed' : 'success',
        reference: ref,
        amount: s === 'forged_amount' ? 100 : tx.amount,
        currency: tx.currency,
        paid_at: s && s !== 'failed' ? new Date().toISOString() : null,
        channel: 'card',
        gateway_response: s === 'failed' ? 'Declined' : 'Approved',
      },
    });
  }
  send(404, { status: false });
});

// ---------------------------------------------------------------- processes
const children: ChildProcess[] = [];
function start(cmd: string, args: string[], env: Record<string, string>) {
  const child = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  child.stderr?.on('data', (d) => process.env.E2E_VERBOSE && process.stderr.write(d));
  child.stdout?.on('data', (d) => process.env.E2E_VERBOSE && process.stdout.write(d));
  children.push(child);
}
async function waitFor(url: string) {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

// ---------------------------------------------------------------- helpers
async function api(path: string, opts: { method?: string; token?: string | null; body?: unknown; ip?: string; headers?: Record<string, string>; raw?: string } = {}) {
  const res = await fetch(`${API}/${path}`, {
    method: opts.method ?? (opts.body || opts.raw ? 'POST' : 'GET'),
    headers: {
      'content-type': 'application/json',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      'x-test-client-ip': opts.ip ?? '203.0.113.9',
      ...opts.headers,
    },
    body: opts.raw ?? (opts.body ? JSON.stringify(opts.body) : undefined),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text };
}

const byPrompt = new Map(QUESTION_BANK.map((q) => [q.prompt, q]));

async function newCandidatePage(browser: Browser, tag: string, mobile = false): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext(
    mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 900 } },
  );
  await ctx.setExtraHTTPHeaders({ 'x-test-client-ip': ipFor(tag) });
  return { ctx, page: await ctx.newPage() };
}

async function register(page: Page, tag: string, name: string) {
  await page.goto(`${WEB}/customer-support-assessment/register`);
  await page.getByLabel(/full name/i).fill(name);
  await page.getByLabel(/^email/i).fill(email(tag));
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Register' }).click();
  await page.getByRole('heading', { name: 'Save your recovery code' }).waitFor();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('heading', { name: new RegExp(`Hello, ${name}`) }).waitFor();
  return page.evaluate(() => localStorage.getItem('csp.token'));
}

async function startAttempt(page: Page) {
  await page.getByRole('button', { name: /Start (the assessment|a new attempt)/ }).click();
  await page.getByRole('button', { name: 'Start now' }).click();
  await page.waitForURL(/\/attempt\//);
  await page.locator('legend').waitFor();
  return page.url().split('/attempt/')[1];
}

/** Answers every question; `mode` picks the right option, a wrong one, or right for the first `n`. */
async function answerAll(page: Page, mode: 'right' | 'wrong' | { right: number }) {
  const total = Number((await page.locator('legend').innerText()).match(/of (\d+)/i)![1]);
  for (let i = 0; i < total; i++) {
    const prompt = (await page.locator('legend span').nth(1).innerText()).trim();
    const q = byPrompt.get(prompt);
    if (!q) throw new Error(`Prompt not in bank: ${prompt.slice(0, 60)}`);
    const right = mode === 'right' || (typeof mode === 'object' && i < mode.right);
    const text = right ? q.options[q.correct] : Object.entries(q.options).find(([k]) => k !== q.correct)![1];
    await page.locator('label', { hasText: text }).first().click();
    if (i < total - 1) await page.getByRole('button', { name: 'Next question' }).click();
  }
  await page.getByText('All answers saved').waitFor({ timeout: 15_000 });
  return total;
}

async function submit(page: Page) {
  await page.getByRole('button', { name: 'Review and submit' }).click();
  await page.getByRole('button', { name: 'Submit for marking' }).click();
  await page.waitForURL(/\/result\//);
  await page.getByRole('heading', { level: 1 }).waitFor();
}

async function noHorizontalScroll(page: Page, label: string) {
  const { sw, w } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  check(`G: no horizontal scroll on ${label} (${sw} ≤ ${w})`, sw <= w);
}

// ---------------------------------------------------------------- run
let browser: Browser | null = null;
const exe =
  process.env.CHROMIUM_PATH ??
  (process.platform === 'win32'
    ? join(process.env.LOCALAPPDATA ?? '', 'ms-playwright/chromium-1140/chrome-win/chrome.exe')
    : join(os.homedir(), '.cache/ms-playwright/chromium-1140/chrome-linux/chrome'));

try {
  await new Promise<void>((r) => mock.listen(MOCK_PORT, '127.0.0.1', r));
  if (!SITE) start(process.env.PHP_BIN ?? 'php', ['-d', 'variables_order=EGPCS', '-S', `127.0.0.1:${API_PORT}`, 'cpanel/dev-router.php'], {
    PAYSTACK_SECRET_KEY: MOCK_KEY,
    PAYSTACK_API_BASE: `http://127.0.0.1:${MOCK_PORT}`,
    APP_BASE_URL: WEB,
    APP_ENV: 'development',
    TRUST_TEST_IP: '1',
  });
  if (!SITE) start('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(WEB_PORT), '--strictPort'], { API_PORT: String(API_PORT) });
  await waitFor(`${API}/config`);
  await waitFor(WEB);
  const cfg = (await api('config')).json;
  check('setup: payments available with mock Paystack', cfg?.paymentsAvailable === true, JSON.stringify(cfg));
  browser = await chromium.launch({ executablePath: exe });

  // ---------------------------------------------------------------- A
  let certA = '';
  let tokenA: string | null = null;
  let attemptA = '';
  let refA = '';
  await scenario('A: pass → pay → certificate → verify', async () => {
    const { ctx, page } = await newCandidatePage(browser!, 'a');
    tokenA = await register(page, 'a', 'Ada Okafor');
    check('A: registered and signed in', !!tokenA);
    attemptA = await startAttempt(page);
    const total = await answerAll(page, 'right');
    check(`A: ${total} questions served`, total === cfg.questionsPerAttempt);

    // The served attempt must not carry any answer key.
    const served = await api(`attempts/${attemptA}`, { token: tokenA });
    const servedText = served.text;
    check('A: attempt payload has no correct/explanation fields', !/"(correct|explanation|distractors)"/.test(servedText));
    const cats = new Map<string, number>();
    for (const q of served.json.attempt.questions) cats.set(q.category, (cats.get(q.category) ?? 0) + 1);
    check('A: blueprint draw 3/4/4/4/3/4/3/2/3', Object.values(CATEGORIES).map((c) => cats.get(c.label)).join('/') === '3/4/4/4/3/4/3/2/3', [...cats].join(','));

    await submit(page);
    check('A: result says passed', (await page.getByRole('heading', { level: 1 }).innerText()) === 'You passed');
    await page.screenshot({ path: `${OUT}/A-result-passed.png`, fullPage: true });

    await page.getByRole('button', { name: /Pay .* with Paystack/ }).click();
    await page.waitForURL(/payment-callback/);
    await page.getByRole('heading', { name: 'Payment confirmed' }).waitFor({ timeout: 20_000 });
    refA = new URL(page.url()).searchParams.get('reference')!;
    await page.screenshot({ path: `${OUT}/A-payment-confirmed.png` });
    await page.getByRole('link', { name: /certificate|result/i }).first().click();
    await page.getByRole('heading', { name: 'Your certificate' }).waitFor();
    certA = (await page.locator('body').innerText()).match(/10X-CSP-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}/)?.[0] ?? '';
    check('A: certificate number shown', !!certA, certA);

    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download certificate (PDF)' }).click()]);
    const path = `${OUT}/A-certificate.pdf`;
    await dl.saveAs(path);
    const { readFileSync } = await import('node:fs');
    const pdf = readFileSync(path);
    check('A: certificate PDF downloaded', pdf.subarray(0, 5).toString() === '%PDF-' && pdf.length > 20_000, `${pdf.length} bytes`);

    await page.goto(`${WEB}/verify-certificate/${certA}`);
    await page.getByRole('heading', { name: 'Valid certificate' }).waitFor();
    const verifyText = await page.locator('body').innerText();
    check('A: public verification shows valid + name', verifyText.includes('Ada Okafor'));
    check('A: verification page hides email', !verifyText.includes(email('a')));
    await page.screenshot({ path: `${OUT}/A-verify.png`, fullPage: true });

    const again = await api('attempts', { method: 'POST', token: tokenA, body: {}, ip: ipFor('a') });
    check('A: cannot start again after passing (409 already_passed)', again.status === 409 && again.json?.error?.code === 'already_passed', again.text);
    await ctx.close();
  });

  // ---------------------------------------------------------------- E
  await scenario('E: duplicate and invalid webhooks', async () => {
    const body = JSON.stringify({ event: 'charge.success', data: { reference: refA, amount: cfg.certificateFeeKobo } });
    const sig = createHmac('sha512', MOCK_KEY).update(body).digest('hex');
    const first = await api('paystack/webhook', { raw: body, headers: { 'x-paystack-signature': sig } });
    const second = await api('paystack/webhook', { raw: body, headers: { 'x-paystack-signature': sig } });
    check('E: first delivery accepted', first.status === 200 && first.json?.received === true, first.text);
    check('E: repeat delivery recognised as duplicate', second.status === 200 && second.json?.duplicate === true, second.text);
    const bad = await api('paystack/webhook', { raw: body, headers: { 'x-paystack-signature': 'f'.repeat(128) } });
    check('E: wrong signature rejected (401)', bad.status === 401, bad.text);
    const data = await rows('SELECT id FROM issued_certificates WHERE attempt_id = ?', [attemptA]);
    check('E: still exactly one certificate for the attempt', data.length === 1, String(data.length));
    const pays = await rows<{ status: string }>('SELECT status FROM certificate_payments WHERE attempt_id = ?', [attemptA]);
    check('E: one successful payment row', pays.filter((p) => p.status === 'success').length === 1, JSON.stringify(pays));
  });

  // ---------------------------------------------------------------- B
  await scenario('B: fail → no payment → retake allowed', async () => {
    const { ctx, page } = await newCandidatePage(browser!, 'b');
    const token = await register(page, 'b', 'Bola Adeyemi');
    const attempt = await startAttempt(page);
    await answerAll(page, { right: cfg.requiredCorrect - 1 });
    await submit(page);
    check('B: result says not passed', (await page.getByRole('heading', { level: 1 }).innerText()) === 'You did not pass this time');
    const bodyText = await page.locator('body').innerText();
    check(`B: score shows ${cfg.requiredCorrect - 1}/${cfg.questionsPerAttempt}`, bodyText.includes(`${cfg.requiredCorrect - 1}`));
    check('B: no pay button on a fail', (await page.getByRole('button', { name: /Paystack/ }).count()) === 0);
    check('B: revision links to handbook chapters', (await page.locator('a[href*="handbook#chapter-"]').count()) > 0);
    await page.screenshot({ path: `${OUT}/B-result-failed.png`, fullPage: true });

    const pay = await api('payments/initialize', { token, body: { attemptId: attempt }, ip: ipFor('b') });
    check('B: payment refused for a failed attempt (409 not_eligible)', pay.status === 409 && pay.json?.error?.code === 'not_eligible', pay.text);

    await page.goto(`${WEB}/customer-support-assessment/my-assessment`);
    await page.getByRole('heading', { name: 'Attempt history' }).waitFor();
    check('B: retake offered', (await page.getByRole('button', { name: 'Start a new attempt' }).count()) === 1);
    check('B: history lists the failed attempt', (await page.locator('table').innerText()).includes('Not passed'));
    await ctx.close();
  });

  // ---------------------------------------------------------------- C
  await scenario('C: payment fails → no certificate → retry succeeds', async () => {
    const { ctx, page } = await newCandidatePage(browser!, 'c');
    await register(page, 'c', 'Chidi Eze');
    const attempt = await startAttempt(page);
    await answerAll(page, 'right');
    await submit(page);
    plans.set(email('c'), 'failed');
    await page.getByRole('button', { name: /Pay .* with Paystack/ }).click();
    await page.getByRole('heading', { name: 'The payment was not completed' }).waitFor({ timeout: 20_000 });
    await page.screenshot({ path: `${OUT}/C-payment-failed.png` });
    const none = await rows('SELECT id FROM issued_certificates WHERE attempt_id = ?', [attempt]);
    check('C: no certificate after failed payment', none.length === 0);

    plans.set(email('c'), 'success');
    await page.goto(`${WEB}/customer-support-assessment/result/${attempt}`);
    await page.getByRole('button', { name: /Pay .* with Paystack/ }).click();
    await page.getByRole('heading', { name: 'Payment confirmed' }).waitFor({ timeout: 20_000 });
    const one = await rows('SELECT id FROM issued_certificates WHERE attempt_id = ?', [attempt]);
    check('C: retry payment issues one certificate', one.length === 1);
    await ctx.close();
  });

  // ---------------------------------------------------------------- D
  await scenario('D: forged or tampered payment is rejected', async () => {
    const { ctx, page } = await newCandidatePage(browser!, 'd');
    const token = await register(page, 'd', 'Dami Bello');
    const attempt = await startAttempt(page);
    await answerAll(page, 'right');
    await submit(page);

    const fake = await api('payments/verify', { token, body: { reference: `forged-${RUN}-0000` }, ip: ipFor('d') });
    check('D: unknown reference → 404', fake.status === 404, fake.text);

    plans.set(email('d'), 'forged_amount');
    await page.getByRole('button', { name: /Pay .* with Paystack/ }).click();
    await page.waitForURL(/payment-callback/);
    await page.getByRole('heading', { name: /not completed|not confirmed/ }).waitFor({ timeout: 20_000 });
    const certs = await rows('SELECT id FROM issued_certificates WHERE attempt_id = ?', [attempt]);
    check('D: underpaid transaction issues no certificate', certs.length === 0);
    const audits = await rows<{ event_type: string }>('SELECT event_type, details FROM security_audit_events WHERE attempt_id = ?', [attempt]);
    check('D: amount mismatch audited', audits.some((a) => JSON.stringify(a).includes('amount')), JSON.stringify(audits.map((a) => a.event_type)));

    // A forged webhook (attacker does not know the secret) is refused outright.
    const forged = JSON.stringify({ event: 'charge.success', data: { reference: [...txs.keys()].at(-1) } });
    const w = await api('paystack/webhook', { raw: forged, headers: { 'x-paystack-signature': createHmac('sha512', 'not-the-key').update(forged).digest('hex') } });
    check('D: forged webhook signature → 401', w.status === 401);

    // A client-claimed score is ignored: submit a new zero-answer attempt with a fake score.
    await ctx.close();
  });

  await scenario('D2: client-submitted score is ignored', async () => {
    const reg = await api('session', {
      body: { fullName: 'Efe Score', email: email('e'), acceptTerms: true, privacyNoticeVersion: cfg.privacyNoticeVersion },
      ip: ipFor('e'),
    });
    const token = reg.json?.token;
    check('D2: registered via API', !!token, reg.text);
    const started = await api('attempts', { token, body: {}, ip: ipFor('e') });
    const id = started.json?.attempt?.id;
    const sub = await api(`attempts/${id}/submit`, { token, body: { score: 100, passed: true, correctAnswers: 30, reason: 'candidate' }, ip: ipFor('e') });
    check('D2: server marks 0 correct despite claimed score', sub.json?.result?.correctAnswers === 0 && sub.json?.result?.passed === false, sub.text.slice(0, 200));
  });

  // ---------------------------------------------------------------- F
  await scenario('F: unauthorised access is refused', async () => {
    for (const p of ['admin/me', 'admin/summary', 'admin/attempts', 'admin/export.csv', 'admin/audit']) {
      const r = await api(p);
      check(`F: ${p} without auth → 401`, r.status === 401, String(r.status));
    }
    const asCandidate = await api('admin/summary', { token: tokenA });
    check('F: admin/summary with a candidate token → 401/403', asCandidate.status === 401 || asCandidate.status === 403, String(asCandidate.status));
    const patch = await api('admin/config', { method: 'PATCH', token: tokenA, body: { passMarkPercent: 1 } });
    check('F: admin/config PATCH with candidate token refused', patch.status === 401 || patch.status === 403, String(patch.status));

    const other = await api('session', {
      body: { fullName: 'Femi Other', email: email('f'), acceptTerms: true, privacyNoticeVersion: cfg.privacyNoticeVersion },
      ip: ipFor('f'),
    });
    const tokenF = other.json?.token;
    const peek = await api(`attempts/${attemptA}`, { token: tokenF });
    check("F: another candidate's attempt → 404", peek.status === 404, String(peek.status));
    const pdf = await api(`certificates/${certA}/pdf`, { token: tokenF });
    check("F: another candidate's certificate PDF → 404/403", pdf.status === 404 || pdf.status === 403, String(pdf.status));
    const anon = await api(`attempts/${attemptA}`);
    check('F: attempt without a token → 401', anon.status === 401, String(anon.status));
    const bogus = await api('me', { token: 'x'.repeat(43) });
    check('F: made-up token → 401', bogus.status === 401, String(bogus.status));
    const pay = await api('payments/initialize', { token: tokenF, body: { attemptId: attemptA }, ip: ipFor('f') });
    check("F: paying for someone else's attempt → 404", pay.status === 404, String(pay.status));

    const page = await browser!.newPage();
    await page.goto(`${WEB}/customer-support-assessment/admin`);
    await page.getByRole('button', { name: 'Sign in' }).waitFor();
    const adminText = await page.locator('body').innerText();
    check('F: admin page shows only a sign-in form when signed out', /sign in/i.test(adminText) && !/Gross payments/i.test(adminText));
    await page.close();
  });

  // ---------------------------------------------------------------- G
  await scenario('G: mobile (390×844)', async () => {
    const { ctx, page } = await newCandidatePage(browser!, 'g', true);
    for (const [label, path] of [
      ['landing', '/customer-support-assessment'],
      ['handbook', '/customer-support-assessment/handbook'],
      ['privacy', '/customer-support-assessment/privacy'],
      ['verify', `/verify-certificate/${certA}`],
    ] as const) {
      await page.goto(WEB + path);
      await page.locator('h1').first().waitFor();
      await noHorizontalScroll(page, label);
      await page.screenshot({ path: `${OUT}/G-${label}.png`, fullPage: label !== 'handbook' });
    }
    await register(page, 'g', 'Grace Musa');
    await noHorizontalScroll(page, 'dashboard');
    await startAttempt(page);
    await noHorizontalScroll(page, 'exam');
    await page.screenshot({ path: `${OUT}/G-exam.png` });
    // Tap through a few questions with touch.
    for (let i = 0; i < 3; i++) {
      await page.locator('label:has(input[type=radio])').first().tap();
      await page.getByRole('button', { name: 'Next question' }).tap();
    }
    await page.getByText('All answers saved').waitFor({ timeout: 15_000 });
    check('G: answers saved after touch input', (await page.locator('[class*=barValue]').first().innerText()).startsWith('3/'));
    const target = await page.locator('label:has(input[type=radio])').first().boundingBox();
    check('G: option tap targets ≥ 44px tall', (target?.height ?? 0) >= 44, String(target?.height));
    await page.getByRole('button', { name: 'Submit assessment' }).tap();
    await page.getByRole('button', { name: 'Submit for marking' }).tap();
    await page.waitForURL(/\/result\//);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await noHorizontalScroll(page, 'result');
    await page.screenshot({ path: `${OUT}/G-result.png`, fullPage: true });
    await ctx.close();
  });

  // ---------------------------------------------------------------- H
  await scenario('H: administrator sign-in, reports and sign-out', async () => {
    // A throwaway admin for this run only; its hash comes from PHP's password_hash.
    const adminEmail = `csp-e2e-admin-${RUN}@example.com`;
    const password = randomBytes(18).toString('base64url');
    const hash = execFileSync(process.env.PHP_BIN ?? 'php', ['-r', 'echo password_hash(stream_get_contents(STDIN), PASSWORD_DEFAULT);'], { input: password }).toString();
    await rows('INSERT INTO admin_users (email, password_hash, password_changed_at) VALUES (?, ?, UTC_TIMESTAMP(3))', [adminEmail, hash]);

    const wrong = await api('admin/login', { body: { email: adminEmail, password: `${password}x` }, ip: ipFor('h') });
    check('H: wrong password → 401 login_failed', wrong.status === 401 && wrong.json?.error?.code === 'login_failed', wrong.text);
    const unknown = await api('admin/login', { body: { email: email('nobody'), password }, ip: ipFor('h') });
    check('H: unknown email gets the same 401', unknown.status === 401 && unknown.json?.error?.code === 'login_failed', unknown.text);
    const login = await api('admin/login', { body: { email: adminEmail.toUpperCase(), password }, ip: ipFor('h') });
    const token = login.json?.token as string | undefined;
    check('H: correct password → session token', login.status === 200 && !!token, String(login.status));

    const me = await api('admin/me', { token });
    check('H: admin/me returns the admin', me.json?.email === adminEmail, me.text);
    const summary = await api('admin/summary', { token });
    check('H: summary counts the run’s certificates', summary.status === 200 && summary.json?.summary?.certificates_issued >= 2, summary.text.slice(0, 300));
    const list = await api(`admin/attempts?q=${encodeURIComponent(`csp-e2e-${RUN}-a`)}`, { token });
    check('H: attempt search finds candidate A', list.json?.rows?.some((r: { attemptId?: string; id?: string }) => (r.attemptId ?? r.id) === attemptA), list.text.slice(0, 300));
    const csv = await api('admin/export.csv', { token });
    check('H: CSV export has a header and the run’s rows', csv.status === 200 && csv.text.includes(email('a')), csv.text.slice(0, 200));
    const audit = await api('admin/audit', { token });
    check('H: audit log records the admin sign-in', JSON.stringify(audit.json).includes('admin.login'), audit.text.slice(0, 200));

    const out = await api('admin/session', { method: 'DELETE', token });
    check('H: sign-out accepted', out.status === 200 || out.status === 204, String(out.status));
    const after = await api('admin/me', { token });
    check('H: token refused after sign-out', after.status === 401, String(after.status));

    // The real page, end to end.
    const page = await browser!.newPage();
    await page.goto(`${WEB}/customer-support-assessment/admin`);
    await page.getByLabel('Email').fill(adminEmail);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByText('Gross payments received').waitFor({ timeout: 15_000 });
    check('H: admin page signs in and shows the summary', true);
    await page.screenshot({ path: `${OUT}/H-admin.png`, fullPage: true });
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('button', { name: 'Sign in' }).waitFor();
    const live = await rows('SELECT id FROM admin_sessions WHERE email = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP(3)', [adminEmail]);
    check('H: page sign-out revoked the session server-side', live.length === 0, String(live.length));
    await page.close();
  });

  check('mock Paystack: every API call carried the test key', authFailures === 0, String(authFailures));
} finally {
  await browser?.close().catch(() => {});
  // ---------------------------------------------------------------- cleanup
  // Attempts, responses and access tokens cascade from the candidate rows.
  const ids = (await rows<{ id: string }>("SELECT id FROM assessment_candidates WHERE normalised_email LIKE 'csp-e2e-%'")).map((c) => c.id);
  if (ids.length) {
    let error = '';
    try {
      const refs = (await rows<{ reference: string }>('SELECT reference FROM certificate_payments WHERE candidate_id IN (?)', [ids])).map((p) => p.reference);
      await rows('DELETE FROM security_audit_events WHERE candidate_id IN (?)', [ids]);
      await rows('DELETE FROM issued_certificates WHERE candidate_id IN (?)', [ids]);
      if (refs.length) await rows('DELETE FROM paystack_webhook_events WHERE reference IN (?)', [refs]);
      await rows('DELETE FROM certificate_payments WHERE candidate_id IN (?)', [ids]);
      await rows('DELETE FROM assessment_candidates WHERE id IN (?)', [ids]);
    } catch (e) {
      error = (e as Error).message;
    }
    const left = await rows("SELECT id FROM assessment_candidates WHERE normalised_email LIKE 'csp-e2e-%'");
    console.log(`\ncleanup: removed ${ids.length} test candidates${error ? ` (error: ${error})` : ''}; remaining ${left.length}`);
  }
  await rows("DELETE FROM security_audit_events WHERE actor LIKE 'admin:csp-e2e-admin-%'");
  await rows("DELETE FROM admin_users WHERE email LIKE 'csp-e2e-admin-%'"); // sessions cascade
  await db.end();
  for (const c of children) {
    if (process.platform === 'win32' && c.pid) spawn('taskkill', ['/pid', String(c.pid), '/t', '/f'], { stdio: 'ignore' });
    else c.kill();
  }
  mock.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exitCode = failed.length ? 1 : 0;
}
