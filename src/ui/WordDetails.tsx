// Everything about one word: the word card (lessons, quiz, reviews) and the detail boxes below it.
//
// Nouns and verbs never look alike:
//   Nomen – white card, top band and badge in the gender colour (grey while the gender is the question)
//   Verb  – violet-washed card, violet band and badge, separable prefix split with a bar (an|rufen)
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { speak } from '../data/speech';
import { displayForms } from '../engine/answer';
import { label } from '../engine/cards';
import { Word } from '../engine/types';
import { Chip, Speaker, T } from './kit';
import { Appear } from './motion';
import { Conjugation } from './Conjugation';
import { color, size, typeLabel, wordColor } from './theme';

type CardProps = {
  word: Word;
  /** The noun's gender is what's being asked: hide the article and every colour hint. */
  hideGender?: boolean;
  /** The question, shown under the word while it's being asked (e.g. "Plural"). */
  ask?: string;
  /** Show the English meaning under the word (lessons, and after answering). */
  showMeaning?: boolean;
  compact?: boolean;
};

export function WordCard({ word, hideGender = false, ask, showMeaning = false, compact = false }: CardProps) {
  const isVerb = word.type === 'verb';
  const tint = hideGender ? color.hidden : wordColor(word);
  const big = compact ? size.xxl : size.word;
  const text = isVerb && word.separable_prefix
    ? `${word.separable_prefix}|${word.infinitive.slice(word.separable_prefix.length)}`
    : word.type === 'noun' ? word.lemma : word.infinitive;

  return (
    <Appear key={`${label(word)}|${ask ?? ''}|${hideGender}|${showMeaning}`}>
      <View style={[styles.card, { backgroundColor: isVerb ? color.verbWash : color.surface }]}>
        <View style={[styles.band, { backgroundColor: tint }]} />
        <View style={styles.cardInner}>
          <View style={[styles.badge, { backgroundColor: tint }]}>
            <T style={styles.badgeText}>{typeLabel(word, hideGender)}</T>
          </View>
          <View style={styles.headRow}>
            <View style={styles.wordLine}>
              {word.type === 'noun' && word.article && !hideGender ? (
                <T style={{ fontSize: big * 0.55, fontWeight: '600', color: tint, marginRight: 10 }}>{word.article}</T>
              ) : null}
              {word.type === 'noun' && hideGender ? (
                <T style={{ fontSize: big * 0.55, fontWeight: '600', color: color.line, marginRight: 10 }}>___</T>
              ) : null}
              <T style={{ fontSize: big, fontWeight: '800', color: tint, letterSpacing: -0.5 }}>{text}</T>
            </View>
          </View>
          {showMeaning && word.english.length ? (
            <T style={styles.meaningLine}>{word.english.slice(0, 3).join(', ')}</T>
          ) : ask ? (
            <T style={[styles.ask, { color: tint }]}>{ask}</T>
          ) : null}
          <View style={styles.cardFooter}>
            <Speaker tint={tint} onPress={() => speak(hideGender ? text : label(word))} />
          </View>
        </View>
      </View>
    </Appear>
  );
}

/** Kept for older call sites: the card without a question line. */
export function WordHead({ word, compact = false }: { word: Word; compact?: boolean }) {
  return <WordCard word={word} compact={compact} showMeaning hideGender={word.type === 'noun' && !word.article} />;
}

function Box({ title, children, delay }: { title: string; children: React.ReactNode; delay: number }) {
  return (
    <Appear delay={delay} distance={10}>
      <View style={styles.box}>
        <T style={styles.boxTitle}>{title}</T>
        {children}
      </View>
    </Appear>
  );
}

function Row({ k, v, tint, last }: { k: string; v: string; tint?: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <T style={styles.rowKey}>{k}</T>
      <T style={[styles.rowVal, tint ? { color: tint } : null]}>{v}</T>
    </View>
  );
}

export function WordBody({ word }: { word: Word }) {
  const rows: { k: string; v: string; tint?: string }[] = [];
  if (word.type === 'noun') {
    if (word.plural && !word.singular_only) rows.push({ k: 'Plural', v: displayForms(word.plural, 'die'), tint: color.die });
    if (word.singular_only) rows.push({ k: 'Plural', v: 'none (singular only)' });
    if (word.genitive) rows.push({ k: 'Genitiv', v: `${word.article === 'die' ? 'der' : 'des'} ${word.genitive}` });
  } else {
    if (word.present_3sg) rows.push({ k: 'Präsens', v: `er ${word.present_3sg}` });
    if (word.praeteritum_3sg) rows.push({ k: 'Präteritum', v: displayForms(word.praeteritum_3sg, 'er') });
    if (word.perfekt_3sg) rows.push({ k: 'Perfekt', v: displayForms(word.perfekt_3sg, 'er'), tint: color.verb });
  }
  const chips = word.type === 'verb' ? [
    ...(word.separable_prefix ? [{ t: `trennbar: ${word.separable_prefix}-`, c: color.verb }] : []),
    ...word.auxiliaries.map((a) => ({ t: `Perfekt mit ${a}`, c: a === 'sein' ? color.die : color.muted })),
    ...word.objects.map((o) => ({ t: `+ ${o}`, c: color.muted })),
    ...word.prepositions.slice(0, 3).map((p) => ({
      t: p.replace('+A', ' + Akk').replace('+D', ' + Dat').replace('+G', ' + Gen'), c: color.muted })),
  ] : [];
  const examples = word.examples.slice(0, 2);

  return (
    <View style={styles.body}>
      {word.english.length > 3 ? (
        <Box title="More meanings" delay={60}>
          <T style={styles.moreMeanings}>{word.english.slice(3, 8).join(', ')}</T>
        </Box>
      ) : null}

      {word.synonyms?.length ? (
        <Box title="Synonyme" delay={90}>
          <View style={styles.chips}>
            {word.synonyms.slice(0, 8).map((syn) => (
              <View key={syn} style={[styles.syn, { borderColor: wordColor(word) }]}>
                <T style={[styles.synText, { color: wordColor(word) }]}>{syn}</T>
              </View>
            ))}
          </View>
          <T style={styles.synNote}>Exams often replace a word with one of these.</T>
        </Box>
      ) : null}

      {rows.length || chips.length ? (
        <Box title={word.type === 'noun' ? 'Forms' : 'Forms and use'} delay={120}>
          {chips.length ? (
            <View style={styles.chips}>{chips.map((c) => <Chip key={c.t} text={c.t} tint={c.c} />)}</View>
          ) : null}
          {rows.map((r, i) => <Row key={r.k} {...r} last={i === rows.length - 1} />)}
          {word.type === 'verb' ? <Conjugation verb={word} tint={color.verb} /> : null}
        </Box>
      ) : null}

      {examples.length ? (
        <Box title="Examples" delay={180}>
          {examples.map((ex, i) => (
            <View key={i} style={[styles.example, i > 0 && styles.exampleGap]}>
              <View style={{ flex: 1 }}>
                <T style={styles.exDe}>{ex.de}</T>
                <T style={styles.exEn}>{ex.en}</T>
              </View>
              <Speaker onPress={() => speak(ex.de)} />
            </View>
          ))}
        </Box>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, borderColor: color.line, overflow: 'hidden' },
  band: { height: 6 },
  cardInner: { alignItems: 'center', gap: 8, paddingTop: 14, paddingBottom: 18, paddingHorizontal: 16 },
  badge: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 6 },
  badgeText: { color: '#fff', fontSize: size.xs, fontWeight: '600' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  cardFooter: { alignSelf: 'stretch', marginTop: 10 },
  wordLine: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 1, flexWrap: 'wrap', justifyContent: 'center' },
  meaningLine: { fontSize: size.lg, color: color.ink, textAlign: 'center', lineHeight: 28, marginTop: 2 },
  ask: { fontSize: size.md, fontWeight: '600' },
  body: { gap: 12 },
  box: {
    backgroundColor: color.surface, borderRadius: 14, borderWidth: 1, borderColor: color.line,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 8,
  },
  boxTitle: { fontSize: size.xs, color: color.muted, fontWeight: '600' },
  moreMeanings: { fontSize: size.md, color: color.muted, lineHeight: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderColor: color.line },
  rowKey: { color: color.muted, fontSize: size.sm },
  rowVal: { fontSize: size.md, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  syn: { borderWidth: 1, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: color.surface },
  synText: { fontSize: size.md, fontWeight: '600' },
  synNote: { fontSize: size.xs, color: color.muted },
  example: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  exampleGap: { borderTopWidth: 1, borderColor: color.line, paddingTop: 10 },
  exDe: { fontSize: size.md },
  exEn: { fontSize: size.sm, color: color.muted, marginTop: 2 },
});
