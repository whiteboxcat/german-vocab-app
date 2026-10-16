// "What do you want to learn?" — shown on first open, and from the home screen to change it.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { Focus } from '../engine/types';
import { Button, T } from '../ui/kit';
import { Appear } from '../ui/motion';
import { color, size } from '../ui/theme';

type Option = { focus: Focus; title: string; detail: string; tints: string[]; recommended?: boolean };

const OPTIONS: Option[] = [
  { focus: 'both', title: 'Nouns and verbs', recommended: true,
    detail: 'Articles, plurals, meanings, and verb forms like Präteritum and Perfekt.',
    tints: [color.der, color.die, color.das, color.verb] },
  { focus: 'noun', title: 'Nouns only',
    detail: 'der, die or das, the plural, and what the word means.',
    tints: [color.der, color.die, color.das] },
  { focus: 'verb', title: 'Verbs only',
    detail: 'Meaning, Präteritum, Perfekt with haben or sein, and the full conjugation.',
    tints: [color.verb] },
];

export const focusName = (f: Focus | undefined) =>
  f === 'noun' ? 'Nouns only' : f === 'verb' ? 'Verbs only' : 'Nouns and verbs';

type Props = {
  current: Focus | undefined;     // undefined = first open
  onChoose: (f: Focus) => void;
  onCancel?: () => void;
};

export function FocusPicker({ current, onChoose, onCancel }: Props) {
  const [picked, setPicked] = useState<Focus>(current ?? 'both');
  const first = current === undefined;
  const pausing = !first && picked !== 'both' && picked !== current;

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View style={styles.wrap}>
        <Appear>
          <T style={styles.brand}>
            <T style={[styles.brand, { color: color.der }]}>der </T>
            <T style={[styles.brand, { color: color.die }]}>die </T>
            <T style={[styles.brand, { color: color.das }]}>das</T>
          </T>
          <T style={styles.title}>What do you want to learn?</T>
          <T style={styles.sub}>
            {first ? 'You can change this anytime from the home screen.'
              : 'Your progress on every word is kept, whatever you choose.'}
          </T>
        </Appear>

        <View style={styles.options} accessibilityRole="radiogroup">
          {OPTIONS.map((opt, i) => {
            const on = picked === opt.focus;
            return (
              <Appear key={opt.focus} delay={60 + i * 60}>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setPicked(opt.focus)}
                  style={(state) => {
                    const s = state as { hovered?: boolean; focused?: boolean };
                    return [styles.option, on && styles.optionOn, s.hovered && !on && { borderColor: color.muted },
                      s.focused && ({ outlineColor: color.ink, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 } as ViewStyle)];
                  }}>
                  <View style={styles.swatches}>
                    {opt.tints.map((t) => <View key={t} style={[styles.swatch, { backgroundColor: t }]} />)}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.optionHead}>
                      <T style={styles.optionTitle}>{opt.title}</T>
                      {opt.recommended ? <T style={styles.recommended}>Recommended</T> : null}
                    </View>
                    <T style={styles.optionDetail}>{opt.detail}</T>
                  </View>
                  <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                </Pressable>
              </Appear>
            );
          })}
        </View>

        {pausing ? (
          <T style={styles.note}>
            Reviews of {picked === 'noun' ? 'verbs' : 'nouns'} you've already learned will pause. When you switch them
            back on, they return at up to 50 a day so they don't pile up.
          </T>
        ) : null}

        <Button label={first ? 'Start learning' : 'Save'} onPress={() => onChoose(picked)} />
        {onCancel ? <Button label="Keep it as it is" kind="quiet" onPress={onCancel} /> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 20, gap: 20 },
  brand: { fontSize: size.lg, fontWeight: '800' },
  title: { fontSize: size.xxl, fontWeight: '800', letterSpacing: -0.5, marginTop: 18 },
  sub: { fontSize: size.md, color: color.muted, marginTop: 6, lineHeight: 24 },
  options: { gap: 12 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14,
    borderWidth: 2, borderColor: color.line, backgroundColor: color.surface,
  },
  optionOn: { borderColor: color.ink },
  swatches: { width: 22, gap: 3 },
  swatch: { height: 8, borderRadius: 2 },
  optionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  optionTitle: { fontSize: size.lg, fontWeight: '800' },
  recommended: {
    fontSize: size.xs, fontWeight: '600', color: color.right, backgroundColor: color.rightWash,
    paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, overflow: 'hidden',
  },
  optionDetail: { fontSize: size.sm, color: color.muted, lineHeight: 20 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: color.line,
    alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: color.ink },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.ink },
  note: { fontSize: size.sm, color: color.muted, lineHeight: 20 },
});
