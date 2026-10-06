// Engine tests on real words from german-vocab-data. Run: npx tsx tests/engine.test.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkMeaning, checkPlural, checkVerbForm } from '../src/engine/answer';
import { check, facetsFor, promptFor } from '../src/engine/cards';
import { intervalDays, LEARNING_STEPS, review, newCardAfterLesson } from '../src/engine/fsrs';
import {
  answerCard, completeLesson, emptyProgress, LEVEL_SIZE, overview, PASS_PER_LEVEL, shuffleQueue,
} from '../src/engine/progress';
import { Noun, Verb, Word } from '../src/engine/types';

const nouns: Noun[] = JSON.parse(readFileSync(new URL('./fixtures/nouns.json', import.meta.url), 'utf8'))
  .map((n: Noun) => ({ ...n, type: 'noun' }));
const verbs: Verb[] = JSON.parse(readFileSync(new URL('./fixtures/verbs.json', import.meta.url), 'utf8'))
  .map((v: Verb) => ({ ...v, type: 'verb' }));
const tisch = nouns.find((n) => n.lemma === 'Tisch')!;
const stadt = nouns.find((n) => n.lemma === 'Stadt')!;
const gehen = verbs.find((v) => v.infinitive === 'gehen')!;
const anrufen = verbs.find((v) => v.infinitive === 'anrufen')!;

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log('PASS', name);
}

test('plural answers', () => {
  assert.ok(checkPlural('Tische', 'Tische').correct);
  assert.ok(checkPlural('die tische', 'Tische').correct);
  assert.ok(checkPlural('Staedte', 'Städte').correct);
  assert.ok(!checkPlural('Stadte', 'Städte').correct);
  assert.equal(checkPlural('Tisch', 'Tische').note, 'Almost: check the ending.');
});

test('verb form answers', () => {
  assert.ok(checkVerbForm('ging', 'ging', 'praeteritum').correct);
  assert.ok(checkVerbForm('er rief an', 'rief an', 'praeteritum').correct);
  assert.ok(checkVerbForm('ist gegangen', 'ist gegangen', 'perfekt').correct);
  const wrongAux = checkVerbForm('hat gegangen', 'ist gegangen', 'perfekt');
  assert.ok(!wrongAux.correct && wrongAux.note?.includes('"ist"'));
  assert.ok(!checkVerbForm('hat angeruft', 'hat angerufen', 'perfekt').correct);
});

test('meaning answers', () => {
  assert.ok(checkMeaning('table', tisch.english).correct);
  assert.ok(checkMeaning('Desk', tisch.english).correct);
  assert.ok(checkMeaning('to go', gehen.english).correct);
  const typo = checkMeaning('citty', stadt.english);
  assert.ok(typo.correct && typo.note);
  assert.ok(!checkMeaning('chair', tisch.english).correct);
  assert.ok(!checkMeaning('', tisch.english).correct);
});

test('facets and prompts from real data', () => {
  assert.deepEqual(facetsFor(tisch), ['gender', 'plural', 'meaning']);
  assert.deepEqual(facetsFor(anrufen), ['meaning', 'praeteritum', 'perfekt']);
  assert.equal(promptFor(anrufen, 'perfekt').answer, 'hat angerufen');
  assert.equal(promptFor(tisch, 'plural').inputPrefix, 'die');
  assert.ok(check(tisch, 'gender', 'der').correct);
  assert.ok(!check(tisch, 'gender', 'das').correct);
  assert.ok(check(gehen, 'perfekt', 'ist gegangen').correct);
});

test('learning steps then FSRS', () => {
  const now = Date.UTC(2026, 9, 6);
  let c = newCardAfterLesson(now);
  assert.equal(c.due - now, LEARNING_STEPS[0]);
  let t = now;
  for (let i = 0; i < LEARNING_STEPS.length; i++) {
    t = c.due;
    c = review(c, true, t);
  }
  assert.equal(c.phase, 'review');
  const firstInterval = (c.due - t) / 86_400_000;
  assert.equal(firstInterval, intervalDays(c.stability));
  assert.ok(firstInterval >= 3 && firstInterval <= 5, `first interval ${firstInterval}`);
  t = c.due;
  const good = review(c, true, t);
  assert.ok(good.stability > c.stability, 'success grows memory');
  const bad = review(c, false, t);
  assert.ok(bad.stability < c.stability && bad.lapses === 1, 'failure shrinks memory');
  assert.equal(review(newCardAfterLesson(now), false, now + 1).step, 0);
});

test('levels unlock after passing words', () => {
  const now = Date.UTC(2026, 9, 6);
  // Make 30 synthetic nouns so we can see unlocking.
  const many: Word[] = Array.from({ length: 30 }, (_, i) => ({
    ...tisch, id: `W${i}`, lemma: `Wort${i}`, rank: i,
  }));
  let p = emptyProgress(now);
  let o = overview(many, p, now);
  assert.equal(o.level, 1);
  assert.equal(o.lessonsAvailable.length, LEVEL_SIZE);
  assert.equal(o.lessonsAvailable[0].id, 'W0', 'common words first');

  for (const w of o.lessonsAvailable) p = completeLesson(p, w, now);
  o = overview(many, p, now);
  assert.equal(o.lessonsAvailable.length, 0, 'level 1 used up');
  assert.equal(o.reviewsDue.length, 0, 'first review comes later');
  assert.ok(o.nextReviewAt && o.nextReviewAt > now);

  // Pass PASS_PER_LEVEL words by answering every step correctly.
  let t = now;
  for (let step = 0; step < LEARNING_STEPS.length; step++) {
    t += LEARNING_STEPS[step];
    for (const id of Object.keys(p.cards)) {
      const wordIdx = Number(id.match(/W(\d+)#/)![1]);
      if (wordIdx < PASS_PER_LEVEL) p = answerCard(p, id, true, t);
    }
  }
  o = overview(many, p, t);
  assert.equal(o.passed, PASS_PER_LEVEL);
  assert.equal(o.level, 2);
  assert.equal(o.lessonsAvailable.length, LEVEL_SIZE);
  assert.equal(o.lessonsAvailable[0].id, 'W10');
});

test('shuffle keeps facets of a word apart', () => {
  const ids = ['noun:A#gender', 'noun:A#plural', 'noun:A#meaning', 'noun:B#gender', 'noun:B#plural', 'verb:c#meaning'];
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const q = shuffleQueue(ids, rand);
  assert.equal(q.length, ids.length);
  assert.deepEqual([...q].sort(), [...ids].sort());
});

console.log(`\n${passed} tests passed`);
