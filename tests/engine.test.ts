// Engine tests on real words from german-vocab-data. Run: npx tsx tests/engine.test.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkMeaning, checkPlural, checkVerbForm, displayForms, expandForms } from '../src/engine/answer';
import { existsSync, readdirSync } from 'node:fs';
import { check, facetsFor, promptFor } from '../src/engine/cards';
import { intervalDays, LEARNING_STEPS, review, newCardAfterLesson } from '../src/engine/fsrs';
import {
  allDueNow, answerCard, completeLesson, emptyProgress, focusWords, LEVEL_SIZE, overview, PASS_PER_LEVEL,
  RESUME_PER_DAY, setFocus, shuffleQueue, skipTime,
} from '../src/engine/progress';
import { Noun, Progress, Verb, Word } from '../src/engine/types';
import { mergeProgress, sameLearning } from '../src/engine/merge';

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

test('test tools: skip time and make all due', () => {
  const now = Date.UTC(2026, 9, 12);
  let p = completeLesson(emptyProgress(now), tisch, now);
  assert.equal(overview([tisch], p, now).reviewsDue.length, 0);
  p = skipTime(p, LEARNING_STEPS[0]);
  assert.equal(overview([tisch], p, now).reviewsDue.length, 3, 'all 3 parts due after 4 hours');
  // answering after skipping behaves like answering 4 hours later
  const id = Object.keys(p.cards)[0];
  const after = answerCard(p, id, true, now);
  assert.equal(after.cards[id].step, 1);
  assert.equal(after.cards[id].due - now, LEARNING_STEPS[1]);
  const q = allDueNow(completeLesson(emptyProgress(now), gehen, now), now);
  assert.equal(overview([gehen], q, now).reviewsDue.length, 3);
});

test('focus: nouns only pauses verbs, keeps their progress, unlocks by nouns', () => {
  const now = Date.UTC(2026, 9, 16);
  const ns: Word[] = Array.from({ length: 12 }, (_, i) => ({ ...tisch, id: `N${i}`, lemma: `Nomen${i}`, rank: 2 * i }));
  const vs: Word[] = Array.from({ length: 12 }, (_, i) => ({ ...gehen, id: `V${i}`, infinitive: `verb${i}en`, rank: 2 * i + 1 }));
  const all = [...ns, ...vs];
  let p = emptyProgress(now);
  // learn 2 verbs with "both"
  for (const v of vs.slice(0, 2)) p = completeLesson(p, v, now);
  // switch to nouns only
  p = setFocus(p, 'noun', now);
  const later = now + 5 * 3_600_000;
  let o = overview(focusWords(all, p.focus), p, later);
  assert.ok(o.lessonsAvailable.every((w) => w.type === 'noun'), 'only noun lessons');
  assert.equal(o.reviewsDue.length, 0, 'verb reviews paused');
  assert.equal(Object.keys(p.cards).length, 6, 'verb progress kept');
  assert.equal(o.total, 12);
  // the next CEFR level opens when all *nouns* had a lesson, verbs don't block it
  for (const n of ns) p = completeLesson(p, n, now);
  o = overview(focusWords(all, p.focus), p, later);
  assert.equal(o.learned, o.total, 'all nouns learned → level can open even though most verbs were never learned');
  // switch verbs back on: their reviews return
  p = setFocus(p, 'both', later);
  o = overview(focusWords(all, p.focus), p, later);
  assert.ok(o.reviewsDue.some((id) => id.startsWith('verb:')), 'verb reviews are back');
});

test('focus: a big paused backlog comes back spread over days', () => {
  const now = Date.UTC(2026, 9, 16);
  const vs: Word[] = Array.from({ length: 40 }, (_, i) => ({ ...gehen, id: `V${i}`, infinitive: `verb${i}en` }));
  let p = emptyProgress(now);
  for (const v of vs) p = completeLesson(p, v, now);          // 40 verbs × 3 parts = 120 cards
  p = setFocus(p, 'noun', now);
  const monthLater = now + 30 * 86_400_000;
  p = setFocus(p, 'verb', monthLater);
  const dueToday = Object.values(p.cards).filter((c) => c.due <= monthLater).length;
  assert.equal(dueToday, RESUME_PER_DAY);
  const dueIn2Days = Object.values(p.cards).filter((c) => c.due <= monthLater + 2 * 86_400_000).length;
  assert.equal(dueIn2Days, 120);
});

test('alternatives: Männer/Mannen, Amt(s)zeiten, wurde/ward', () => {
  assert.ok(checkPlural('Männer', 'Männer/Mannen').correct, 'the usual plural is right');
  assert.ok(checkPlural('die Maenner', 'Männer/Mannen').correct);
  assert.ok(checkPlural('Mannen', 'Männer/Mannen').correct, 'the rare one is right too');
  assert.ok(!checkPlural('Manner', 'Männer/Mannen').correct);
  assert.equal(displayForms('Männer/Mannen', 'die'), 'die Männer (also Mannen)');
  assert.deepEqual(expandForms('Amt(s)zeiten'), ['Amtszeiten', 'Amtzeiten']);
  assert.ok(checkPlural('Babyschuhe', 'Babyschuh(e)').correct && checkPlural('Babyschuh', 'Babyschuh(e)').correct);
  assert.ok(checkVerbForm('wurde', 'wurde/ward', 'praeteritum').correct);
  assert.ok(checkVerbForm('er ward los', 'wurde/ward los', 'praeteritum').correct);
  assert.ok(checkVerbForm('hat umgehaut', 'hat umgehauen/umgehaut', 'perfekt').correct);
  assert.equal(displayForms('wurde/ward', 'er'), 'er wurde (also ward)');
});

test('every real noun and verb accepts each of its listed forms', () => {
  const root = '/home/claude/german-vocab-data/data/levels';
  if (!existsSync(root)) return;                      // only runs where the data repo is checked out
  let n = 0;
  for (const lvl of readdirSync(root)) {
    const ns: Noun[] = existsSync(`${root}/${lvl}/nouns.json`) ? JSON.parse(readFileSync(`${root}/${lvl}/nouns.json`, 'utf8')) : [];
    const vs: Verb[] = existsSync(`${root}/${lvl}/verbs.json`) ? JSON.parse(readFileSync(`${root}/${lvl}/verbs.json`, 'utf8')) : [];
    for (const w of ns) {
      if (!w.plural) continue;
      for (const f of expandForms(w.plural)) { assert.ok(checkPlural(f, w.plural).correct, `${w.lemma}: ${f}`); n++; }
      assert.ok(!/[/()]/.test(displayForms(w.plural).split(' (also')[0]), `${w.lemma} shows a clean main form`);
    }
    for (const v of vs) {
      for (const [x, kind] of [[v.praeteritum_3sg, 'praeteritum'], [v.perfekt_3sg, 'perfekt']] as const) {
        if (!x) continue;
        for (const f of expandForms(x)) { assert.ok(checkVerbForm(f, x, kind).correct, `${v.infinitive}: ${f}`); n++; }
      }
    }
  }
  console.log(`   (${n} real forms checked)`);
});

test('merge: two devices never lose work', () => {
  const t0 = Date.UTC(2026, 9, 19);
  const day = 86_400_000;
  // phone learned Tisch and Stadt; laptop learned Stadt (reviewed later) and gehen
  let phone = completeLesson(completeLesson(emptyProgress(t0), tisch, t0), stadt, t0);
  let laptop = completeLesson(completeLesson(emptyProgress(t0 + 1000), stadt, t0), gehen, t0);
  const stadtGender = Object.keys(laptop.cards).find((id) => id.includes('Stadt#gender'))!;
  laptop = answerCard(laptop, stadtGender, true, t0 + day);   // newer review on the laptop
  phone = { ...phone, focus: 'noun', updatedAt: t0 + 2 * day };
  laptop = { ...laptop, focus: 'both', updatedAt: t0 + day, openLevels: ['A1', 'A2'] };

  const m = mergeProgress(phone, laptop);
  assert.equal(m.learned.length, 3, 'Tisch, Stadt and gehen are all learned');
  assert.equal(Object.keys(m.cards).length, 9);
  assert.equal(m.cards[stadtGender].reps, 1, 'the newer review of Stadt wins');
  assert.equal(m.focus, 'noun', 'settings from the device that changed last');
  assert.deepEqual(m.openLevels, ['A1', 'A2']);
  assert.equal(m.createdAt, t0);
  // merging is symmetric for the learning itself, and merging again changes nothing
  assert.ok(sameLearning(mergeProgress(laptop, phone), { ...m, focus: mergeProgress(laptop, phone).focus }));
  assert.ok(sameLearning(mergeProgress(m, m), m));
  // first sign-in on a fresh account: nothing remote yet
  assert.equal(mergeProgress(phone, null), phone);
  // "Reset progress" on one device is not undone by the older backup
  const fresh = { ...emptyProgress(t0 + 3 * day), resetAt: t0 + 3 * day, updatedAt: t0 + 3 * day };
  assert.equal(mergeProgress(fresh, m).learned.length, 0);
  assert.equal(mergeProgress(m, fresh).learned.length, 0);
  // ...but learning done after the reset is kept
  const after = { ...completeLesson(fresh, tisch, t0 + 4 * day), updatedAt: t0 + 4 * day };
  assert.equal(mergeProgress(fresh, after).learned.length, 1);
});

console.log(`\n${passed} tests passed`);
