import { CATEGORIES, getQuestion, type OptionKey } from './questionBank.js';
import type { ServedQuestion } from './selection.js';

export interface MarkedResponse {
  question_id: string;
  selected_option: OptionKey | null;
  is_correct: boolean;
}

export type Breakdown = Record<string, { label: string; correct: number; total: number }>;

export interface MarkResult {
  responses: MarkedResponse[];
  correct: number;
  total: number;
  breakdown: Breakdown;
}

const VALID = new Set(['a', 'b', 'c', 'd']);

/**
 * Keeps only answers to questions in this attempt with a valid option key.
 * Anything else the client sends is ignored.
 */
export function sanitiseAnswers(served: ServedQuestion[], input: unknown): Record<string, OptionKey> {
  const out: Record<string, OptionKey> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  const allowed = new Set(served.map((s) => s.id));
  for (const [id, value] of Object.entries(input as Record<string, unknown>)) {
    if (allowed.has(id) && typeof value === 'string' && VALID.has(value)) out[id] = value as OptionKey;
  }
  return out;
}

/** Marks against the server-side key. Unanswered questions count as incorrect. */
export function markAttempt(served: ServedQuestion[], answers: Record<string, OptionKey>): MarkResult {
  const breakdown: Breakdown = {};
  const responses: MarkedResponse[] = [];
  let correct = 0;
  for (const s of served) {
    const q = getQuestion(s.id);
    if (!q) throw new Error(`Unknown question ${s.id}`);
    const selected = answers[s.id] ?? null;
    const isCorrect = selected === q.correct;
    if (isCorrect) correct += 1;
    responses.push({ question_id: q.id, selected_option: selected, is_correct: isCorrect });
    breakdown[q.category] ??= { label: CATEGORIES[q.category].label, correct: 0, total: 0 };
    breakdown[q.category].total += 1;
    if (isCorrect) breakdown[q.category].correct += 1;
  }
  return { responses, correct, total: served.length, breakdown };
}
