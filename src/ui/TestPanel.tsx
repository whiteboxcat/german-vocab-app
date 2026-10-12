// Shown only in test mode (open the app with ?test). Lets you skip waiting so reviews and
// level unlocks can be tried in minutes instead of days.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, T } from './kit';
import { color, size } from './theme';

export type TestInfo = {
  wordsLoaded: number;
  openLevels: string[];
  cards: number;
  dataVersion: number;
  source: string;
};

type Props = {
  info: TestInfo;
  onSkip: (hours: number) => void;
  onAllDue: () => void;
  onOpenNextLevel: () => void;
  onExit: () => void;
};

const HOUR = 1;
const SKIPS: { label: string; hours: number }[] = [
  { label: 'Skip 4 hours', hours: 4 * HOUR },
  { label: 'Skip 1 day', hours: 24 * HOUR },
  { label: 'Skip 1 week', hours: 7 * 24 * HOUR },
];

export function TestPanel({ info, onSkip, onAllDue, onOpenNextLevel, onExit }: Props) {
  return (
    <View style={styles.panel} accessibilityLabel="Test tools">
      <T style={styles.title}>Test mode</T>
      <T style={styles.info}>
        {info.wordsLoaded} words loaded from {info.source} (data version {info.dataVersion}) ·
        open levels {info.openLevels.join(', ')} · {info.cards} cards scheduled
      </T>
      <T style={styles.note}>
        Skipping moves your schedule forward as if that time had passed. Progress is real, so use a
        private window if you want to keep your own progress separate.
      </T>
      <View style={styles.row}>
        {SKIPS.map((s) => (
          <Button key={s.label} label={s.label} kind="quiet" onPress={() => onSkip(s.hours)} style={styles.btn} />
        ))}
      </View>
      <View style={styles.row}>
        <Button label="All reviews due now" kind="quiet" onPress={onAllDue} style={styles.btn} />
        <Button label="Open next level" kind="quiet" onPress={onOpenNextLevel} style={styles.btn} />
      </View>
      <Button label="Leave test mode" kind="quiet" onPress={onExit} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: color.verb, borderRadius: 12,
    padding: 16, gap: 10, backgroundColor: color.surface,
  },
  title: { fontSize: size.md, fontWeight: '800', color: color.verb },
  info: { fontSize: size.sm },
  note: { fontSize: size.xs, color: color.muted, lineHeight: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { flexGrow: 1, paddingVertical: 10 },
});
