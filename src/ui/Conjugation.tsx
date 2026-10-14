// Full conjugation for a verb, folded away until asked for: tense tabs + ich…sie table.
import React, { useState } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { speak } from '../data/speech';
import { Verb } from '../engine/types';
import { Speaker, T } from './kit';
import { Appear } from './motion';
import { color, size } from './theme';

const TENSES = ['Präsens', 'Präteritum', 'Perfekt', 'Plusquamperfekt', 'Futur I', 'Futur II'];
const PERSONS: [string, string][] = [
  ['ich', 'ich'], ['du', 'du'], ['er', 'er/sie/es'], ['wir', 'wir'], ['ihr', 'ihr'], ['sie', 'sie/Sie'],
];

/** Imperative saved by an older scraper version was really the present tense: don't show that. */
const goodImperative = (v: Verb) =>
  (v.imperative ?? []).length > 0 && !(v.imperative ?? []).some((x) => /^(ich|du|er|sie|es) /.test(x));

export function Conjugation({ verb, tint }: { verb: Verb; tint: string }) {
  const [open, setOpen] = useState(false);
  const tabs = [...TENSES.filter((t) => verb.indicative?.[t]), ...(goodImperative(verb) ? ['Imperativ'] : [])];
  const [tab, setTab] = useState(tabs[0] ?? 'Präsens');
  if (!tabs.length) return null;

  const rows: [string, string][] = tab === 'Imperativ'
    ? (verb.imperative ?? []).map((x) => {
        const m = x.match(/^(.*?)\s*\((du|ihr)\)$/);
        if (m) return [m[2], m[1]];                       // "wasche (du)" → du | wasche
        const parts = x.split(' ');
        return [parts.slice(1).join(' '), parts[0]];      // "waschen wir" → wir | waschen
      })
    : PERSONS.filter(([k]) => verb.indicative?.[tab]?.[k]).map(([k, label]) => [label, verb.indicative![tab][k]]);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={(state) => {
          const s = state as { pressed: boolean; hovered?: boolean; focused?: boolean };
          return [styles.toggle, { borderColor: tint }, (s.pressed || s.hovered) && { backgroundColor: tint + '14' },
            s.focused && ({ outlineColor: tint, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 } as ViewStyle)];
        }}>
        <T style={[styles.toggleText, { color: tint }]}>
          {open ? 'Hide full conjugation' : 'Show full conjugation'}
        </T>
        <T style={[styles.toggleText, { color: tint }]}>{open ? '−' : '+'}</T>
      </Pressable>

      {open ? (
        <Appear distance={8}>
          <View style={styles.tabs} accessibilityRole="tablist">
            {tabs.map((t) => {
              const active = t === tab;
              return (
                <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: active }}
                  onPress={() => setTab(t)}
                  style={[styles.tab, { borderColor: tint }, active && { backgroundColor: tint }]}>
                  <T style={[styles.tabText, { color: active ? '#fff' : tint }]}>{t}</T>
                </Pressable>
              );
            })}
          </View>
          <View key={tab}>
            {rows.map(([who, form], i) => (
              <View key={who + i} style={[styles.row, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
                <T style={styles.who}>{who}</T>
                <T style={styles.form}>{form}</T>
              </View>
            ))}
          </View>
          <View style={styles.listen}>
            <Speaker tint={tint} onPress={() =>
              speak(rows.map(([who, form]) => (tab === 'Imperativ' ? form : `${who.split('/')[0]} ${form}`)).join('. '))} />
          </View>
        </Appear>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 6, gap: 10 },
  toggle: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
  },
  toggleText: { fontSize: size.sm, fontWeight: '600' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  tab: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11 },
  tabText: { fontSize: size.xs, fontWeight: '600' },
  row: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderColor: color.line },
  who: { width: 88, color: color.muted, fontSize: size.sm },
  form: { flex: 1, fontSize: size.md, fontWeight: '600' },
  listen: { marginTop: 4 },
});
