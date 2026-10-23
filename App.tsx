import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { readJSON, remove, writeJSON } from './src/data/storage';
import {
  AccountError, linkError, loadSession, Session, sessionFromLink, signOut, syncProgress, validSession,
} from './src/data/account';
import { Account } from './src/screens/Account';
import { mergeProgress } from './src/engine/merge';
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
const NUDGE_KEY = 'kofi-nudge-day';
const LAST_SYNC_KEY = 'account-last-sync';
const SYNC_DELAY = 4000;
const today = () => new Date().toISOString().slice(0, 10);

/** ?test shows the test panel (only while it's in the address). */
function testParam(): boolean | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('test');
  if (v === null) return null;
  return v !== 'off' && v !== '0';
}
type Screen = { name: 'home' } | { name: 'focus' } | { name: 'account'; login?: boolean } | { name: 'lesson'; words: Word[] } | { name: 'review'; ids: CardId[] };

export default function App() {
  const [words, setWords] = useState<Word[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [message, setMessage] = useState<string | null>(null);
  const [kofiNudge, setKofiNudge] = useState(false);
  // Finishing a lesson or reviews may add the Ko-fi line, but only on the first finish of the day.
  const finished = useCallback(async (text: string) => {
    setMessage(text);
    const last = await readJSON<string>(NUDGE_KEY);
    if (last !== today()) {
      setKofiNudge(true);
      writeJSON(NUDGE_KEY, today());
    } else {
      setKofiNudge(false);
    }
  }, []);
  const [now, setNow] = useState(Date.now());
  const [totals, setTotals] = useState<LevelTotals>({});
  const [testMode, setTestMode] = useState(false);
  const [dataInfo, setDataInfo] = useState({ version: 0, source: '' });
  const progressRef = useRef<Progress | null>(null);
  const opening = useRef(false);

  // ---- optional account (backup + sync) ----
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [loginChecked, setLoginChecked] = useState(false);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncBusy = useRef(false);
  const setLogin = useCallback((s: Session | null) => { sessionRef.current = s; setSession(s); }, []);

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
  // Test mode only while ?test is in the address; nothing is remembered (old saved flag is cleared).
  useEffect(() => { setTestMode(!!testParam()); remove(TEST_KEY); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  useEffect(() => { if (!message) setKofiNudge(false); }, [message]);

  // Keep this device's copy (no "changed" stamp: used for what came from the account).
  const keepLocal = useCallback((p: Progress) => {
    progressRef.current = p;
    setProgress(p);
    writeJSON(PROGRESS_KEY, p);
  }, []);

  const runSync = useCallback(async (): Promise<boolean> => {
    const local = progressRef.current;
    if (!local || syncBusy.current) return false;
    const s = await validSession(sessionRef.current);
    if (!s) {
      if (sessionRef.current) { setLogin(null); setMessage('You were signed out. Log in again to keep backing up.'); }
      return false;
    }
    if (s !== sessionRef.current) setLogin(s);
    syncBusy.current = true; setSyncing(true);
    try {
      const r = await syncProgress(s, local);
      // Answers given while syncing win: merge them on top of what came back.
      const latest = progressRef.current ?? local;
      const merged = latest === local ? r.progress : mergeProgress(latest, r.progress);
      keepLocal(merged);
      const have = new Set(local.openLevels ?? ['A1']);
      const want = merged.openLevels ?? ['A1'];
      if (want.some((l) => !have.has(l))) loadWords(want).then((w) => setWords(w.words)).catch(() => {});
      const t = Date.now();
      setLastSync(t); writeJSON(LAST_SYNC_KEY, t); setSyncError(null);
      setNow(Date.now());
      return r.gotNew;
    } catch (e) {
      setSyncError(e instanceof AccountError ? e.message : 'Backup failed. It will try again later.');
      return false;
    } finally {
      syncBusy.current = false; setSyncing(false);
    }
  }, [keepLocal, setLogin]);

  const scheduleSync = useCallback(() => {
    if (!sessionRef.current) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => { syncTimer.current = null; runSync(); }, SYNC_DELAY);
  }, [runSync]);

  // A change made on this device: stamp it, keep it, and back it up shortly after.
  const save = useCallback((p: Progress) => {
    keepLocal({ ...p, updatedAt: Date.now() });
    scheduleSync();
  }, [keepLocal, scheduleSync]);

  // Links from emails (confirm / reset password) bring the login in the address.
  const takeLink = useCallback(async (): Promise<boolean> => {
    const err = linkError();
    if (err) { setAccountNotice(err); setScreen({ name: 'account' }); }
    const fromLink = await sessionFromLink();
    if (!fromLink) return !!err;
    setLogin(fromLink.session);
    if (fromLink.kind === 'recovery') { setRecovery(true); setScreen({ name: 'account' }); }
    else setMessage('Your email is confirmed. Your progress is now backed up.');
    return true;
  }, [setLogin]);

  // Sign-in state on start: an email link or a saved login.
  useEffect(() => {
    (async () => {
      readJSON<number>(LAST_SYNC_KEY).then((t) => setLastSync(t));
      if (!(await takeLink()) || !sessionRef.current) setLogin(await validSession(await loadSession()));
      setLoginChecked(true);
    })();
  }, [takeLink, setLogin]);

  // The link opened in a tab where the app was already running: only the #… part changed.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onHash = () => { takeLink().then((got) => { if (got && sessionRef.current) runSync(); }); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [takeLink, runSync]);

  // Signed in and progress loaded → sync once; and again whenever the app comes back into view.
  const hasProgress = !!progress;
  useEffect(() => { if (loginChecked && hasProgress && sessionRef.current) runSync(); }, [loginChecked, hasProgress, runSync]);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onVis = () => {
      if (document.visibilityState === 'visible') runSync();
      else if (syncTimer.current) { clearTimeout(syncTimer.current); syncTimer.current = null; runSync(); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [runSync]);
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
  } else if (screen.name === 'account') {
    body = (
      <Account session={session} recovery={recovery} lastSync={lastSync} syncing={syncing} syncError={syncError}
        notice={accountNotice} startWithLogin={screen.login}
        onBack={() => { setRecovery(false); setAccountNotice(null); setScreen({ name: 'home' }); }}
        onSignedIn={async (s) => {
          setLogin(s);
          setScreen({ name: 'home' });
          setMessage('Signed in. Backing up your progress…');
          const gotNew = await runSync();
          setMessage(gotNew
            ? `Signed in as ${s.email}. Your progress from the account was added to this device.`
            : `Signed in as ${s.email}. Your progress is backed up.`);
        }}
        onSyncNow={() => runSync()}
        onSignOut={() => {
          signOut(sessionRef.current); setLogin(null); setSyncError(null);
          setScreen({ name: 'home' });
          setMessage('Signed out. Your progress is still on this device.');
        }}
        onDeleted={() => {
          setLogin(null); setSyncError(null); setLastSync(null); remove(LAST_SYNC_KEY);
          setScreen({ name: 'home' });
          setMessage('Account deleted. Your progress is still on this device.');
        }}
        onRecoveryDone={() => {
          setRecovery(false); setScreen({ name: 'home' });
          setMessage('New password saved. You are signed in.');
        }} />
    );
  } else if (!progress.focus || screen.name === 'focus') {
    body = (
      <FocusPicker current={progress.focus}
        onCancel={progress.focus ? () => setScreen({ name: 'home' }) : undefined}
        onLogIn={() => setScreen({ name: 'account', login: true })}
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
          finished(`${learned.length} new word${learned.length === 1 ? '' : 's'} learned. Their first review comes in 4 hours.`);
          setScreen({ name: 'home' });
        }} />
    );
  } else if (screen.name === 'review') {
    body = (
      <Quiz title="Reviews" cardIds={screen.ids} words={byKey} onFirstAnswer={onFirstAnswer}
        onQuit={() => { setNow(Date.now()); setScreen({ name: 'home' }); }}
        onDone={({ right, total }) => {
          setNow(Date.now());
          finished(`Reviews done: ${right} of ${total} right on the first try.`);
          setScreen({ name: 'home' });
        }} />
    );
  } else {
    body = (
      <Home o={o} offline={offline} message={message} kofiNudge={kofiNudge} typeTotal={typeTotal}
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
            onExit={() => {
              setTestMode(false);
              if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname);
            }}
          />
        ) : null}
        account={{ email: session?.email ?? null, syncing, error: syncError }}
        onAccount={() => { setMessage(null); setScreen({ name: 'account' }); }}
        onReset={async () => {
          await remove(PROGRESS_KEY);
          save({ ...emptyProgress(Date.now()), openLevels: ['A1'], focus: progress.focus, resetAt: Date.now() });
          setWords((ws) => (ws ?? []).filter((w) => w.level === 'A1'));
          setMessage(sessionRef.current
            ? 'Progress deleted here and in your account backup. Start again with your first lesson.'
            : 'Progress deleted. Start again with your first lesson.');
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
