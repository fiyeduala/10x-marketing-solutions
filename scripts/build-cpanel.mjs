/**
 * Builds the cPanel release:
 *
 *   cpanel-dist/
 *     public_html/   → upload into the account's public_html
 *     csp-app/       → upload beside it (NOT inside public_html)
 *   cpanel-dist/10x-cpanel-release.zip  (both folders)
 *
 *   node scripts/build-cpanel.mjs
 *
 * Needs Node, PHP 8.1+ and Composer on this machine. Never copies .env.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const OUT = 'cpanel-dist';
const PUB = join(OUT, 'public_html');
const APP = join(OUT, 'csp-app');
const PHP = process.env.PHP_BIN ?? 'php';
const win = process.platform === 'win32';
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', shell: win, ...opts });

rmSync(OUT, { recursive: true, force: true });

// 1. The website, with the API entry point and Apache rules.
run('npx', ['vite', 'build', '--outDir', PUB, '--emptyOutDir']);
cpSync('cpanel/public_html', PUB, { recursive: true });

// 2. The application, outside the web root.
mkdirSync(APP, { recursive: true });
for (const item of ['bootstrap.php', 'composer.json', 'composer.lock', '.env.example', 'src', 'data', 'assets', 'database', 'tools']) {
  cpSync(join('cpanel/csp-app', item), join(APP, item), { recursive: true });
}
run('composer', ['install', '--no-dev', '--no-interaction', '--optimize-autoloader', '--working-dir', APP]);
// TCPDF ships ~25 MB of fonts and examples we never use; the certificate fonts
// live in assets/fonts. Only the core Helvetica metrics (its default font) stay.
const TCPDF = join(APP, 'vendor/tecnickcom/tcpdf');
for (const dir of ['examples', 'tools']) rmSync(join(TCPDF, dir), { recursive: true, force: true });
for (const f of readdirSync(join(TCPDF, 'fonts'))) {
  if (!/^helvetica[a-z]*\.php$/.test(f)) rmSync(join(TCPDF, 'fonts', f), { recursive: true, force: true });
}

// 3. Safety checks: nothing secret or server-only under public_html.
const files = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));
const problems = files(PUB)
  .map((f) => relative(PUB, f).replaceAll('\\', '/'))
  .filter((f) => /(^|\/)\.env|questionBank|schema\.sql|\.map$|^csp-app\//.test(f));
if (existsSync(join(APP, '.env'))) problems.push('csp-app/.env was copied');
if (problems.length) {
  console.error(`Release check FAILED:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
run('npx', ['tsx', 'scripts/check-bundle-leaks.ts', PUB]);
for (const f of files(APP).filter((f) => f.endsWith('.php') && !f.includes(`${sep}vendor${sep}`))) {
  execFileSync(PHP, ['-l', f], { stdio: 'pipe' });
}

// 4. One zip with both folders (keeps .htaccess, which some zip tools skip).
run(PHP, ['scripts/zip-release.php', OUT, join(OUT, '10x-cpanel-release.zip'), 'public_html', 'csp-app']);
console.log(`\ncPanel release ready in ${OUT}/ (see cpanel/README.md for installation).`);
