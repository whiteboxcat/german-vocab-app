// One question at a time. Used for the quiz at the end of a lesson and for reviews.
// Wrong answers come back at the end of the session; only the first try counts for scheduling.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { speak } from '../data/speech';
import { check, label, parseCardId, promptFor } from '../engine/cards';
import { shuffleQueue } from '../engine/progress';
import { CardId, Word } from '../engine/types';
import { AnswerInput } from '../ui/AnswerInput';
import { Bar, Button, T } from '../ui/kit';
import { color, size, wordColor } from '../ui/theme';
import { WordBody, WordHead } from '../ui/WordDetails';

type Props = {
  title: string;
  cardIds: CardId[];
  words: Map<string, Word>;
  /** Called once per card with the result of the first try. */
  onFirstAnswer?: (id: CardId, correct: boolean) => void;
  onDone: (stats: { right: number; total: number }) => void;
  onQuit: () => void;
};

export function Quiz({ title, cardIds, words, onFirstAnswer, onDone, onQuit }: Props) {
  const [queue, setQueue] = useState<CardId[]>(() => shuffleQueue(cardIds));
  const [firstTry, setFirstTry] = useState<Record<CardId, boolean>>({});
  const [value, setValue] = useState('');
  const [result, setResult] = useState<{ correct: boolean; note?: string } | null>(null);

  const current = queue[0];
  const { key, facet } = parseCardId(current ?? '#meaning');
  const word = words.get(key);
  const prompt = useMemo(() => (word ? promptFor(word, facet) : null), [word, facet]);
  const total = cardIds.length;
  const done = Object.values(firstTry).length;

  const submit = useCallback((v: string) => {
    if (!word || !prompt || result) return;
    if (!v.trim()) return;
    const verdict = check(word, facet, v.trim());
    setValue(v);
    setResult(verdict);
    if (!(current in firstTry)) {
      setFirstTry((m) => ({ ...m, [current]: verdict.correct }));
      onFirstAnswer?.(current, verdict.correct);
    }
    if (word.type === 'noun' && facet === 'gender') speak(label(word));
  }, [word, prompt, result, facet, current, firstTry, onFirstAnswer]);

  const next = useCallback(() => {
    if (!result) return;
    const rest = queue.slice(1);
    const newQueue = result.correct ? rest : [...rest, current];
    setResult(null);
    setValue('');
    if (newQueue.length === 0) {
      const right = Object.values({ ...firstTry }).filter(Boolean).length;
      onDone({ right, total });
      return;
    }
    setQueue(newQueue);
  }, [result, queue, current, firstTry, onDone, total]);

  // Enter continues after an answer (web).
  useEffect(() => {
    if (Platform.OS !== 'web' || !result) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') next(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [result, next]);

  if (!word || !prompt) {
    return <View style={styles.wrap}><Button label="Back" onPress={onQuit} /></View>;
  }

  const tint = result ? (result.correct ? color.right : color.wrong) : undefined;
  const showWord = facet === 'gender' && !result ? { ...word, article: null } as Word : word;

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.wrap}>
        <View style={styles.top}>
          <T style={styles.title}>{title}</T>
          <T style={styles.count}>{done} / {total}</T>
        </View>
        <Bar value={done / total} tint={color.ink} />

        <View style={styles.card}>
          <WordHead word={showWord} />
          <T style={[styles.ask, { color: facet === 'gender' ? color.ink : wordColor(word) }]}>{prompt.ask}</T>
        </View>

        <AnswerInput prompt={prompt} value={value} onChange={setValue} onSubmit={submit}
          locked={!!result} resultTint={tint} />

        {!result && prompt.input !== 'choice' ? (
          <Button label="Check" onPress={() => submit(value)} disabled={!value.trim()} />
        ) : null}

        {result ? (
          <View style={[styles.result, { backgroundColor: result.correct ? color.rightWash : color.wrongWash }]}>
            <T style={[styles.verdict, { color: tint }]}>{result.correct ? 'Correct' : 'Not quite'}</T>
            {!result.correct ? (
              <T style={styles.answer}>
                {prompt.inputPrefix ? `${prompt.inputPrefix} ` : ''}{prompt.answer}
              </T>
            ) : null}
            {result.note ? <T style={styles.note}>{result.note}</T> : null}
            {!result.correct ? <T style={styles.note}>You'll see this one again at the end.</T> : null}
          </View>
        ) : null}

        {result ? (
          <>
            <Button label="Continue" onPress={next} tint={tint} />
            <WordBody word={word} />
          </>
        ) : null}

        <Button label="Stop for now" kind="quiet" onPress={onQuit} style={{ marginTop: 8 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  wrap: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 20, gap: 18 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: size.md, fontWeight: '600' },
  count: { fontSize: size.sm, color: color.muted },
  card: { paddingVertical: 28, alignItems: 'center', gap: 10 },
  ask: { fontSize: size.md, fontWeight: '600' },
  result: { borderRadius: 12, padding: 16, gap: 6 },
  verdict: { fontSize: size.lg, fontWeight: '800' },
  answer: { fontSize: size.xl, fontWeight: '600' },
  note: { fontSize: size.sm, color: color.muted },
});
