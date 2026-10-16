// Levels, unlocking, lesson and review queues. Pure functions over (words, progress, now).

import { cardId, facetsFor, parseCardId } from './cards';
import { isGraduated, newCardAfterLesson, review } from './fsrs';
import { CardId, CardState, Focus, Progress, Word, headword, wordKey } from './types';

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

// ---------------------------------------------------------------- test tools
/** Pretend `ms` milliseconds have passed: every schedule moves earlier by that much. */
export function skipTime(p: Progress, ms: number): Progress {
  const cards: Progress['cards'] = {};
  for (const [id, c] of Object.entries(p.cards)) {
    cards[id] = { ...c, due: c.due - ms, lastReview: c.lastReview === null ? null : c.lastReview - ms };
  }
  return { ...p, cards, createdAt: p.createdAt - ms };
}

/** Make every card due right now (keeps how well each one is known). */
export function allDueNow(p: Progress, now: number): Progress {
  const cards: Progress['cards'] = {};
  for (const [id, c] of Object.entries(p.cards)) cards[id] = { ...c, due: Math.min(c.due, now) };
  return { ...p, cards };
}

// ---------------------------------------------------------------- focus: nouns, verbs or both
/** Old reviews of a paused type come back at most this many per day when it's switched on again. */
export const RESUME_PER_DAY = 50;

export const inFocus = (type: 'noun' | 'verb', focus: Focus | undefined) =>
  !focus || focus === 'both' || focus === type;

/** Only the words of the chosen type. Everything else (lessons, reviews, levels) is computed from these,
 *  so the other type is paused: its cards keep their schedule but don't come up. */
export function focusWords(words: Word[], focus: Focus | undefined): Word[] {
  return words.filter((w) => inFocus(w.type, focus));
}

/**
 * Change what's being studied. Progress of every word is kept. When a paused type is switched on
 * again, its reviews that fell due in the meantime are spread out (RESUME_PER_DAY per day,
 * most overdue first) instead of all landing at once.
 */
export function setFocus(p: Progress, focus: Focus, now: number): Progress {
  const before = p.focus ?? 'both';
  const resumed = (['noun', 'verb'] as const).filter((t) => !inFocus(t, before) && inFocus(t, focus));
  if (!resumed.length) return { ...p, focus };
  const overdue = Object.values(p.cards)
    .filter((c) => resumed.includes(parseCardId(c.id).key.split(':')[0] as 'noun' | 'verb') && c.due <= now)
    .sort((a, b) => a.due - b.due);
  const cards = { ...p.cards };
  overdue.forEach((c, i) => {
    const day = Math.floor(i / RESUME_PER_DAY);
    cards[c.id] = { ...c, due: day === 0 ? c.due : now + day * 86_400_000 };
  });
  return { ...p, focus, cards };
}
