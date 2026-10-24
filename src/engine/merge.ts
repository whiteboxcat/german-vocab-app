// Merge two copies of a learner's progress (this device + the account backup) without losing work.
//
// Per card, the copy that was reviewed more recently wins (ties: more reviews, then the later due).
// Learned words are the union of both. Settings (focus) come from whichever copy changed last.
import { CEFR_ORDER } from './progress';
import { CardState, Progress } from './types';

function newerCard(a: CardState, b: CardState): CardState {
  const ra = a.lastReview ?? 0;
  const rb = b.lastReview ?? 0;
  if (ra !== rb) return ra > rb ? a : b;
  if (a.reps !== b.reps) return a.reps > b.reps ? a : b;
  return a.due >= b.due ? a : b;
}

function mergeTimes(a?: Record<string, number>, b?: Record<string, number>): Record<string, number> | undefined {
  if (!a && !b) return undefined;
  const out = { ...(b ?? {}) };
  for (const [k, t] of Object.entries(a ?? {})) out[k] = out[k] === undefined ? t : Math.min(out[k], t);
  return out;
}

export function mergeProgress(local: Progress, remote: Progress | null | undefined): Progress {
  if (!remote) return local;
  // One side was reset after the other was last changed: the older copy is what the learner threw away.
  if ((local.resetAt ?? 0) > (remote.updatedAt ?? 0)) return local;
  if ((remote.resetAt ?? 0) > (local.updatedAt ?? 0)) return remote;
  const cards: Progress['cards'] = { ...remote.cards };
  for (const [id, c] of Object.entries(local.cards)) {
    cards[id] = cards[id] ? newerCard(c, cards[id]) : c;
  }
  const levels = new Set([...(local.openLevels ?? []), ...(remote.openLevels ?? [])]);
  const newer = (local.updatedAt ?? 0) >= (remote.updatedAt ?? 0) ? local : remote;
  return {
    version: 1,
    cards,
    learned: [...new Set([...remote.learned, ...local.learned])],
    reviewsDone: Math.max(local.reviewsDone, remote.reviewsDone),
    createdAt: Math.min(local.createdAt, remote.createdAt),
    openLevels: CEFR_ORDER.filter((l) => levels.has(l)),
    focus: newer.focus ?? local.focus ?? remote.focus,
    dailyNew: newer.dailyNew ?? local.dailyNew ?? remote.dailyNew,
    learnedAt: mergeTimes(local.learnedAt, remote.learnedAt),
    updatedAt: Math.max(local.updatedAt ?? 0, remote.updatedAt ?? 0),
    resetAt: Math.max(local.resetAt ?? 0, remote.resetAt ?? 0) || undefined,
  };
}

/** True when the two copies already hold the same learning (so no upload is needed). */
export function sameLearning(a: Progress, b: Progress): boolean {
  if (a.learned.length !== b.learned.length || a.focus !== b.focus || a.dailyNew !== b.dailyNew) return false;
  const ka = Object.keys(a.cards);
  if (ka.length !== Object.keys(b.cards).length) return false;
  return ka.every((id) => {
    const x = a.cards[id]; const y = b.cards[id];
    return !!y && x.lastReview === y.lastReview && x.reps === y.reps && x.due === y.due;
  });
}
