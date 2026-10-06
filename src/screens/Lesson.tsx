// Lesson: look at each new word, then a short quiz. Finishing the quiz starts the words' review schedule.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { cardId, facetsFor } from '../engine/cards';
import { Word, wordKey } from '../engine/types';
import { Bar, Button, T } from '../ui/kit';
import { color, size, wordColor } from '../ui/theme';
import { WordBody, WordHead } from '../ui/WordDetails';
import { Quiz } from './Quiz';

type Props = {
  words: Word[];                    // the words in this lesson (up to 5)
  allWords: Map<string, Word>;
  onFinish: (learned: Word[]) => void;
  onQuit: () => void;
};

export function Lesson({ words, allWords, onFinish, onQuit }: Props) {
  const [i, setI] = useState(0);
  const [quiz, setQuiz] = useState(false);

  if (quiz) {
    const ids = words.flatMap((w) => facetsFor(w).map((f) => cardId(w, f)));
    return (
      <Quiz title="Lesson quiz" cardIds={ids} words={allWords}
        onDone={() => onFinish(words)} onQuit={onQuit} />
    );
  }

  const w = words[i];
  const last = i === words.length - 1;
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View style={styles.wrap}>
        <View style={styles.top}>
          <T style={styles.title}>New words</T>
          <T style={styles.count}>{i + 1} / {words.length}</T>
        </View>
        <Bar value={(i + 1) / words.length} tint={wordColor(w)} />
        <View style={{ paddingVertical: 24 }} key={wordKey(w)}>
          <WordHead word={w} />
        </View>
        <WordBody word={w} />
        <View style={styles.nav}>
          <Button label="Back" kind="quiet" disabled={i === 0} onPress={() => setI(i - 1)} style={{ flex: 1 }} />
          <Button label={last ? 'Start quiz' : 'Next word'} tint={wordColor(w)}
            onPress={() => (last ? setQuiz(true) : setI(i + 1))} style={{ flex: 2 }} />
        </View>
        <Button label="Stop for now" kind="quiet" onPress={onQuit} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 20, gap: 18 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: size.md, fontWeight: '600' },
  count: { fontSize: size.sm, color: color.muted },
  nav: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
