import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { readJSON, remove, writeJSON } from './src/data/storage';
import { CEFR_LEVELS, LevelTotals, levelTotals, loadWords } from './src/data/words';
import { FocusPicker, focusName } from './src/screens/FocusPicker';
import {
  allDueNow, answerCard, completeLesson, emptyProgress, focusWords, LESSON_BATCH, overview, setFocus, skipTime,
} from './src/engine/progress';
import { CardId, Progress, Word, wordKey } from './src/engine/types';
import { Home } from './src/screens/Home';
import { Lesson } from './src/screens/Lesson';
import { Quiz } from './src/screens/Quiz';
import { Button, T } from './src/ui/kit';
import { TestPanel } from './src/ui/TestPanel';
import { Platform } from 'react-native';
import { color, loadWebFont, size } from './src/ui/theme';

const PROGRESS_KEY = 'progress-v1';
const TEST_KEY = 'test-mode';

/** ?test turns test mode on (remembered on this device), ?test=off turns it off. */
function testParam(): boolean | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('test');
  if (v === null) return null;
  return v !== 'off' && v !== '0';
}
type Screen = { name: 'home' } | { name: 'focus' } | { name: 'lesson'; words: Word[] } | { name: 'review'; ids: CardId[] };

export default function App() {
  const [words, setWords] = useState<Word[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [totals, setTotals] = useState<LevelTotals>({});
  const [testMode, setTestMode] = useState(false);
  const [dataInfo, setDataInfo] = useState({ version: 0, source: '' });
  const progressRef = useRef<Progress | null>(null);
  const opening = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const saved = (await readJSON<Progress>(PROGRESS_KEY)) ?? emptyProgress(Date.now());
      const levels = saved.openLevels?.length ? saved.openLevels : ['A1'];
      const r = await loadWords(levels);
      setWords(r.words);
      setOffline(r.offline);
      setDataInfo({ version: r.version, source: r.source });
      progressRef.current = { ...saved, openLevels: levels };
      setProgress(progressRef.current);
    } catch {
      setError("Couldn't download the word list. Check your internet connection and try again.");
    }
    levelTotals().then(setTotals);
  }, []);

  useEffect(() => { loadWebFont(); load(); }, [load]);
  useEffect(() => {
    const fromUrl = testParam();
    if (fromUrl !== null) {
      setTestMode(fromUrl);
      writeJSON(TEST_KEY, fromUrl);
    } else {
      readJSON<boolean>(TEST_KEY).then((v) => setTestMode(!!v));
    }
  }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  const save = useCallback((p: Progress) => {
    progressRef.current = p;
    setProgress(p);
    writeJSON(PROGRESS_KEY, p);
  }, []);
  useEffect(() => { progressRef.current = progress; }, [progress]);

  const byKey = useMemo(() => new Map((words ?? []).map((w) => [wordKey(w), w])), [words]);
  // Only the chosen type (nouns, verbs or both) counts for lessons, reviews and unlocking levels.
  const focused = useMemo(() => (words && progress ? focusWords(words, progress.focus) : null), [words, progress]);
  const o = useMemo(() => (focused && progress ? overview(focused, progress, now) : null), [focused, progress, now]);
  const typeTotal = useCallback((lvl: string) => {
    const t = totals[lvl];
    if (!t) return undefined;
    const f = progressRef.current?.focus;
    return f === 'noun' ? t.nouns : f === 'verb' ? t.verbs : t.nouns + t.verbs;
  }, [totals]);

  const openNextLevel = useCallback((why: 'finished' | 'test') => {
    const p0 = progressRef.current;
    if (!p0 || opening.current) return;
    const open = p0.openLevels ?? ['A1'];
    const next = CEFR_LEVELS.find((l) => !open.includes(l) && (typeTotal(l) ?? 1) > 0);
    if (!next) { if (why === 'test') setMessage('Every level is already open.'); return; }
    opening.current = true;
    const levels = [...open, next];
    loadWords(levels)
      .then((r) => {
        setWords(r.words);
        save({ ...(progressRef.current ?? p0), openLevels: levels });
        setMessage(why === 'finished'
          ? `You've had every ${open[open.length - 1]} word. ${next} is open now.`
          : `${next} is open now (test mode).`);
      })
      .catch(() => setMessage(`Couldn't download the ${next} words yet. They'll load next time you're online.`))
      .finally(() => { opening.current = false; });
  }, [typeTotal, save]);

  // Every word of the open levels has had its lesson → download and open the next level.
  useEffect(() => {
    if (!o || !progress || !progress.focus || screen.name !== 'home') return;
    if (o.total === 0 || o.learned < o.total) return;
    openNextLevel('finished');
  }, [o, progress, screen.name, openNextLevel]);

  const onFirstAnswer = useCallback((id: CardId, correct: boolean) => {
    const p = progressRef.current;
    if (p) save(answerCard(p, id, correct, Date.now()));
  }, [save]);

  let body: React.ReactNode;
  if (error) {
    body = (
      <View style={styles.center}>
        <T style={styles.error}>{error}</T>
        <Button label="Try again" onPress={load} />
      </View>
    );
  } else if (!o || !progress) {
    body = <View style={styles.center}><ActivityIndicator color={color.ink} /></View>;
  } else if (!progress.focus || screen.name === 'focus') {
    body = (
      <FocusPicker current={progress.focus}
        onCancel={progress.focus ? () => setScreen({ name: 'home' }) : undefined}
        onChoose={(f) => {
          const first = !progress.focus;
          save(setFocus(progressRef.current ?? progress, f, Date.now()));
          setNow(Date.now());
          setMessage(first ? null : `Now learning: ${focusName(f).toLowerCase()}.`);
          setScreen({ name: 'home' });
        }} />
    );
  } else if (screen.name === 'lesson') {
    body = (
      <Lesson words={screen.words} allWords={byKey} onQuit={() => setScreen({ name: 'home' })}
        onFinish={(learned) => {
          let p = progressRef.current ?? progress;
          const t = Date.now();
          for (const w of learned) p = completeLesson(p, w, t);
          save(p);
          setNow(Date.now());
          setMessage(`${learned.length} new word${learned.length === 1 ? '' : 's'} learned. Their first review comes in 4 hours.`);
          setScreen({ name: 'home' });
        }} />
    );
  } else if (screen.name === 'review') {
    body = (
      <Quiz title="Reviews" cardIds={screen.ids} words={byKey} onFirstAnswer={onFirstAnswer}
        onQuit={() => { setNow(Date.now()); setScreen({ name: 'home' }); }}
        onDone={({ right, total }) => {
          setNow(Date.now());
          setMessage(`Reviews done: ${right} of ${total} right on the first try.`);
          setScreen({ name: 'home' });
        }} />
    );
  } else {
    body = (
      <Home o={o} offline={offline} message={message} typeTotal={typeTotal}
        focusLabel={focusName(progress.focus)} onChangeFocus={() => { setMessage(null); setScreen({ name: 'focus' }); }}
        openLevels={progress.openLevels ?? ['A1']}
        onLesson={() => { setMessage(null); setScreen({ name: 'lesson', words: o.lessonsAvailable.slice(0, LESSON_BATCH) }); }}
        onReview={() => { setMessage(null); setScreen({ name: 'review', ids: o.reviewsDue }); }}
        testPanel={testMode ? (
          <TestPanel
            info={{ wordsLoaded: words?.length ?? 0, openLevels: progress.openLevels ?? ['A1'],
              cards: Object.keys(progress.cards).length, dataVersion: dataInfo.version, source: dataInfo.source }}
            onSkip={(hours) => {
              save(skipTime(progressRef.current ?? progress, hours * 3_600_000));
              setNow(Date.now());
              setMessage(`Skipped ${hours >= 24 ? `${hours / 24} day${hours === 24 ? '' : 's'}` : `${hours} hours`}.`);
            }}
            onAllDue={() => {
              save(allDueNow(progressRef.current ?? progress, Date.now()));
              setNow(Date.now());
              setMessage('Every learned card is due now.');
            }}
            onOpenNextLevel={() => openNextLevel('test')}
            onExit={() => { setTestMode(false); writeJSON(TEST_KEY, false); }}
          />
        ) : null}
        onReset={async () => {
          await remove(PROGRESS_KEY);
          save({ ...emptyProgress(Date.now()), openLevels: ['A1'], focus: progress.focus });
          setWords((ws) => (ws ?? []).filter((w) => w.level === 'A1'));
          setMessage('Progress deleted. Start again with your first lesson.');
        }} />
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.paper, paddingTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  error: { fontSize: size.md, textAlign: 'center', maxWidth: 420 },
});
