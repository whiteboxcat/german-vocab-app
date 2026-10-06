import { Platform } from 'react-native';
import { Word } from '../engine/types';

export const color = {
  paper: '#F3F5F8',
  surface: '#FFFFFF',
  ink: '#18202B',
  muted: '#667085',
  line: '#DCE1E8',
  der: '#1F5FD1',
  die: '#D63A4A',
  das: '#1E8F55',
  verb: '#6A3FC8',
  right: '#1E8F55',
  wrong: '#D63A4A',
  rightWash: '#E7F5EE',
  wrongWash: '#FBEBED',
};

export const font = Platform.select({
  web: 'Archivo, "Helvetica Neue", Arial, sans-serif',
  default: undefined,
});

export function wordColor(w: Word): string {
  if (w.type === 'verb') return color.verb;
  if (w.article === 'der') return color.der;
  if (w.article === 'die') return color.die;
  if (w.article === 'das') return color.das;
  return color.ink;
}

export const articleColor = (a: string | null | undefined) =>
  a === 'der' ? color.der : a === 'die' ? color.die : a === 'das' ? color.das : color.ink;

/** Typographic scale (1.25 ratio) used across the app. */
export const size = { xs: 13, sm: 15, md: 17, lg: 21, xl: 27, xxl: 34, word: 52 };

/** Load Archivo on the web; native falls back to the system font. */
export function loadWebFont() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('archivo-font')) return;
  const link = document.createElement('link');
  link.id = 'archivo-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;800&display=swap';
  document.head.appendChild(link);
}
