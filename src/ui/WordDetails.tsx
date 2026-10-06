// Everything about one word: used on lesson pages and after answering a review.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { speak } from '../data/speech';
import { label } from '../engine/cards';
import { Word } from '../engine/types';
import { Chip, Speaker, T } from './kit';
import { articleColor, color, size, wordColor } from './theme';

export function WordHead({ word, compact = false }: { word: Word; compact?: boolean }) {
  const tint = wordColor(word);
  const big = compact ? size.xxl : size.word;
  return (
    <View style={styles.head}>
      <View style={styles.headRow}>
        {word.type === 'noun' && word.article ? (
          <T style={{ fontSize: big * 0.55, fontWeight: '600', color: tint, marginRight: 10 }}>{word.article}</T>
        ) : null}
        <T style={{ fontSize: big, fontWeight: '800', color: tint, letterSpacing: -0.5 }}>
          {word.type === 'verb' && word.separable_prefix
            ? `${word.separable_prefix}|${word.infinitive.slice(word.separable_prefix.length)}`
            : word.type === 'noun' ? word.lemma : word.infinitive}
        </T>
      </View>
      <Speaker tint={tint} onPress={() => speak(label(word))} />
    </View>
  );
}

function Row({ k, v, tint }: { k: string; v: string; tint?: string }) {
  return (
    <View style={styles.row}>
      <T style={styles.rowKey}>{k}</T>
      <T style={[styles.rowVal, tint ? { color: tint } : null]}>{v}</T>
    </View>
  );
}

export function WordBody({ word }: { word: Word }) {
  return (
    <View style={styles.body}>
      <T style={styles.meaning}>{word.english.slice(0, 5).join(', ')}</T>

      {word.type === 'noun' ? (
        <View style={styles.block}>
          {word.plural && !word.singular_only ? <Row k="Plural" v={`die ${word.plural}`} tint={color.die} /> : null}
          {word.singular_only ? <Row k="Plural" v="none (singular only)" /> : null}
          {word.genitive ? <Row k="Genitiv" v={`${word.article === 'die' ? 'der' : 'des'} ${word.genitive}`} /> : null}
        </View>
      ) : (
        <>
          <View style={styles.chips}>
            {word.separable_prefix ? <Chip text={`trennbar: ${word.separable_prefix}-`} tint={color.verb} /> : null}
            {word.auxiliaries.map((a) => <Chip key={a} text={`Perfekt mit ${a}`} tint={a === 'sein' ? color.die : color.muted} />)}
            {word.objects.map((o) => <Chip key={o} text={`+ ${o}`} />)}
            {word.prepositions.slice(0, 3).map((p) => <Chip key={p} text={p.replace('+A', ' + Akk').replace('+D', ' + Dat').replace('+G', ' + Gen')} />)}
          </View>
          <View style={styles.block}>
            {word.present_3sg ? <Row k="Präsens" v={`er ${word.present_3sg}`} /> : null}
            {word.praeteritum_3sg ? <Row k="Präteritum" v={`er ${word.praeteritum_3sg}`} /> : null}
            {word.perfekt_3sg ? <Row k="Perfekt" v={`er ${word.perfekt_3sg}`} tint={color.verb} /> : null}
          </View>
        </>
      )}

      {word.examples.slice(0, 2).map((ex, i) => (
        <View key={i} style={styles.example}>
          <View style={{ flex: 1 }}>
            <T style={styles.exDe}>{ex.de}</T>
            <T style={styles.exEn}>{ex.en}</T>
          </View>
          <Speaker onPress={() => speak(ex.de)} />
        </View>
      ))}
    </View>
  );
}

export const articleTint = articleColor;

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 6 },
  headRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'center' },
  body: { gap: 16 },
  meaning: { fontSize: size.lg, textAlign: 'center', color: color.ink },
  block: { borderTopWidth: 1, borderColor: color.line },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: color.line },
  rowKey: { color: color.muted, fontSize: size.sm },
  rowVal: { fontSize: size.md, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  example: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  exDe: { fontSize: size.md },
  exEn: { fontSize: size.sm, color: color.muted, marginTop: 2 },
});
