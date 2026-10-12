import React from 'react';
import { Pressable, StyleSheet, Text, TextProps, View, ViewStyle } from 'react-native';
import { color, font, size } from './theme';

export function T({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[{ fontFamily: font, color: color.ink, fontSize: size.md }, style]} />;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'quiet';
  tint?: string;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, kind = 'primary', tint = color.ink, disabled, style }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={(state) => {
        const s = state as { pressed: boolean; focused?: boolean; hovered?: boolean };
        return [
          styles.btn,
          kind === 'primary' ? { backgroundColor: tint } : { backgroundColor: 'transparent', borderColor: color.line },
          disabled && { opacity: 0.4 },
          (s.pressed || s.hovered) && !disabled && { opacity: 0.85 },
          s.focused && { outlineColor: tint, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 } as ViewStyle,
          style,
        ];
      }}
    >
      <T style={[styles.btnText, { color: kind === 'primary' ? '#fff' : color.ink }]}>{label}</T>
    </Pressable>
  );
}

export function Bar({ value, tint = color.ink }: { value: number; tint?: string }) {
  return (
    <View style={styles.bar}>
      <View style={[styles.barFill, { width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: tint }]} />
    </View>
  );
}

/** A speaker drawn from plain shapes (no icon font needed): box, cone, two sound waves. */
export function SpeakerIcon({ tint, scale = 1 }: { tint: string; scale?: number }) {
  const u = (n: number) => n * scale;
  return (
    <View style={{ width: u(22), height: u(18), flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: u(5), height: u(7), backgroundColor: tint, borderRadius: u(1) }} />
      <View style={{
        width: 0, height: 0, marginLeft: -u(1),
        borderTopWidth: u(7), borderBottomWidth: u(7), borderRightWidth: u(7),
        borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: tint,
      }} />
      <View style={{
        width: u(6), height: u(8), marginLeft: u(1.5), borderWidth: u(2), borderColor: 'transparent',
        borderRightColor: tint, borderRadius: u(8),
      }} />
      <View style={{
        width: u(9), height: u(14), marginLeft: -u(5), borderWidth: u(2), borderColor: 'transparent',
        borderRightColor: tint, borderRadius: u(12),
      }} />
    </View>
  );
}

/** Round "listen" button with a speaker icon. `big` is the one next to the word. */
export function Speaker({ onPress, tint = color.muted, big = false }: { onPress: () => void; tint?: string; big?: boolean }) {
  const d = big ? 44 : 34;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Listen" onPress={onPress} hitSlop={8}
      style={(state) => {
        const s = state as { pressed: boolean; hovered?: boolean; focused?: boolean };
        return [styles.speaker, { width: d, height: d, borderRadius: d / 2, borderColor: tint },
          (s.pressed || s.hovered) && { backgroundColor: tint + '1A' },
          s.focused && ({ outlineColor: tint, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 } as ViewStyle)];
      }}>
      <SpeakerIcon tint={tint} scale={big ? 1 : 0.8} />
    </Pressable>
  );
}

export function Chip({ text, tint = color.muted }: { text: string; tint?: string }) {
  return (
    <View style={[styles.chip, { borderColor: tint }]}>
      <T style={{ color: tint, fontSize: size.xs, fontWeight: '600' }}>{text}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: 'transparent',
    alignItems: 'center',
  },
  btnText: { fontSize: size.md, fontWeight: '600' },
  bar: { height: 6, borderRadius: 3, backgroundColor: color.line, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  speaker: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 },
});
