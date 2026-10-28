import { HttpError } from './http.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuid(value: unknown, what = 'id'): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new HttpError(404, 'not_found', `That ${what} was not found.`);
  return value.toLowerCase();
}

function invalid(field: string, message: string): never {
  throw new HttpError(422, 'invalid_input', message, { field });
}

/** NFC-normalised, single-spaced name: letters, marks, spaces, apostrophes, hyphens, full stops. */
export function fullName(value: unknown): string {
  if (typeof value !== 'string') invalid('fullName', 'Enter your full name.');
  const name = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (name.length < 2) invalid('fullName', 'Enter your full name.');
  if (name.length > 100) invalid('fullName', 'Your name must be 100 characters or fewer.');
  if (!/^\p{L}[\p{L}\p{M}'’.\- ]*$/u.test(name)) {
    invalid('fullName', 'Use letters only, with spaces, hyphens or apostrophes where needed.');
  }
  return name;
}

export function email(value: unknown): string {
  if (typeof value !== 'string') invalid('email', 'Enter your email address.');
  const e = value.trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) invalid('email', 'Enter a valid email address, like name@example.com.');
  return e;
}

export function optionalPhone(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') invalid('phone', 'Enter a valid phone number, or leave it blank.');
  const p = value.trim();
  if (!p) return null;
  if (!/^\+?[0-9 ()-]{7,20}$/.test(p) || p.replace(/\D/g, '').length < 7) {
    invalid('phone', 'Enter a valid phone number, or leave it blank.');
  }
  return p;
}

export function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) invalid(field, 'This field is required.');
  const t = value.trim();
  if (t.length > max) invalid(field, `Use ${max} characters or fewer.`);
  return t;
}
