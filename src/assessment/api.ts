/**
 * Browser client for /api/v1. The candidate's access token is a random
 * capability stored in this browser only; the server keeps just its hash.
 */

const TOKEN_KEY = 'csp.token';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const session = {
  get: (): string | null => {
    try {
      return storage()?.getItem(TOKEN_KEY) ?? null;
    } catch {
      return null;
    }
  },
  set: (token: string) => {
    try {
      storage()?.setItem(TOKEN_KEY, token);
    } catch {
      /* private mode: the session lasts for this tab only */
    }
    memoryToken = token;
  },
  clear: () => {
    try {
      storage()?.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    memoryToken = null;
  },
};
let memoryToken: string | null = null;
const currentToken = () => session.get() ?? memoryToken;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

interface Options {
  method?: string;
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
  keepalive?: boolean;
}

async function send(path: string, opts: Options): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = opts.token === undefined ? currentToken() : opts.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`/api/v1/${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
      keepalive: opts.keepalive,
      cache: 'no-store',
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'network', 'We could not reach the server. Check your connection and try again.');
  }
  if (!res.ok) {
    let body: { error?: { code?: string; message?: string } & Record<string, unknown> } = {};
    try {
      body = await res.json();
    } catch {
      /* not JSON */
    }
    const { code = 'error', message = 'Something went wrong. Please try again.', ...extra } = body.error ?? {};
    if (res.status === 401 && token && token === currentToken() && code === 'unauthorised') session.clear();
    throw new ApiError(res.status, code, message, extra);
  }
  return res;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  return (await send(path, opts)).json() as Promise<T>;
}

/** Downloads a file that needs the Authorization header (so a plain link cannot be used). */
export async function download(path: string, filename: string, token?: string | null): Promise<void> {
  const res = await send(path, { token });
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// ----- Response types (mirroring server/routes) -----

export interface PublicConfig {
  questionsPerAttempt: number;
  durationMinutes: number;
  passMarkPercent: number;
  requiredCorrect: number;
  certificateFeeKobo: number;
  currency: string;
  maxAttemptsPerDay: number;
  retakeCooldownMinutes: number;
  privacyNoticeVersion: string;
  paymentsAvailable: boolean;
}

export interface Candidate {
  fullName: string;
  email: string;
  phone: string | null;
}

export interface AttemptSummary {
  id: string;
  status: 'in_progress' | 'passed' | 'failed';
  startedAt: string;
  submittedAt: string | null;
  scorePercentage: number | null;
  correctAnswers: number | null;
  totalQuestions: number;
  certificateNumber: string | null;
}

export interface Me {
  candidate: Candidate;
  activeAttemptId: string | null;
  canStart: boolean;
  blockedReason: 'in_progress' | 'already_passed' | 'daily_limit' | 'cooldown' | null;
  nextAttemptAt: string | null;
  attempts: AttemptSummary[];
}

export type OptionKey = 'a' | 'b' | 'c' | 'd';

export interface ExamQuestion {
  id: string;
  number: number;
  category: string;
  prompt: string;
  options: { key: OptionKey; text: string }[];
}

export interface ExamAttempt {
  id: string;
  status: 'in_progress';
  startedAt: string;
  expiresAt: string;
  serverNow: string;
  durationSeconds: number;
  totalQuestions: number;
  questions: ExamQuestion[];
  answers: Record<string, OptionKey>;
}

export interface AttemptResult {
  id: string;
  status: 'passed' | 'failed';
  startedAt: string;
  submittedAt: string | null;
  timedOut: boolean;
  totalQuestions: number;
  correctAnswers: number;
  scorePercentage: number;
  passMark: number;
  requiredCorrect: number;
  passed: boolean;
  breakdown: { key: string; label: string; correct: number; total: number; chapters: number[] }[];
  fee: { amountKobo: number; currency: string };
  payment: { status: string; reference: string } | null;
  certificate: { number: string; issuedAt: string; revoked: boolean } | null;
}

export type AttemptView = { attempt: ExamAttempt; result?: undefined } | { result: AttemptResult; attempt?: undefined };
