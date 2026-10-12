// Small, purposeful motion: a card rises in when a new word appears, detail boxes follow,
// a wrong answer shakes the field, a right one pops the result. All of it is skipped when the
// device asks for reduced motion.
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleProp, ViewStyle } from 'react-native';

const native = Platform.OS !== 'web';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduced(!!v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setReduced(!!v));
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return reduced;
}

/** Fades and rises in when mounted (give it a new `key` to play again). */
export function Appear({ children, delay = 0, distance = 14, style }: {
  children: React.ReactNode; delay?: number; distance?: number; style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) { t.setValue(1); return; }
    Animated.timing(t, {
      toValue: 1, duration: 260, delay, easing: Easing.out(Easing.cubic), useNativeDriver: native,
    }).start();
  }, [reduced, delay, t]);
  return (
    <Animated.View style={[style, {
      opacity: t,
      transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
    }]}>
      {children}
    </Animated.View>
  );
}

/** Returns a style and a trigger: shake() wobbles the view sideways (for a wrong answer). */
export function useShake(): [Animated.WithAnimatedObject<ViewStyle>, () => void] {
  const reduced = useReducedMotion();
  const x = useRef(new Animated.Value(0)).current;
  const shake = () => {
    if (reduced) return;
    x.setValue(0);
    const step = (to: number) => Animated.timing(x, { toValue: to, duration: 55, useNativeDriver: native });
    Animated.sequence([step(-9), step(9), step(-6), step(6), step(0)]).start();
  };
  return [{ transform: [{ translateX: x }] }, shake];
}

/** Scales in slightly when mounted (for the "Correct" banner). */
export function Pop({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const s = useRef(new Animated.Value(reduced ? 1 : 0.94)).current;
  useEffect(() => {
    if (reduced) { s.setValue(1); return; }
    Animated.spring(s, { toValue: 1, friction: 5, tension: 160, useNativeDriver: native }).start();
  }, [reduced, s]);
  return <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>;
}
