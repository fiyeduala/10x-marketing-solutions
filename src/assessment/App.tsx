import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Shell } from './Shell';
import { BASE, Link, paths, useLocation } from './router';
import { Landing } from './pages/Landing';
import { Register } from './pages/Register';
import { Recover } from './pages/Recover';
import { Dashboard } from './pages/Dashboard';
import { Exam } from './pages/Exam';
import { Result } from './pages/Result';
import { PaymentCallback } from './pages/PaymentCallback';
import { Verify } from './pages/Verify';
import { Privacy, Terms } from './pages/Legal';
import { Loading } from './ui';

const Handbook = lazy(() => import('./pages/Handbook'));
const Admin = lazy(() => import('./pages/Admin'));

interface Route {
  title: string;
  render: (params: string[]) => ReactNode;
  bare?: boolean;
}

const routes: [RegExp, Route][] = [
  [/^$/, { title: 'Overview', render: () => <Landing /> }],
  [/^\/register$/, { title: 'Register', render: () => <Register /> }],
  [/^\/recover$/, { title: 'Restore access', render: () => <Recover /> }],
  [/^\/my-assessment$/, { title: 'My assessment', render: () => <Dashboard /> }],
  [/^\/attempt\/([0-9a-f-]{36})$/i, { title: 'Assessment in progress', render: ([id]) => <Exam id={id} />, bare: true }],
  [/^\/result\/([0-9a-f-]{36})$/i, { title: 'Your result', render: ([id]) => <Result id={id} /> }],
  [/^\/payment-callback$/, { title: 'Confirming payment', render: () => <PaymentCallback /> }],
  [/^\/handbook$/, { title: 'Study handbook', render: () => <Handbook /> }],
  [/^\/privacy$/, { title: 'Privacy notice', render: () => <Privacy /> }],
  [/^\/terms$/, { title: 'Assessment terms', render: () => <Terms /> }],
  [/^\/admin$/, { title: 'Administration', render: () => <Admin /> }],
];

function match(pathname: string): { route: Route; params: string[] } | null {
  const verify = /^\/verify-certificate(?:\/([^/]*))?\/?$/.exec(pathname);
  if (verify) {
    return { route: { title: 'Verify a certificate', render: ([n]) => <Verify number={n ?? ''} /> }, params: [decodeURIComponent(verify[1] ?? '')] };
  }
  if (!pathname.startsWith(BASE)) return null;
  const rest = pathname.slice(BASE.length).replace(/\/+$/, '');
  for (const [re, route] of routes) {
    const m = re.exec(rest);
    if (m) return { route, params: m.slice(1) };
  }
  return null;
}

export function App() {
  const location = useLocation();
  const found = match(location.pathname);
  const title = found?.route.title ?? 'Page not found';

  useEffect(() => {
    document.title = `${title} · 10X Customer Support Professional Assessment`;
    // Move focus to the page heading for screen-reader users after navigation.
    const h1 = document.querySelector<HTMLElement>('main h1');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      h1.focus({ preventScroll: true });
    }
  }, [location.pathname, title]);

  return (
    <Shell bare={found?.route.bare}>
      <Suspense fallback={<Loading />}>
        {found ? (
          found.route.render(found.params)
        ) : (
          <div className="p-wrap p-narrow p-stack">
            <h1 className="p-h1">Page not found</h1>
            <p className="p-lead">That page does not exist in the assessment portal.</p>
            <p>
              <Link className="p-btn" href={paths.home}>
                Go to the assessment overview
              </Link>
            </p>
          </div>
        )}
      </Suspense>
    </Shell>
  );
}
