import { describe, expect, it } from 'vitest';
import { requiredCorrect } from '../../server/config.js';
import { newCertificateNumber, newRecoveryCode, normaliseCertificateNumber, normaliseRecoveryCode, shuffle } from '../../server/crypto.js';
import { apiPath } from '../../server/router.js';
import { CATEGORIES, OPTION_KEYS, QUESTION_BANK, type Category } from '../../server/questionBank.js';
import { markAttempt, sanitiseAnswers } from '../../server/scoring.js';
import { categoryQuotas, selectQuestions, toPublicQuestions } from '../../server/selection.js';
import * as v from '../../server/validate.js';

describe('question bank', () => {
  it('has 40 unique questions with complete content', () => {
    expect(QUESTION_BANK).toHaveLength(40);
    expect(new Set(QUESTION_BANK.map((q) => q.id)).size).toBe(40);
    for (const q of QUESTION_BANK) {
      expect(q.prompt.length).toBeGreaterThan(20);
      expect(q.explanation.length).toBeGreaterThan(40);
      for (const k of OPTION_KEYS) expect(q.options[k].trim().length).toBeGreaterThan(5);
      expect(new Set(Object.values(q.options)).size).toBe(4);
      for (const k of OPTION_KEYS.filter((k) => k !== q.correct)) expect(q.distractors[k]?.length ?? 0).toBeGreaterThan(10);
      expect(q.distractors[q.correct]).toBeUndefined();
    }
  });

  it('matches the category blueprint', () => {
    for (const [cat, meta] of Object.entries(CATEGORIES)) {
      expect(QUESTION_BANK.filter((q) => q.category === cat), cat).toHaveLength(meta.bankCount);
    }
  });

  it('follows the difficulty and scenario mix', () => {
    const count = (d: string) => QUESTION_BANK.filter((q) => q.difficulty === d).length;
    expect(count('foundational')).toBe(8); // 20%
    expect(count('intermediate')).toBe(20); // 50%
    expect(count('advanced')).toBe(12); // 30%
    expect(QUESTION_BANK.filter((q) => q.scenario).length).toBeGreaterThanOrEqual(20);
  });

  it('balances the correct-answer letters', () => {
    for (const k of OPTION_KEYS) expect(QUESTION_BANK.filter((q) => q.correct === k)).toHaveLength(10);
  });

  it('does not make the correct option guessable by length alone', () => {
    // "Noticeably longest": the key beats every distractor by 5+ characters.
    // Chance alone would make the key the longest option in about 10 of 40.
    const giveaways = QUESTION_BANK.filter((q) => {
      const others = OPTION_KEYS.filter((k) => k !== q.correct).map((k) => q.options[k].length);
      return q.options[q.correct].length - Math.max(...others) >= 5;
    }).map((q) => q.id);
    expect(giveaways, giveaways.join(', ')).toHaveLength(0);
  });
});

describe('selection', () => {
  it('allocates 30 questions as 3,4,4,4,3,4,3,2,3', () => {
    expect(Object.values(categoryQuotas(30))).toEqual([3, 4, 4, 4, 3, 4, 3, 2, 3]);
    for (const n of [5, 10, 20, 25, 30, 40]) {
      expect(Object.values(categoryQuotas(n)).reduce((a, b) => a + b, 0)).toBe(n);
    }
  });

  it('selects unique questions per the quotas, with shuffled options', () => {
    const quotas = categoryQuotas(30);
    for (let run = 0; run < 50; run++) {
      const served = selectQuestions(30);
      expect(new Set(served.map((s) => s.id)).size).toBe(30);
      const byCat: Record<string, number> = {};
      for (const s of served) {
        const q = QUESTION_BANK.find((b) => b.id === s.id)!;
        byCat[q.category] = (byCat[q.category] ?? 0) + 1;
        expect([...s.options].sort()).toEqual(['a', 'b', 'c', 'd']);
      }
      for (const cat of Object.keys(quotas) as Category[]) expect(byCat[cat]).toBe(quotas[cat]);
    }
  });

  it('varies selection and order between attempts', () => {
    const a = selectQuestions(30).map((s) => s.id).join();
    const b = selectQuestions(30).map((s) => s.id).join();
    const c = selectQuestions(30).map((s) => s.id).join();
    expect(new Set([a, b, c]).size).toBeGreaterThan(1);
  });

  it('never exposes the answer key in the public question shape', () => {
    const pub = toPublicQuestions(selectQuestions(30));
    const text = JSON.stringify(pub);
    expect(text).not.toMatch(/"(correct|explanation|distractors|difficulty|scenario)":/);
    for (const q of pub) expect(Object.keys(q).sort()).toEqual(['category', 'id', 'number', 'options', 'prompt']);
  });

  it('shuffle is a permutation', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(items).sort((x, y) => x - y)).toEqual(items);
  });
});

describe('scoring', () => {
  const served = selectQuestions(30);
  const key = Object.fromEntries(served.map((s) => [s.id, QUESTION_BANK.find((q) => q.id === s.id)!.correct]));
  const wrong = (k: string) => OPTION_KEYS.find((o) => o !== k)!;

  it('scores all correct, all wrong and unanswered', () => {
    expect(markAttempt(served, key as never).correct).toBe(30);
    expect(markAttempt(served, Object.fromEntries(served.map((s) => [s.id, wrong(key[s.id])])) as never).correct).toBe(0);
    const none = markAttempt(served, {});
    expect(none.correct).toBe(0);
    expect(none.responses.every((r) => r.selected_option === null && !r.is_correct)).toBe(true);
  });

  it('applies the 70% boundary as 21 of 30', () => {
    expect(requiredCorrect(30, 70)).toBe(21);
    expect(requiredCorrect(30, 75)).toBe(23);
    expect(requiredCorrect(40, 70)).toBe(28);
    const ids = served.map((s) => s.id);
    const answers = (n: number) => Object.fromEntries(ids.map((id, i) => [id, i < n ? key[id] : wrong(key[id])]));
    expect(markAttempt(served, answers(21) as never).correct).toBe(21);
    expect(markAttempt(served, answers(20) as never).correct).toBe(20);
  });

  it('breaks results down by category', () => {
    const m = markAttempt(served, key as never);
    const totals = Object.values(m.breakdown).reduce((n, b) => n + b.total, 0);
    expect(totals).toBe(30);
  });

  it('ignores answers to other questions and invalid options', () => {
    const clean = sanitiseAnswers(served, { [served[0].id]: 'a', Q999: 'a', [served[1].id]: 'e', [served[2].id]: 3, __proto__: 'b' });
    expect(clean).toEqual({ [served[0].id]: 'a' });
    expect(sanitiseAnswers(served, ['a'])).toEqual({});
    expect(sanitiseAnswers(served, null)).toEqual({});
  });
});

describe('identifiers', () => {
  it('generates and normalises recovery codes', () => {
    const code = newRecoveryCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    expect(normaliseRecoveryCode(code.toLowerCase().replace(/-/g, ' '))).toBe(code);
    expect(normaliseRecoveryCode('OOOO-IIII-LLLL-0000')).toBe('0000-1111-1111-0000');
    expect(normaliseRecoveryCode('short')).toBeNull();
  });

  it('generates and normalises certificate numbers', () => {
    const n = newCertificateNumber();
    expect(n).toMatch(/^10X-CSP-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(normaliseCertificateNumber(n.toLowerCase())).toBe(n);
    expect(normaliseCertificateNumber('10X-CSP-UUUU-0000-0000')).toBeNull();
    expect(normaliseCertificateNumber('../etc/passwd')).toBeNull();
  });
});

describe('input validation', () => {
  it('accepts names with Nigerian diacritics and rejects junk', () => {
    expect(v.fullName('  Adéwálé   Ọlábísí-Ṣóyínká ')).toBe('Adéwálé Ọlábísí-Ṣóyínká'.normalize('NFC'));
    expect(v.fullName("Chiamaka O'Neil")).toBe("Chiamaka O'Neil");
    expect(() => v.fullName('<script>')).toThrow();
    expect(() => v.fullName('A')).toThrow();
    expect(() => v.fullName('John 3')).toThrow();
  });

  it('validates email and phone', () => {
    expect(v.email(' Name@Example.COM ')).toBe('name@example.com');
    expect(() => v.email('not-an-email')).toThrow();
    expect(v.optionalPhone('')).toBeNull();
    expect(v.optionalPhone('+234 704 869 5731')).toBe('+234 704 869 5731');
    expect(() => v.optionalPhone('call me')).toThrow();
  });
});

describe('routing', () => {
  it('reads the path from the Vercel rewrite or the pathname', () => {
    expect(apiPath(new URL('https://x.test/api/v1?__path=attempts/abc/submit'))).toBe('attempts/abc/submit');
    expect(apiPath(new URL('https://x.test/api/v1/me'))).toBe('me');
  });
});
