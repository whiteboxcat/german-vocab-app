// FSRS-4.5 spaced-repetition scheduler (Free Spaced Repetition Scheduler, open algorithm by Jarrett Ye).
// Answers are graded pass/fail like WaniKani: pass = "Good" (3), fail = "Again" (1).
// New cards first go through short learning steps (like WaniKani's apprentice stages), then FSRS takes over.

const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461,
  2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const REQUEST_RETENTION = 0.9;
const MAX_INTERVAL_DAYS = 365;
const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;

/** Short steps after a lesson before a card graduates to long-term scheduling. */
export const LEARNING_STEPS = [4 * HOUR, 8 * HOUR, 1 * DAY];
/** After forgetting a long-term card, see it again soon. */
export const RELEARN_DELAY = 30 * MINUTE;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function retrievability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

export function intervalDays(stability: number): number {
  const days = (stability / FACTOR) * (Math.pow(REQUEST_RETENTION, 1 / DECAY) - 1);
  return clamp(Math.round(days), 1, MAX_INTERVAL_DAYS);
}

export const initStability = (grade: 1 | 3) => W[grade - 1];
export const initDifficulty = (grade: 1 | 3) => clamp(W[4] - (grade - 3) * W[5], 1, 10);

export function nextDifficulty(d: number, grade: 1 | 3): number {
  const next = d - W[6] * (grade - 3);
  return clamp(W[7] * initDifficulty(3) + (1 - W[7]) * next, 1, 10);
}

export function stabilityAfterSuccess(d: number, s: number, r: number): number {
  return s * (Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) + 1);
}

export function stabilityAfterFailure(d: number, s: number, r: number): number {
  const sf = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
  return Math.min(sf, s); // forgetting never makes memory stronger
}

export type Schedulable = {
  phase: 'learning' | 'review';
  step: number;
  due: number;
  stability: number;
  difficulty: number;
  lastReview: number | null;
  reps: number;
  lapses: number;
};

export function newCardAfterLesson(now: number): Schedulable {
  return {
    phase: 'learning', step: 0, due: now + LEARNING_STEPS[0],
    stability: initStability(3), difficulty: initDifficulty(3), lastReview: now, reps: 0, lapses: 0,
  };
}

/** Apply one answer. `correct` is the learner's first attempt for this card in the session. */
export function review<T extends Schedulable>(card: T, correct: boolean, now: number): T {
  const c = { ...card, reps: card.reps + 1, lastReview: now };
  if (card.phase === 'learning') {
    if (!correct) {
      return { ...c, step: 0, due: now + LEARNING_STEPS[0] };
    }
    const nextStep = card.step + 1;
    if (nextStep < LEARNING_STEPS.length) {
      return { ...c, step: nextStep, due: now + LEARNING_STEPS[nextStep] };
    }
    // Graduate: start long-term scheduling with the initial "Good" memory.
    const stability = initStability(3);
    return { ...c, phase: 'review', step: 0, stability, difficulty: initDifficulty(3),
      due: now + intervalDays(stability) * DAY };
  }

  const elapsed = Math.max(0, (now - (card.lastReview ?? now)) / DAY);
  const r = retrievability(elapsed, card.stability);
  if (correct) {
    const stability = stabilityAfterSuccess(card.difficulty, card.stability, r);
    return { ...c, stability, difficulty: nextDifficulty(card.difficulty, 3),
      due: now + intervalDays(stability) * DAY };
  }
  const stability = stabilityAfterFailure(card.difficulty, card.stability, r);
  return { ...c, lapses: card.lapses + 1, stability, difficulty: nextDifficulty(card.difficulty, 1),
    due: now + RELEARN_DELAY };
}

/** A card counts as "learned" (unlocks the next batch) once it has left the learning steps. */
export const isGraduated = (c: Schedulable | undefined) => !!c && c.phase === 'review';
