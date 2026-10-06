// Answer checking. Forgiving about form (umlauts typed as ae/oe/ue/ss, capitals, "er ..." prefixes,
// small English typos), strict about the German itself.

export type Verdict = {
  correct: boolean;
  /** Shown under the answer: a typo that was accepted, or what exactly was wrong. */
  note?: string;
};

export function foldGerman(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[.,!?;:"„“”'’()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const stripLead = (s: string, words: string[]) => {
  for (const w of words) {
    if (s.startsWith(w + ' ')) return s.slice(w.length + 1);
  }
  return s;
};

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Plural: "Tische" or "die Tische". */
export function checkPlural(input: string, plural: string): Verdict {
  const got = stripLead(foldGerman(input), ['die']);
  const want = stripLead(foldGerman(plural), ['die']);
  if (got === want) return { correct: true };
  if (got && want.startsWith(got) && want.length - got.length <= 2) {
    return { correct: false, note: 'Almost: check the ending.' };
  }
  return { correct: false };
}

/** A verb form like "rief an" or "hat angerufen"; "er rief an" is fine too. */
export function checkVerbForm(input: string, expected: string, kind: 'praeteritum' | 'perfekt'): Verdict {
  const got = stripLead(foldGerman(input), ['er', 'sie', 'es']);
  const want = foldGerman(expected);
  if (got === want) return { correct: true };
  if (kind === 'perfekt') {
    const [gAux, ...gRest] = got.split(' ');
    const [wAux, ...wRest] = want.split(' ');
    if (gRest.join(' ') === wRest.join(' ') && gAux !== wAux) {
      return { correct: false, note: `Right Partizip, but this verb uses "${wAux}".` };
    }
    if (gAux === wAux && gRest.length) {
      return { correct: false, note: `Right helper verb, but the Partizip II is different.` };
    }
  }
  return { correct: false };
}

const foldEnglish = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9' ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(to|a|an|the) /, '');

/** English meaning: any listed meaning counts; small typos are accepted. */
export function checkMeaning(input: string, meanings: string[]): Verdict {
  const got = foldEnglish(input);
  if (!got) return { correct: false };
  const options = meanings.map(foldEnglish).filter(Boolean);
  if (options.includes(got)) return { correct: true };
  for (const opt of options) {
    const allowed = opt.length >= 8 ? 2 : opt.length >= 4 ? 1 : 0;
    if (allowed && levenshtein(got, opt) <= allowed) {
      return { correct: true, note: `Accepted, but watch the spelling: "${opt}".` };
    }
  }
  return { correct: false };
}
