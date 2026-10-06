// Word records as produced by the german-vocab-data sync (verbformen.de, CC BY-SA 4.0).

export type Example = { de: string; en: string };

export type Noun = {
  type: 'noun';
  id: string;
  lemma: string;
  article: 'der' | 'die' | 'das' | null;
  articles?: string[];
  gender: 'm' | 'f' | 'n' | null;
  plural: string | null;
  genitive?: string | null;
  singular_only?: boolean;
  plural_only?: boolean;
  level: string | null;
  english: string[];
  examples: Example[];
  ipa?: string[];
  audio?: Record<string, string>;
  source_url: string;
  rank?: number | null;
};

export type Verb = {
  type: 'verb';
  id: string;
  infinitive: string;
  level: string | null;
  conjugation_class?: string | null;
  auxiliaries: string[];
  present_3sg: string | null;
  praeteritum_3sg: string | null;
  perfekt_3sg: string | null;
  partizip2: string | null;
  separable_prefix: string | null;
  separable: boolean;
  reflexive_use?: boolean;
  objects: string[];
  prepositions: string[];
  indicative?: Record<string, Record<string, string>>;
  imperative?: string[];
  english: string[];
  examples: Example[];
  ipa?: string[];
  audio?: Record<string, string>;
  source_url: string;
  rank?: number | null;
};

export type Word = Noun | Verb;

/** One thing to remember about a word. A word has several facets, each scheduled separately. */
export type Facet =
  | 'gender'        // noun: der / die / das
  | 'plural'        // noun: die Tische
  | 'meaning'       // German → English
  | 'praeteritum'   // verb: er rief an
  | 'perfekt';      // verb: er hat angerufen (tests haben/sein + Partizip II together)

export type CardId = string; // `${wordKey}#${facet}`

export type CardState = {
  id: CardId;
  /** 'learning' = in the short steps after a lesson; 'review' = long-term FSRS scheduling */
  phase: 'learning' | 'review';
  step: number;          // index into LEARNING_STEPS while learning
  due: number;           // ms timestamp
  stability: number;     // days (FSRS)
  difficulty: number;    // 1..10 (FSRS)
  lastReview: number | null;
  reps: number;
  lapses: number;
};

export type Progress = {
  version: 1;
  cards: Record<CardId, CardState>;
  learned: string[];     // word keys that finished their lesson
  reviewsDone: number;
  createdAt: number;
};

export const wordKey = (w: Word) => `${w.type}:${w.id}`;
export const headword = (w: Word) => (w.type === 'noun' ? w.lemma : w.infinitive);
