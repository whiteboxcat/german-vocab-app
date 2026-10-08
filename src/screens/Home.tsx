import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CREDIT, CREDIT_URL } from '../config';
import { LESSON_BATCH, Overview, PASS_PER_LEVEL } from '../engine/progress';
import { Bar, Button, T } from '../ui/kit';
import { color, size } from '../ui/theme';

type Props = {
  o: Overview;
  totals: Record<string, number>;
  openLevels: string[];
  offline: boolean;
  message: string | null;
  onLesson: () => void;
  onReview: () => void;
  onReset: () => void;
};

function untilText(ts: number | null, now = Date.now()): string {
  if (!ts) return 'Learn some words to get reviews.';
  const mins = Math.max(1, Math.round((ts - now) / 60000));
  if (mins < 60) return `Next review in ${mins} min.`;
  const h = Math.round(mins / 60);
  if (h < 36) return `Next review in ${h} hour${h === 1 ? '' : 's'}.`;
  return `Next review in ${Math.round(h / 24)} days.`;
}

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function Home({ o, totals, openLevels, offline, message, onLesson, onReview, onReset }: Props) {
  const [confirmReset, setConfirmReset] = useState(false);
  const lessonCount = Math.min(LESSON_BATCH, o.lessonsAvailable.length);
  const passedInLevel = PASS_PER_LEVEL - o.toNextLevel;

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View style={styles.wrap}>
        <View style={styles.brandRow}>
          <T style={styles.brand}>
            <T style={[styles.brand, { color: color.der }]}>der </T>
            <T style={[styles.brand, { color: color.die }]}>die </T>
            <T style={[styles.brand, { color: color.das }]}>das</T>
          </T>
          {offline ? <T style={styles.offline}>Offline: using saved words</T> : null}
        </View>

        {message ? <T style={styles.message}>{message}</T> : null}

        <View style={styles.levelBlock}>
          <T style={styles.levelNum}>Level {o.level}</T>
          <Bar value={passedInLevel / PASS_PER_LEVEL} tint={color.ink} />
          <T style={styles.sub}>
            {o.toNextLevel} more word{o.toNextLevel === 1 ? '' : 's'} to learn well for level {o.level + 1}.
            A word counts once you've remembered all its parts over a day.
          </T>
        </View>

        <View style={styles.actions}>
          <Button
            label={o.reviewsDue.length ? `Review ${o.reviewsDue.length}` : 'No reviews right now'}
            onPress={onReview} disabled={!o.reviewsDue.length} tint={color.verb}
          />
          {!o.reviewsDue.length ? <T style={styles.hint}>{untilText(o.nextReviewAt)}</T> : null}
          <Button
            label={lessonCount ? `Learn ${lessonCount} new word${lessonCount === 1 ? '' : 's'}` : 'No new words yet'}
            onPress={onLesson} disabled={!lessonCount} tint={color.der}
          />
          {!lessonCount ? (
            <T style={styles.hint}>
              {o.learned >= o.total ? 'You have learned every word in the list so far.'
                : 'Finish the reviews of this level to unlock more words.'}
            </T>
          ) : null}
        </View>

        <View style={styles.cefr}>
          {CEFR.map((cefr) => {
            const loaded = o.byCefr.find((c) => c.cefr === cefr);
            const total = Math.max(totals[cefr] ?? 0, loaded?.total ?? 0);
            if (!total) return null;
            const isOpen = openLevels.includes(cefr);
            const learned = loaded?.learned ?? 0;
            return (
              <View key={cefr} style={{ gap: 6, opacity: isOpen ? 1 : 0.5 }}>
                <View style={styles.cefrRow}>
                  <T style={styles.cefrName}>{cefr}</T>
                  <T style={styles.sub}>
                    {isOpen ? `${learned} of ${total} words` : `${total} words · opens after the level before`}
                  </T>
                </View>
                <Bar value={isOpen && total ? learned / total : 0} tint={color.das} />
              </View>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Pressable onPress={() => Linking.openURL(CREDIT_URL)} accessibilityRole="link">
            <T style={styles.credit}>{CREDIT}</T>
          </Pressable>
          {confirmReset ? (
            <View style={styles.resetRow}>
              <Button label="Delete all progress" tint={color.wrong} onPress={() => { setConfirmReset(false); onReset(); }} />
              <Button label="Keep it" kind="quiet" onPress={() => setConfirmReset(false)} />
            </View>
          ) : (
            <Pressable onPress={() => setConfirmReset(true)} accessibilityRole="button">
              <T style={styles.resetLink}>Reset progress</T>
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 20, gap: 28 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap' },
  brand: { fontSize: size.lg, fontWeight: '800' },
  offline: { fontSize: size.xs, color: color.muted },
  message: { fontSize: size.md, backgroundColor: color.rightWash, color: color.ink, padding: 14, borderRadius: 12 },
  levelBlock: { gap: 10 },
  levelNum: { fontSize: size.word, fontWeight: '800', letterSpacing: -1 },
  sub: { fontSize: size.sm, color: color.muted, lineHeight: 21 },
  actions: { gap: 10 },
  hint: { fontSize: size.sm, color: color.muted, textAlign: 'center', marginBottom: 6 },
  cefr: { gap: 14 },
  cefrRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cefrName: { fontSize: size.md, fontWeight: '800' },
  footer: { gap: 14, borderTopWidth: 1, borderColor: color.line, paddingTop: 18 },
  credit: { fontSize: size.xs, color: color.muted, textDecorationLine: 'underline' },
  resetRow: { gap: 8 },
  resetLink: { fontSize: size.xs, color: color.muted },
});
