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

/** "Listen" text button. Hover/press fills it with its colour so it's clearly clickable. */
export function Speaker({ onPress, tint = color.muted }: { onPress: () => void; tint?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Listen" onPress={onPress} hitSlop={6}
      style={(state) => {
        const s = state as { pressed: boolean; hovered?: boolean; focused?: boolean };
        const active = s.pressed || s.hovered;
        return [styles.speaker, { borderColor: tint }, active && { backgroundColor: tint },
          s.focused && ({ outlineColor: tint, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 } as ViewStyle)];
      }}>
      {(state) => {
        const s = state as { pressed: boolean; hovered?: boolean };
        return <T style={{ color: s.pressed || s.hovered ? '#fff' : tint, fontSize: size.sm, fontWeight: '600' }}>Listen</T>;
      }}
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
  speaker: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 14, alignSelf: 'flex-start' },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 },
});
