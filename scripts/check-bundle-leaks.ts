/**
 * Fails if any part of the answer key, or the question text, appears in the
 * built public files (dist/, or the folder given). Run after `vite build`:
 *   npx tsx scripts/check-bundle-leaks.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { QUESTION_BANK } from '../server/questionBank.js';

const DIST = process.argv[2] ?? 'dist';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

/** Compare on a normalised form so minifier quoting/escaping cannot hide a match. */
const norm = (s: string) => s.replace(/\\u2019|’/g, "'").replace(/\\u201[cd]|[“”]/g, '"').replace(/\s+/g, ' ').toLowerCase();

const needles: [string, string][] = [];
for (const q of QUESTION_BANK) {
  needles.push([`${q.id} prompt`, q.prompt]);
  needles.push([`${q.id} explanation`, q.explanation]);
  for (const [k, v] of Object.entries(q.options)) needles.push([`${q.id} option ${k}`, v]);
  for (const [k, v] of Object.entries(q.distractors)) needles.push([`${q.id} distractor ${k}`, v ?? '']);
}
// Short strings (e.g. "Ask for a refund") could collide with ordinary copy; the
// prompts and explanations are long, and options are checked from 30 chars up.
const checked = needles.filter(([, s]) => s.length >= 30).map(([label, s]) => [label, norm(s).slice(0, 80)] as const);

const STRUCTURAL = [/["']?correct["']?\s*:\s*["'][abcd]["']/, /QUESTION_BANK(?!_VERSION)/, /questionBank(?!Version)/, /SUPABASE_SECRET_KEY|PAYSTACK_SECRET_KEY|APP_SECRET/, /sk_(test|live)_[A-Za-z0-9]/];

const problems: string[] = [];
const all = files(DIST);
for (const f of all) {
  if (f.endsWith('.map')) problems.push(`source map published: ${f}`);
  if (!/(\.(js|css|html|json|txt|svg|xml|php)|\.htaccess)$/.test(f)) continue;
  const raw = readFileSync(f, 'utf8');
  const text = norm(raw);
  for (const [label, n] of checked) if (text.includes(n)) problems.push(`${f}: contains ${label}`);
  for (const re of STRUCTURAL) if (re.test(raw)) problems.push(`${f}: matches ${re}`);
}

if (problems.length) {
  console.error(`Bundle leak check FAILED (${problems.length}):\n` + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`Bundle leak check passed: ${all.length} files, ${checked.length} bank strings, no source maps.`);
