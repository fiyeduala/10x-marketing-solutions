import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from './env.js';

/** Crockford base32 without I, L, O, U: easy to read aloud and type. */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function crockford(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += CROCKFORD[randomInt(32)];
  return out;
}

/** 256-bit bearer token for a candidate's browser. */
export function newAccessToken(): string {
  return randomBytes(32).toString('base64url');
}

/** 80-bit recovery code, e.g. 7KQ2-M9XD-4TBR-ZP0H. Shown once, stored hashed. */
export function newRecoveryCode(): string {
  return [crockford(4), crockford(4), crockford(4), crockford(4)].join('-');
}

/** Accepts lower case, spaces and the usual Crockford look-alikes. */
export function normaliseRecoveryCode(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  if (!/^[0-9A-HJKMNP-TV-Z]{16}$/.test(cleaned)) return null;
  return cleaned.match(/.{4}/g)!.join('-');
}

/** 60-bit certificate number: 10X-CSP-XXXX-XXXX-XXXX (not enumerable). */
export function newCertificateNumber(): string {
  return `10X-CSP-${crockford(4)}-${crockford(4)}-${crockford(4)}`;
}

export function normaliseCertificateNumber(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/\s/g, '').replace(/^10X-?CSP-?/, '').replace(/-/g, '');
  if (!/^[0-9A-HJKMNP-TV-Z]{12}$/.test(cleaned)) return null;
  return `10X-CSP-${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}`;
}

/** Unguessable Paystack reference (only -, ., = and alphanumerics allowed). */
export function newPaymentReference(): string {
  return `10xcsp-${randomBytes(12).toString('hex')}`;
}

/** Keyed hash for tokens, recovery codes and IPs. Raw values are never stored. */
export function keyedHash(purpose: string, value: string): string {
  return createHmac('sha256', env.appSecret()).update(`${purpose}:${value}`).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Uniform random integer in [0, max). Injected in tests. */
export type Rng = (max: number) => number;
export const secureRng: Rng = (max) => randomInt(max);

/** Fisher–Yates using an unbiased RNG. Returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng = secureRng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
