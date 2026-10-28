import { shuffle, secureRng, type Rng } from './crypto.js';
import { CATEGORIES, OPTION_KEYS, QUESTION_BANK, getQuestion, type BankQuestion, type Category, type OptionKey } from './questionBank.js';

/** What an attempt stores: question ids and the option order shown. */
export interface ServedQuestion {
  id: string;
  options: OptionKey[];
}

/** What the browser receives. No answer, no explanation, no difficulty. */
export interface PublicQuestion {
  id: string;
  number: number;
  category: string;
  prompt: string;
  options: { key: OptionKey; text: string }[];
}

/**
 * Per-category counts for an attempt of `total` questions, proportional to
 * the bank blueprint (largest remainder, ties broken by category order).
 * For 30 of 40 this gives 3,4,4,4,3,4,3,2,3.
 */
export function categoryQuotas(total: number): Record<Category, number> {
  const cats = Object.keys(CATEGORIES) as Category[];
  const bankTotal = cats.reduce((n, c) => n + CATEGORIES[c].bankCount, 0);
  if (total > bankTotal) throw new Error(`Cannot select ${total} from a bank of ${bankTotal}`);
  const exact = cats.map((c) => (CATEGORIES[c].bankCount * total) / bankTotal);
  const quotas = exact.map(Math.floor);
  let remaining = total - quotas.reduce((a, b) => a + b, 0);
  const order = cats.map((_, i) => i).sort((a, b) => exact[b] - quotas[b] - (exact[a] - quotas[a]) || a - b);
  for (const i of order) {
    if (remaining === 0) break;
    quotas[i] += 1;
    remaining -= 1;
  }
  return Object.fromEntries(cats.map((c, i) => [c, quotas[i]])) as Record<Category, number>;
}

/** Fresh random selection, question order and option order for one attempt. */
export function selectQuestions(total: number, rng: Rng = secureRng): ServedQuestion[] {
  const quotas = categoryQuotas(total);
  const chosen: BankQuestion[] = [];
  for (const category of Object.keys(quotas) as Category[]) {
    const pool = QUESTION_BANK.filter((q) => q.category === category);
    chosen.push(...shuffle(pool, rng).slice(0, quotas[category]));
  }
  return shuffle(chosen, rng).map((q) => ({ id: q.id, options: shuffle(OPTION_KEYS, rng) }));
}

export function toPublicQuestions(served: ServedQuestion[]): PublicQuestion[] {
  return served.map((s, index) => {
    const q = getQuestion(s.id);
    if (!q) throw new Error(`Unknown question ${s.id}`);
    return {
      id: q.id,
      number: index + 1,
      category: CATEGORIES[q.category].label,
      prompt: q.prompt,
      options: s.options.map((key) => ({ key, text: q.options[key] })),
    };
  });
}
