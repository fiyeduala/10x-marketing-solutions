export function naira(kobo: number): string {
  const amount = kobo / 100;
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' });
}

export function dateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });
}

export function percent(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, '')}%`;
}

export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export const CONTACT_EMAIL = '10xpromotionscompany@gmail.com';
