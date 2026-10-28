import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

/** Minimal History-API router for the assessment portal. */

const listeners = new Set<() => void>();

export function navigate(to: string, { replace = false } = {}) {
  if (replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  listeners.forEach((l) => l());
  window.scrollTo(0, 0);
}

export function useLocation(): URL {
  const [, force] = useState(0);
  useEffect(() => {
    const update = () => force((n) => n + 1);
    listeners.add(update);
    window.addEventListener('popstate', update);
    return () => {
      listeners.delete(update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  return new URL(window.location.href);
}

export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (rest.target || !href.startsWith('/') || href.startsWith('/api/') || /\.(pdf|csv)$/.test(href)) return;
    e.preventDefault();
    if (href.includes('#') && href.split('#')[0] === window.location.pathname) {
      history.pushState(null, '', href);
      document.getElementById(href.split('#')[1])?.scrollIntoView();
      return;
    }
    navigate(href);
  };
  return <a href={href} onClick={handle} {...rest} />;
}

export const BASE = '/customer-support-assessment';
export const paths = {
  home: BASE,
  register: `${BASE}/register`,
  recover: `${BASE}/recover`,
  dashboard: `${BASE}/my-assessment`,
  exam: (id: string) => `${BASE}/attempt/${id}`,
  result: (id: string) => `${BASE}/result/${id}`,
  paymentCallback: `${BASE}/payment-callback`,
  handbook: `${BASE}/handbook`,
  privacy: `${BASE}/privacy`,
  terms: `${BASE}/terms`,
  admin: `${BASE}/admin`,
  verify: (n = '') => `/verify-certificate/${n}`,
};
