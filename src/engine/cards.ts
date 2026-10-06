import { checkMeaning, checkPlural, checkVerbForm, Verdict } from './answer';
import { CardId, Facet, Word, headword, wordKey } from './types';

export const cardId = (w: Word, f: Facet): CardId => `${wordKey(w)}#${f}`;

export function parseCardId(id: CardId): { key: string; facet: Facet } {
  const i = id.lastIndexOf('#');
  return { key: id.slice(0, i), facet: id.slice(i + 1) as Facet };
}

/** The facets a word is drilled on. Missing data means the facet is skipped. */
export function facetsFor(w: Word): Facet[] {
  if (w.type === 'noun') {
    const f: Facet[] = [];
    if (w.article) f.push('gender');
    if (w.plural && !w.singular_only && !w.plural_only) f.push('plural');
    if (w.english.length) f.push('meaning');
    return f;
  }
  const f: Facet[] = [];
  if (w.english.length) f.push('meaning');
  if (w.praeteritum_3sg) f.push('praeteritum');
  if (w.perfekt_3sg) f.push('perfekt');
  return f;
}

export type Prompt = {
  /** What to show big. */
  word: string;
  /** Shown before the word in its gender colour (nouns, once the gender isn't the question). */
  article?: string | null;
  /** Plain-language instruction for this question. */
  ask: string;
  /** Text before the input, e.g. "die" or "er". */
  inputPrefix?: string;
  input: 'choice' | 'german' | 'english';
  choices?: string[];
  answer: string;
};

export function promptFor(w: Word, facet: Facet): Prompt {
  if (w.type === 'noun') {
    switch (facet) {
      case 'gender':
        return { word: w.lemma, ask: 'Which article?', input: 'choice', choices: ['der', 'die', 'das'],
          answer: w.article ?? '' };
      case 'plural':
        return { word: w.lemma, article: w.article, ask: 'Plural', inputPrefix: 'die', input: 'german',
          answer: w.plural ?? '' };
      default:
        return { word: w.lemma, article: w.article, ask: 'Meaning in English', input: 'english',
          answer: w.english.slice(0, 3).join(', ') };
    }
  }
  switch (facet) {
    case 'praeteritum':
      return { word: w.infinitive, ask: 'Präteritum', inputPrefix: 'er', input: 'german',
        answer: w.praeteritum_3sg ?? '' };
    case 'perfekt':
      return { word: w.infinitive, ask: 'Perfekt', inputPrefix: 'er', input: 'german',
        answer: w.perfekt_3sg ?? '' };
    default:
      return { word: w.infinitive, ask: 'Meaning in English', input: 'english',
        answer: w.english.slice(0, 3).join(', ') };
  }
}

export function check(w: Word, facet: Facet, input: string): Verdict {
  if (w.type === 'noun') {
    if (facet === 'gender') return { correct: input === w.article };
    if (facet === 'plural') return checkPlural(input, w.plural ?? '');
    return checkMeaning(input, w.english);
  }
  if (facet === 'praeteritum') return checkVerbForm(input, w.praeteritum_3sg ?? '', 'praeteritum');
  if (facet === 'perfekt') return checkVerbForm(input, w.perfekt_3sg ?? '', 'perfekt');
  return checkMeaning(input, w.english);
}

export const label = (w: Word) => (w.type === 'noun' && w.article ? `${w.article} ${w.lemma}` : headword(w));
