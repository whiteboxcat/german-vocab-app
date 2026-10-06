// Levels, unlocking, lesson and review queues. Pure functions over (words, progress, now).

import { cardId, facetsFor, parseCardId } from './cards';
import { isGraduated, newCardAfterLesson, review } from './fsrs';
import { CardId, CardState, Progress, Word, headword, wordKey } from './types';

/** Words per level. A level unlocks once PASS_PER_LEVEL words of the previous ones are learned. */
export const LEVEL_SIZE = 10;
export const PASS_PER_LEVEL = 8;
export const LESSON_BATCH = 5;
export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const emptyProgress = (now: number): Progress => ({
  version: 1, cards: {}, learned: [], reviewsDone: 0, createdAt: now,
});

/** Teaching order: CEFR level, then how common the word is, then nouns/verbs alternating naturally. */
export function sortWords(words: Word[]): Word[] {
  const lvl = (w: Word) => {
    const i = CEFR_ORDER.indexOf(w.level ?? '');
    return i < 0 ? 99 : i;
  };
  return [...words]
    .filter((w) => facetsFor(w).length > 0)
    .sort((a, b) =>
      lvl(a) - lvl(b) ||
      (a.rank ?? 1e9) - (b.rank ?? 1e9) ||
      headword(a).localeCompare(headword(b), 'de'));
}

/** A word is passed when every one of its facets has left the learning steps. */
export function isWordPassed(w: Word, p: Progress): boolean {
  const fs = facetsFor(w);
  return fs.length > 0 && fs.every((f) => isGraduated(p.cards[cardId(w, f)]));
}

export type Overview = {
  level: number;
  passed: number;
  learned: number;
  total: number;
  toNextLevel: number;       // words still to pass before the next level unlocks
  lessonsAvailable: Word[];  // in teaching order
  reviewsDue: CardId[];
  nextReviewAt: number | null;
  byCefr: { cefr: string; learned: number; total: number }[];
};

export function overview(words: Word[], p: Progress, now: number): Overview {
  const sorted = sortWords(words);
  const byKey = new Map(sorted.map((w) => [wordKey(w), w]));
  const learnedSet = new Set(p.learned.filter((k) => byKey.has(k)));
  const passed = sorted.filter((w) => learnedSet.has(wordKey(w)) && isWordPassed(w, p)).length;
  const level = 1 + Math.floor(passed / PASS_PER_LEVEL);
  const unlocked = level * LEVEL_SIZE;
  const room = Math.max(0, unlocked - learnedSet.size);
  const lessonsAvailable = sorted.filter((w) => !learnedSet.has(wordKey(w))).slice(0, room);

  const reviewsDue: CardId[] = [];
  let nextReviewAt: number | null = null;
  for (const c of Object.values(p.cards)) {
    if (!byKey.has(parseCardId(c.id).key)) continue; // word no longer in the data
    if (c.due <= now) reviewsDue.push(c.id);
    else if (nextReviewAt === null || c.due < nextReviewAt) nextReviewAt = c.due;
  }

  const byCefr = CEFR_ORDER.map((cefr) => {
    const ws = sorted.filter((w) => w.level === cefr);
    return { cefr, total: ws.length, learned: ws.filter((w) => learnedSet.has(wordKey(w))).length };
  }).filter((x) => x.total > 0);

  return {
    level, passed, learned: learnedSet.size, total: sorted.length,
    toNextLevel: PASS_PER_LEVEL - (passed % PASS_PER_LEVEL),
    lessonsAvailable, reviewsDue, nextReviewAt, byCefr,
  };
}

/** Finish a lesson: the word's facets start their learning steps. */
export function completeLesson(p: Progress, w: Word, now: number): Progress {
  const key = wordKey(w);
  const cards = { ...p.cards };
  for (const f of facetsFor(w)) {
    const id = cardId(w, f);
    if (!cards[id]) cards[id] = { id, ...newCardAfterLesson(now) };
  }
  return { ...p, cards, learned: p.learned.includes(key) ? p.learned : [...p.learned, key] };
}

export function answerCard(p: Progress, id: CardId, correct: boolean, now: number): Progress {
  const card = p.cards[id];
  if (!card) return p;
  const next: CardState = review(card, correct, now);
  return { ...p, cards: { ...p.cards, [id]: next }, reviewsDone: p.reviewsDone + 1 };
}

/** Shuffle so the same word's facets don't come back to back when avoidable. */
export function shuffleQueue(ids: CardId[], rand: () => number = Math.random): CardId[] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  for (let i = 1; i < a.length; i++) {
    if (parseCardId(a[i]).key === parseCardId(a[i - 1]).key) {
      const prev = parseCardId(a[i - 1]).key;
      const k = a.findIndex((x, idx) => idx > i && parseCardId(x).key !== prev);
      if (k > 0) [a[i], a[k]] = [a[k], a[i]];
    }
  }
  return a;
}
