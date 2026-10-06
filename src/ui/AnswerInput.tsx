// The answer area: der/die/das buttons, or a text field with ä ö ü ß keys.
import React, { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Prompt } from '../engine/cards';
import { T } from './kit';
import { articleColor, color, font, size } from './theme';

const UMLAUTS = ['ä', 'ö', 'ü', 'ß'];

type Props = {
  prompt: Prompt;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  locked: boolean;        // after answering
  resultTint?: string;    // right/wrong colour once locked
};

export function AnswerInput({ prompt, value, onChange, onSubmit, locked, resultTint }: Props) {
  const ref = useRef<TextInput>(null);

  useEffect(() => {
    if (!locked && prompt.input !== 'choice') setTimeout(() => ref.current?.focus(), 30);
  }, [prompt, locked]);

  // Keyboard shortcuts on the web: 1/2/3 pick der/die/das.
  useEffect(() => {
    if (Platform.OS !== 'web' || prompt.input !== 'choice' || locked) return;
    const onKey = (e: KeyboardEvent) => {
      const i = ['1', '2', '3'].indexOf(e.key);
      if (i >= 0 && prompt.choices) onSubmit(prompt.choices[i]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prompt, locked, onSubmit]);

  if (prompt.input === 'choice') {
    return (
      <View style={styles.choices}>
        {(prompt.choices ?? []).map((c, i) => {
          const tint = articleColor(c);
          const chosen = locked && value === c;
          const isAnswer = locked && c === prompt.answer;
          return (
            <Pressable key={c} accessibilityRole="button" disabled={locked} onPress={() => onSubmit(c)}
              style={[styles.choice, { borderColor: tint },
                (chosen || isAnswer) && { backgroundColor: tint }, locked && !chosen && !isAnswer && { opacity: 0.35 }]}>
              <T style={[styles.choiceText, { color: chosen || isAnswer ? '#fff' : tint }]}>{c}</T>
              {Platform.OS === 'web' ? (
                <T style={[styles.key, { color: chosen || isAnswer ? '#fff' : color.muted }]}>{i + 1}</T>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={[styles.field, locked && resultTint ? { borderColor: resultTint } : null]}>
        {prompt.inputPrefix ? <T style={styles.prefix}>{prompt.inputPrefix}</T> : null}
        <TextInput
          ref={ref}
          value={value}
          editable={!locked}
          onChangeText={onChange}
          onSubmitEditing={() => onSubmit(value)}
          submitBehavior="submit"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholder={prompt.input === 'english' ? 'English' : 'Deutsch'}
          placeholderTextColor={color.muted}
          style={[styles.input, { fontFamily: font }]}
          accessibilityLabel={prompt.ask}
        />
      </View>
      {prompt.input === 'german' && !locked ? (
        <View style={styles.umlauts}>
          {UMLAUTS.map((u) => (
            <Pressable key={u} accessibilityRole="button" accessibilityLabel={`Type ${u}`}
              onPress={() => { onChange(value + u); ref.current?.focus(); }} style={styles.umlaut}>
              <T style={{ fontSize: size.lg }}>{u}</T>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', gap: 10 },
  choice: { flex: 1, borderWidth: 2, borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  choiceText: { fontSize: size.xl, fontWeight: '800' },
  key: { fontSize: size.xs, marginTop: 2 },
  field: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: color.surface,
    borderWidth: 2, borderColor: color.line, borderRadius: 12, paddingHorizontal: 14,
  },
  prefix: { fontSize: size.lg, color: color.muted, marginRight: 8 },
  input: { flex: 1, fontSize: size.lg, paddingVertical: 14, color: color.ink, outlineStyle: 'none' } as any,
  umlauts: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  umlaut: {
    width: 52, height: 44, borderRadius: 10, borderWidth: 1, borderColor: color.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface,
  },
});
