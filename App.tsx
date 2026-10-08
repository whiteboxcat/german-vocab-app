import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { readJSON, remove, writeJSON } from './src/data/storage';
import { CEFR_LEVELS, levelTotals, loadWords } from './src/data/words';
import {
  answerCard, completeLesson, emptyProgress, LESSON_BATCH, overview,
} from './src/engine/progress';
import { CardId, Progress, Word, wordKey } from './src/engine/types';
import { Home } from './src/screens/Home';
import { Lesson } from './src/screens/Lesson';
import { Quiz } from './src/screens/Quiz';
import { Button, T } from './src/ui/kit';
import { color, loadWebFont, size } from './src/ui/theme';

const PROGRESS_KEY = 'progress-v1';
type Screen = { name: 'home' } | { name: 'lesson'; words: Word[] } | { name: 'review'; ids: CardId[] };

export default function App() {
  const [words, setWords] = useState<Word[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [totals, setTotals] = useState<Record<string, number>>({});
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
      progressRef.current = { ...saved, openLevels: levels };
      setProgress(progressRef.current);
    } catch {
      setError("Couldn't download the word list. Check your internet connection and try again.");
    }
    levelTotals().then(setTotals);
  }, []);

  useEffect(() => { loadWebFont(); load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  const save = useCallback((p: Progress) => {
    progressRef.current = p;
    setProgress(p);
    writeJSON(PROGRESS_KEY, p);
  }, []);
  useEffect(() => { progressRef.current = progress; }, [progress]);

  const byKey = useMemo(() => new Map((words ?? []).map((w) => [wordKey(w), w])), [words]);
  const o = useMemo(() => (words && progress ? overview(words, progress, now) : null), [words, progress, now]);

  // Every word of the open levels has had its lesson → download and open the next level.
  useEffect(() => {
    if (!o || !progress || opening.current || screen.name !== 'home') return;
    if (o.total === 0 || o.learned < o.total) return;
    const open = progress.openLevels ?? ['A1'];
    const next = CEFR_LEVELS.find((l) => !open.includes(l) && (totals[l] ?? 1) > 0);
    if (!next) return;
    opening.current = true;
    const levels = [...open, next];
    loadWords(levels)
      .then((r) => {
        const p = { ...(progressRef.current ?? progress), openLevels: levels };
        setWords(r.words);
        save(p);
        setMessage(`You've had every ${open[open.length - 1]} word. ${next} is open now.`);
      })
      .catch(() => setMessage(`Couldn't download the ${next} words yet. They'll load next time you're online.`))
      .finally(() => { opening.current = false; });
  }, [o, progress, totals, screen.name, save]);

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
      <Home o={o} offline={offline} message={message} totals={totals}
        openLevels={progress.openLevels ?? ['A1']}
        onLesson={() => { setMessage(null); setScreen({ name: 'lesson', words: o.lessonsAvailable.slice(0, LESSON_BATCH) }); }}
        onReview={() => { setMessage(null); setScreen({ name: 'review', ids: o.reviewsDue }); }}
        onReset={async () => {
          await remove(PROGRESS_KEY);
          save({ ...emptyProgress(Date.now()), openLevels: ['A1'] });
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
